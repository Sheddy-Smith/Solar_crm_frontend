"""Serve /media/<path> only to authenticated users (BUG-047).

Browsers can't attach an Authorization header to <img>/<video>/<a> requests, so
the frontend appends the JWT as ?access=<token> (see getMediaUrl in src/api.js).
A normal Authorization: Bearer header is also accepted for API/tooling use.

Video playback on mobile needs:
  - a correct Content-Type (X-Content-Type-Options: nosniff is on in production)
  - HTTP Range / Accept-Ranges so <video> can seek and read duration
"""
import mimetypes
import os
import re
from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpResponse, HttpResponseForbidden, StreamingHttpResponse
from django.utils._os import safe_join
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

mimetypes.add_type('video/webm', '.webm')
mimetypes.add_type('video/mp4', '.m4v')

_VIDEO_TYPES = {
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.mov': 'video/quicktime',
}


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


def _content_type_for(path):
    ext = Path(path).suffix.lower()
    if ext in _VIDEO_TYPES:
        return _VIDEO_TYPES[ext]
    guessed, _ = mimetypes.guess_type(path)
    return guessed or 'application/octet-stream'


def _authenticate_media(request):
    token = request.GET.get('access') or ''
    if not token:
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[len('Bearer '):]
    if not token:
        return HttpResponseForbidden('Authentication required to access this file.')
    try:
        JWTAuthentication().get_validated_token(token)
    except (InvalidToken, TokenError):
        return HttpResponseForbidden('Invalid or expired token.')
    return None


def secure_media_serve(request, path):
    auth_error = _authenticate_media(request)
    if auth_error:
        return auth_error

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
    response = StreamingHttpResponse(
        _RangedFile(fullpath, start, length),
        content_type=content_type,
        status=status,
    )
    response['Accept-Ranges'] = 'bytes'
    response['Content-Length'] = str(length)
    response['Content-Type'] = content_type
    response['Content-Disposition'] = 'inline'
    if status == 206:
        response['Content-Range'] = f'bytes {start}-{end}/{size}'
    return response
