"""Log authenticated mutating API calls into UserActivityLog for all roles.

JWT is authenticated inside DRF views, not Django's AuthenticationMiddleware,
so after the response we resolve the actor from session user or Bearer JWT.
Explicit log_user_activity() calls set request._user_activity_logged to avoid
duplicate rows (login, settings, backup, etc.).

Audit rows are written synchronously with retries so a failed background
worker cannot silently drop compliance logs.
"""
from __future__ import annotations

import logging
import re

logger = logging.getLogger('malwa_solar.user_activity')

_MUTATING = frozenset({'POST', 'PUT', 'PATCH', 'DELETE'})

_SKIP_PREFIXES = (
    '/api/v1/auth/token',
    '/api/v1/auth/logout',  # LogoutView logs explicitly with refresh-token user
    '/api/v1/settings/activity-logs',
    '/api/v1/settings/audit-events',
    '/api/v1/notifications',  # high-frequency read/ack noise
    '/health',
    '/ready',
    '/static',
    '/media',
)

_MODULE_BY_PREFIX = (
    ('leads', 'Lead'),
    ('projects', 'Project Management'),
    ('accounts', 'Accounts'),
    ('workforce', 'Employee'),
    ('inventory', 'Inventory'),
    ('om', 'O&M'),
    ('liaisoning', 'L&C'),
    ('daily-tasks', 'Daily Tasks'),
    ('settings', 'Settings'),
    ('users', 'User Management'),
    ('roles', 'User Management'),
    ('branches', 'User Management'),
    ('tele', 'Tele Executive'),
    ('reports', 'Reports'),
    ('insights', 'Insights'),
    ('auth', 'Authentication'),
)

_ACTION_BY_METHOD = {
    'POST': 'Create',
    'PUT': 'Update',
    'PATCH': 'Update',
    'DELETE': 'Delete',
}

_UUID_RE = re.compile(
    r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=/|$)',
    re.I,
)
_ID_RE = re.compile(r'/\d+(?=/|$)')


def _should_skip(path: str) -> bool:
    p = (path or '').rstrip('/') or '/'
    for prefix in _SKIP_PREFIXES:
        if p == prefix.rstrip('/') or p.startswith(prefix.rstrip('/') + '/'):
            return True
        if p.startswith(prefix):
            return True
    return False


def _module_from_path(path: str) -> str:
    # /api/v1/<segment>/...
    parts = [x for x in (path or '').split('/') if x]
    segment = ''
    if len(parts) >= 3 and parts[0] == 'api' and parts[1] == 'v1':
        segment = parts[2]
    elif parts:
        segment = parts[0]
    for key, label in _MODULE_BY_PREFIX:
        if segment == key:
            return label
    return (segment or 'CRM').replace('-', ' ').title()


def _friendly_path(path: str) -> str:
    cleaned = _UUID_RE.sub('/:id', path or '')
    cleaned = _ID_RE.sub('/:id', cleaned)
    return cleaned[:180]


def _resolve_user(request):
    user = getattr(request, 'user', None)
    if user is not None and getattr(user, 'is_authenticated', False):
        return user
    auth = request.META.get('HTTP_AUTHORIZATION', '') or ''
    if not auth.lower().startswith('bearer '):
        return None
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        result = JWTAuthentication().authenticate(request)
        if result:
            return result[0]
    except Exception:
        return None
    return None


class UserActivityAuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._maybe_log(request, response)
        except Exception:
            logger.exception('user activity audit failed')
        return response

    def _maybe_log(self, request, response):
        if getattr(request, '_user_activity_logged', False):
            return
        method = (request.method or '').upper()
        if method not in _MUTATING:
            return
        path = getattr(request, 'path', '') or ''
        if not path.startswith('/api/'):
            return
        if _should_skip(path):
            return
        status_code = int(getattr(response, 'status_code', 0) or 0)
        if status_code < 200 or status_code >= 400:
            # Skip validation noise (400) and auth failures already covered elsewhere.
            return
        user = _resolve_user(request)
        if user is None or not getattr(user, 'is_authenticated', False):
            return

        action = _ACTION_BY_METHOD.get(method, method.title())
        module = _module_from_path(path)
        role = ''
        try:
            role = getattr(getattr(user, 'role', None), 'name', '') or ''
        except Exception:
            role = ''
        who = getattr(user, 'name', '') or getattr(user, 'email', '') or 'User'
        role_bit = f' ({role})' if role else ''
        description = f'{who}{role_bit} — {action} on {module} ({_friendly_path(path)})'
        ip_address = None
        try:
            from apps.crm_settings.services import get_client_ip
            ip_address = get_client_ip(request)
        except Exception:
            ip_address = None

        # Persist synchronously with retries, then mark logged — never flag success
        # before the row exists (async-before-mark dropped audits on thread failure).
        import time
        from apps.crm_settings.models import UserActivityLog

        user_id = getattr(user, 'pk', None)
        user_name = who
        last_exc = None
        for attempt in range(3):
            try:
                UserActivityLog.objects.create(
                    user_id=user_id,
                    user_name=user_name,
                    action=action,
                    module=module,
                    description=description,
                    ip_address=ip_address,
                    status='Success',
                )
                request._user_activity_logged = True
                last_exc = None
                break
            except Exception as exc:
                last_exc = exc
                time.sleep(0.05 * (2 ** attempt))
        if last_exc is not None:
            logger.exception('user activity audit failed after retries', exc_info=last_exc)
