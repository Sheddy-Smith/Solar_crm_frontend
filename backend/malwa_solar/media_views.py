"""Serve /media/<path> only to authenticated users with module view rights.

Browsers can't attach an Authorization header to <img>/<video>/<a> requests, so
the frontend may append the JWT as ?access=<token> (see getMediaUrl in src/api.js).
A normal Authorization: Bearer header is also accepted for API/tooling use.

Auth is not token-presence alone: the JWT is resolved to a User, then the media
path prefix is mapped to a CRM module and checked against RolePermission.can_view
(or full_access). Super Admin bypasses the module gate.

Video playback on mobile needs:
  - a correct Content-Type (X-Content-Type-Options: nosniff is on in production)
  - HTTP Range / Accept-Ranges so <video> can seek and read duration
"""
import logging
import mimetypes
import os
import re
from pathlib import Path

from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.handlers.asgi import ASGIRequest
from django.http import Http404, HttpResponse, HttpResponseForbidden, StreamingHttpResponse
from django.utils._os import safe_join
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)

mimetypes.add_type('video/webm', '.webm')
mimetypes.add_type('video/mp4', '.m4v')

_VIDEO_TYPES = {
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.mov': 'video/quicktime',
}

# Path folder (under MEDIA_ROOT) → permission module name.
# Enumerated from model upload_to callables / strings. Unmapped paths are DENIED
# (allow-list only). Matching uses folder-boundary rules — not bare startswith —
# so project_images_backup/... does not match project_images.
_MEDIA_MODULE_PREFIXES = (
    ('lead_survey_photos', 'Lead'),
    ('project_images', 'Project Management'),
    ('project_documents', 'Project Management'),
    ('site_survey_drawings', 'Project Management'),
    ('site_survey_photos', 'Project Management'),
    ('subsidy_docs', 'Project Management'),
    ('approval_docs', 'Project Management'),
    ('expense_docs', 'Project Management'),  # legacy on-disk paths
    ('sub_cd_docs', 'Project Management'),  # legacy on-disk paths
    ('liaison_docs', 'Liaisoning & Commissioning'),
    ('om_signatures', 'O&M'),
    ('om_insurance', 'O&M'),
    ('om_reports', 'O&M'),
    ('om_docs', 'O&M'),
    ('amc', 'AMC & Warranty'),
    ('workforce', 'Employee'),
    ('bug_reports', 'Settings'),
    ('backups', 'Settings'),
)


class _RangedFile:
    def __init__(self, path, start, length, blksize=64 * 1024):
        self.file = open(path, 'rb')
        self.file.seek(start)
        self.remaining = length
        self.blksize = blksize

    def __iter__(self):
        while self.remaining > 0:
            data = self.file.read(min(self.blksize, self.remaining))
            if not data:
                break
            self.remaining -= len(data)
            yield data

    def close(self):
        self.file.close()


class _AsyncRangedFile:
    """Async view of _RangedFile for ASGI. Django consumes a *sync* streaming
    iterator under ASGI by reading it fully into memory first, which would load
    whole videos into RAM per request."""

    def __init__(self, ranged):
        self.ranged = ranged

    async def __aiter__(self):
        while self.ranged.remaining > 0:
            data = await sync_to_async(self.ranged.file.read, thread_sensitive=False)(
                min(self.ranged.blksize, self.ranged.remaining)
            )
            if not data:
                break
            self.ranged.remaining -= len(data)
            yield data

    def close(self):
        self.ranged.close()


def _content_type_for(path):
    ext = Path(path).suffix.lower()
    if ext in _VIDEO_TYPES:
        return _VIDEO_TYPES[ext]
    guessed, _ = mimetypes.guess_type(path)
    return guessed or 'application/octet-stream'


def _module_for_media_path(path):
    normalized = (path or '').replace('\\', '/').lstrip('/')
    for prefix, module in _MEDIA_MODULE_PREFIXES:
        folder = prefix.rstrip('/')
        if normalized == folder or normalized.startswith(folder + '/'):
            return module
    return None


def _user_can_view_module(user, module):
    from apps.accounts.permissions import is_super_admin

    if is_super_admin(user):
        return True
    # Unknown / unmapped paths must not bypass module authorization.
    if not module:
        return False
    role = getattr(user, 'role', None)
    if not role:
        return False
    perm = role.permissions.filter(module=module).first()
    if not perm:
        return False
    return bool(perm.full_access or perm.can_view)


