from django.conf import settings
from django.http import HttpResponseForbidden
from django.views.static import serve as django_serve
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


def secure_media_serve(request, path):
    """Serve /media/<path> only to authenticated users (BUG-047).

    Browsers can't attach an Authorization header to <img>/<a> requests, so the
    frontend appends the JWT access token as ?access=<token> (see getMediaUrl in
    src/api.js). We also accept a normal Authorization: Bearer header for API/tooling use.
    """
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

    return django_serve(request, path, document_root=settings.MEDIA_ROOT)
