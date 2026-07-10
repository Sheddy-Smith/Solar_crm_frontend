"""Enforces apps.crm_settings.models.IpAccessRule allow/block rules against
the requesting client IP (BUG-015).

Previously IP rules were fully CRUD-wired (admin, API, dashboard count) but
never actually consulted by any request path — the feature looked live in
the UI but had zero effect.

Design notes:
- Only enforced when there is at least one *active* Allow rule. Without an
  allow rule configured, IP allow-listing is considered "not turned on" and
  every request passes through — this avoids locking everyone out the
  moment the middleware is deployed, before anyone has configured rules.
- Fail OPEN on any internal error (DB unreachable, migrations not yet run,
  bad CIDR string, etc). This mirrors the fail-open policy already used for
  login throttling in apps/accounts/views.py (CustomTokenObtainPairView) —
  there was a real production incident when a strict/fail-closed check took
  the whole site down, so a broken IP check must never be able to do that
  again.
"""

import ipaddress
import logging

from django.http import JsonResponse

logger = logging.getLogger(__name__)


def get_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _ip_matches(ip, ip_range):
    ip_range = (ip_range or '').strip()
    if not ip_range:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    try:
        if '/' in ip_range:
            return addr in ipaddress.ip_network(ip_range, strict=False)
        return addr == ipaddress.ip_address(ip_range)
    except ValueError:
        return False


class IpAccessMiddleware:
    """Blocks requests whose client IP fails the active IpAccessRule rows."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            blocked, reason = self._check(request)
        except Exception:
            # Fail open — see module docstring. A broken IP check must never
            # be able to take the whole site down.
            logger.exception('IpAccessMiddleware check failed; allowing request through (fail-open).')
            blocked, reason = False, ''

        if blocked:
            self._log_blocked_attempt(request, reason)
            return JsonResponse({'detail': 'Access denied from this IP address.'}, status=403)

        return self.get_response(request)

    def _check(self, request):
        from django.conf import settings
        from apps.crm_settings.models import IpAccessRule

        ip = get_client_ip(request)
        # Vite/webpack dev proxy forwards API calls as 127.0.0.1 — must not
        # block local development when an office LAN allow-list is configured.
        if settings.DEBUG and ip in ('127.0.0.1', '::1'):
            return False, ''

        allow_rules = list(IpAccessRule.objects.filter(is_active=True, rule_type='Allow'))
        if not allow_rules:
            # No allow-list configured — enforcement is effectively off.
            return False, ''

        if not ip:
            ip = get_client_ip(request)
        if not ip:
            return False, ''

        block_rules = IpAccessRule.objects.filter(is_active=True, rule_type='Block')
        for rule in block_rules:
            if _ip_matches(ip, rule.ip_range):
                return True, f'Blocked by rule: {rule.name}'

        for rule in allow_rules:
            if _ip_matches(ip, rule.ip_range):
                return False, ''

        return True, 'No matching allow rule'

    def _log_blocked_attempt(self, request, reason):
        try:
            from apps.crm_settings.models import IpBlockedAttempt

            username = ''
            user = getattr(request, 'user', None)
            if user is not None and getattr(user, 'is_authenticated', False):
                username = getattr(user, 'email', '') or getattr(user, 'name', '') or ''

            IpBlockedAttempt.objects.create(
                ip_address=get_client_ip(request) or '0.0.0.0',
                username=username,
                reason=(reason or '')[:255],
            )
        except Exception:
            logger.exception('IpAccessMiddleware failed to log a blocked attempt.')