def _lead_id_from_media_path(path):
    """Extract lead PK embedded in survey photo folders (lead123_customer)."""
    normalized = (path or '').replace('\\', '/').lstrip('/')
    match = re.search(r'(?:^|/)lead(\d+)_', normalized)
    if match:
        return int(match.group(1))
    return None


def _user_can_access_media_object(user, path):
    """Object-level gate for lead-scoped roles (Sales / Tele Executives).

    Module ACL alone would let any Lead-viewer open another executive's
    survey photo if they guessed the URL. Resolve owning Lead when the path
    encodes a lead id; otherwise allow (module check already passed).
    """
    from apps.accounts.permissions import is_lead_scoped, is_own_lead, is_super_admin

    if is_super_admin(user) or not is_lead_scoped(user):
        return True
    lead_id = _lead_id_from_media_path(path)
    if lead_id is None:
        # Path does not encode ownership — module ACL is the remaining gate.
        return True
    from apps.leads.models import Lead

    lead = Lead.objects.filter(pk=lead_id, is_deleted=False).only(
        'id', 'assigned_to_id', 'created_by_id',
    ).first()
    if lead is None:
        return False
    return is_own_lead(user, lead)


def _authenticate_media_user(request):
    """Validate JWT and return (user, error_response). Prefer Bearer over query."""
    token = ''
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[len('Bearer '):]
    if not token:
        token = request.GET.get('access') or ''
    if not token:
        return None, HttpResponseForbidden('Authentication required to access this file.')
    authenticator = JWTAuthentication()
    try:
        validated = authenticator.get_validated_token(token)
        user = authenticator.get_user(validated)
    except (InvalidToken, TokenError):
        return None, HttpResponseForbidden('Invalid or expired token.')
    except Exception:
        logger.exception('Media auth failed unexpectedly')
        return None, HttpResponseForbidden('Invalid or expired token.')
    if user is None or not getattr(user, 'is_active', False) or getattr(user, 'is_deleted', False):
        return None, HttpResponseForbidden('Invalid or expired token.')
    return user, None


def secure_media_serve(request, path):
    user, auth_error = _authenticate_media_user(request)
    if auth_error:
        return auth_error

    module = _module_for_media_path(path)
    if not _user_can_view_module(user, module):
        return HttpResponseForbidden('You do not have permission to access this file.')
    if not _user_can_access_media_object(user, path):
        return HttpResponseForbidden('You do not have permission to access this file.')

    try:
        fullpath = safe_join(str(settings.MEDIA_ROOT), path)
    except ValueError as exc:
        raise Http404('Invalid media path') from exc
    if not fullpath or not os.path.isfile(fullpath):
        raise Http404('Media file not found')

    content_type = _content_type_for(fullpath)
    size = os.path.getsize(fullpath)
    start, end = 0, max(size - 1, 0)
    status = 200

    range_header = request.META.get('HTTP_RANGE', '').strip()
    if range_header and size:
        match = re.match(r'bytes=(\d*)-(\d*)', range_header)
        if not match:
            resp = HttpResponse(status=416)
            resp['Content-Range'] = f'bytes */{size}'
            return resp
        if match.group(1):
            start = int(match.group(1))
        if match.group(2):
            end = int(match.group(2))
        end = min(end, size - 1)
        if start < 0 or start > end or start >= size:
            resp = HttpResponse(status=416)
            resp['Content-Range'] = f'bytes */{size}'
            return resp
        status = 206

    length = end - start + 1 if size else 0
    body = _RangedFile(fullpath, start, length)
    if isinstance(request, ASGIRequest):
        body = _AsyncRangedFile(body)
    response = StreamingHttpResponse(
        body,
        content_type=content_type,
        status=status,
    )
    response['Accept-Ranges'] = 'bytes'
    response['Content-Length'] = str(length)
    response['Content-Type'] = content_type
    response['Content-Disposition'] = 'inline'
    # Prevent JWT-in-query from leaking via Referer when the browser follows links.
    response['Referrer-Policy'] = 'no-referrer'
    response['Cache-Control'] = 'private, no-store'
    if status == 206:
        response['Content-Range'] = f'bytes {start}-{end}/{size}'
    return response
