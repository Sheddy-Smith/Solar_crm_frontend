"""Serve /media/<path> only to authenticated users with module + object ACL.

Browsers can't attach an Authorization header to <img>/<video>/<a> requests, so
the frontend may append the JWT as ?access=<token> (see getMediaUrl in src/api.js).
A normal Authorization: Bearer header is also accepted for API/tooling use.

Authorization layers:
  1. Valid JWT → active User
  2. Path must match an allow-listed media folder (deny-by-default)
  3. RolePermission.can_view (or full_access) for the mapped module
  4. For lead-scoped roles (Sales / Tele): owning Lead/Project must resolve
     via DB file fields — path folder names alone are never enough
"""
import logging
import mimetypes
import os
import re
from pathlib import Path
from urllib.parse import unquote

from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.handlers.asgi import ASGIRequest
from django.db.models import Q
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
# Folder-boundary matching only — project_images_backup does not match project_images.
_MEDIA_MODULE_PREFIXES = (
    ('lead_survey_photos', 'Lead'),
    ('project_images', 'Project Management'),
    ('project_documents', 'Project Management'),
    ('site_survey_drawings', 'Project Management'),
    ('site_survey_photos', 'Project Management'),
    ('subsidy_docs', 'Project Management'),
    ('approval_docs', 'Project Management'),
    ('expense_docs', 'Project Management'),
    ('sub_cd_docs', 'Project Management'),
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

# Folders that are settings/ops only — no Lead ownership required after module check.
_NO_LEAD_OWNERSHIP_FOLDERS = frozenset({'backups', 'bug_reports', 'workforce'})


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


def normalize_media_path(path):
    """Normalize and reject traversal / encoded traversal attempts."""
    raw = unquote(unquote(path or ''))
    normalized = raw.replace('\\', '/').lstrip('/')
    if not normalized or normalized.startswith('/') or '://' in normalized:
        return None
    parts = []
    for part in normalized.split('/'):
        if part in ('', '.'):
            continue
        if part == '..' or part.startswith('..'):
            return None
        # Reject null bytes and Windows device-ish segments.
        if '\x00' in part or part.lower() in ('con', 'prn', 'aux', 'nul'):
            return None
        parts.append(part)
    if not parts:
        return None
    return '/'.join(parts)


def _module_for_media_path(path):
    normalized = normalize_media_path(path)
    if not normalized:
        return None
    for prefix, module in _MEDIA_MODULE_PREFIXES:
        folder = prefix.rstrip('/')
        if normalized == folder or normalized.startswith(folder + '/'):
            return module
    return None


def _top_folder(path):
    normalized = normalize_media_path(path) or ''
    return normalized.split('/', 1)[0] if normalized else ''


def _user_can_view_module(user, module):
    from apps.accounts.permissions import is_super_admin

    if is_super_admin(user):
        return True
    if not module:
        return False
    role = getattr(user, 'role', None)
    if not role:
        return False
    perm = role.permissions.filter(module=module).first()
    if not perm:
        return False
    return bool(perm.full_access or perm.can_view)


def _file_q(field, path):
    """Match FileField storage name against request path (legacy URL variants)."""
    name = Path(path).name
    return (
        Q(**{field: path})
        | Q(**{f'{field}__endswith': '/' + name})
        | Q(**{field: name})
    )


def _lead_from_project(project):
    if project is None:
        return None
    lead = getattr(project, 'lead', None)
    if lead is not None and not getattr(lead, 'is_deleted', False):
        return lead
    return None


def _resolve_owner_lead(path):
    """Resolve owning Lead via DB file fields. Returns Lead or None."""
    normalized = normalize_media_path(path)
    if not normalized:
        return None
    folder = _top_folder(normalized)

    try:
        if folder == 'lead_survey_photos':
            from apps.leads.models import LeadSurveyPhoto
            photo = (
                LeadSurveyPhoto.objects.filter(_file_q('image', normalized))
                .select_related('survey__lead')
                .first()
            )
            if photo:
                lead = getattr(getattr(photo, 'survey', None), 'lead', None)
                if lead and not getattr(lead, 'is_deleted', False):
                    return lead
            # Fallback: embedded lead<id>_ in folder name (legacy paths).
            match = re.search(r'(?:^|/)lead(\d+)_', normalized)
            if match:
                from apps.leads.models import Lead
                return Lead.objects.filter(pk=int(match.group(1)), is_deleted=False).first()
            return None

        if folder == 'project_images':
            from apps.projects.models import Project
            project = (
                Project.objects.filter(_file_q('project_image', normalized), is_deleted=False)
                .select_related('lead')
                .first()
            )
            return _lead_from_project(project)

        if folder == 'project_documents':
            from apps.projects.models import ProjectDocument
            doc = (
                ProjectDocument.objects.filter(_file_q('file', normalized))
                .select_related('project__lead')
                .first()
            )
            return _lead_from_project(getattr(doc, 'project', None) if doc else None)

        if folder == 'site_survey_drawings':
            from apps.projects.models import SiteSurvey
            survey = (
                SiteSurvey.objects.filter(_file_q('site_drawing', normalized))
                .select_related('project__lead')
                .first()
            )
            return _lead_from_project(getattr(survey, 'project', None) if survey else None)

        if folder == 'site_survey_photos':
            from apps.projects.models import SiteSurveyPhoto
            photo = (
                SiteSurveyPhoto.objects.filter(_file_q('image', normalized))
                .select_related('survey__project__lead')
                .first()
            )
            if photo:
                return _lead_from_project(getattr(getattr(photo, 'survey', None), 'project', None))
            match = re.search(r'(?:^|/)lead(\d+)_', normalized)
            if match:
                from apps.leads.models import Lead
                return Lead.objects.filter(pk=int(match.group(1)), is_deleted=False).first()
            return None

        if folder == 'subsidy_docs':
            from apps.projects.models import SubsidyDocument
            doc = (
                SubsidyDocument.objects.filter(_file_q('file', normalized))
                .select_related('subsidy__project__lead')
                .first()
            )
            subsidy = getattr(doc, 'subsidy', None) if doc else None
            return _lead_from_project(getattr(subsidy, 'project', None) if subsidy else None)

        if folder == 'approval_docs':
            from apps.projects.models import ProjectApprovalDocument
            doc = (
                ProjectApprovalDocument.objects.filter(_file_q('file', normalized))
                .select_related('approval__project__lead')
                .first()
            )
            if doc:
                approval = getattr(doc, 'approval', None)
                return _lead_from_project(getattr(approval, 'project', None) if approval else None)
            return None

        if folder in ('expense_docs', 'sub_cd_docs'):
            # Legacy folders — try generic project document tables if still present.
            return None

        if folder == 'liaison_docs':
            from apps.liaisoning.models import LiaisonDocument
            doc = (
                LiaisonDocument.objects.filter(_file_q('file', normalized))
                .select_related('project__lead')
                .first()
            )
            return _lead_from_project(getattr(doc, 'project', None) if doc else None)

        if folder == 'om_docs':
            from apps.om.models import OmDocument
            doc = OmDocument.objects.filter(_file_q('file', normalized)).select_related('plant').first()
            return _lead_from_om_related(doc)

        if folder == 'om_reports':
            from apps.om.models import OmReport
            report = OmReport.objects.filter(_file_q('file', normalized)).select_related('plant').first()
            return _lead_from_om_related(report)

        if folder == 'om_signatures':
            from apps.om.models import OmSiteVisit
            visit = (
                OmSiteVisit.objects.filter(_file_q('customer_signature', normalized))
                .select_related('plant__project__lead', 'plant__lead', 'project__lead')
                .first()
            )
            if visit is None:
                return None
            lead = _lead_from_om_related(visit)
            if lead:
                return lead
            return _lead_from_project(getattr(visit, 'project', None))

        if folder == 'om_insurance':
            from apps.om.models import OmInsurance
            row = (
                OmInsurance.objects.filter(_file_q('policy_document', normalized))
                .select_related('plant')
                .first()
            )
            return _lead_from_om_related(row)

        if folder == 'amc':
            from apps.amc.models import AmcDocument
            doc = AmcDocument.objects.filter(_file_q('file', normalized)).first()
            # AMC may link via contract/customer rather than Lead — treat as no lead.
            return None if doc is None else None

        if folder == 'workforce':
            from apps.workforce.models import EmployeeDocument
            EmployeeDocument.objects.filter(_file_q('file', normalized)).first()
            return None

        if folder == 'bug_reports':
            from apps.crm_settings.models import BugReportAttachment
            BugReportAttachment.objects.filter(_file_q('file', normalized)).first()
            return None

    except Exception:
        logger.exception('Media owner resolution failed for path=%s', normalized)
        return None
    return None


def _lead_from_om_related(obj):
    if obj is None:
        return None
    plant = getattr(obj, 'plant', None)
    if plant is None:
        return None
    project = getattr(plant, 'project', None)
    if project is not None:
        return _lead_from_project(project)
    # Some O&M plants store lead FK directly.
    lead = getattr(plant, 'lead', None)
    if lead is not None and not getattr(lead, 'is_deleted', False):
        return lead
    return None


def _user_can_access_media_object(user, path):
    from apps.accounts.permissions import is_lead_scoped, is_own_lead, is_super_admin

    if is_super_admin(user):
        return True

    folder = _top_folder(path)
    if folder in _NO_LEAD_OWNERSHIP_FOLDERS:
        return True

    if not is_lead_scoped(user):
        # Managers/admins with module view may open module media.
        return True

    lead = _resolve_owner_lead(path)
    if lead is None:
        # Lead-scoped users cannot open unresolved / foreign paths.
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

    normalized = normalize_media_path(path)
    if not normalized:
        return HttpResponseForbidden('Invalid media path.')

    module = _module_for_media_path(normalized)
    if not _user_can_view_module(user, module):
        return HttpResponseForbidden('You do not have permission to access this file.')
    if not _user_can_access_media_object(user, normalized):
        return HttpResponseForbidden('You do not have permission to access this file.')

    try:
        fullpath = safe_join(str(settings.MEDIA_ROOT), normalized)
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
    response['Referrer-Policy'] = 'no-referrer'
    response['Cache-Control'] = 'private, no-store'
    if status == 206:
        response['Content-Range'] = f'bytes {start}-{end}/{size}'
    return response
