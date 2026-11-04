"""Liveness and readiness probes — no secrets, no customer payloads."""
from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET


@never_cache
@require_GET
def health(request):
    """Liveness: process is up. Does not touch DB/Redis."""
    return JsonResponse({'status': 'ok'})


@never_cache
@require_GET
def ready(request):
    """Readiness: safe for load balancer to send traffic.

    Returns 200 only when the default DB answers a trivial query.
    Redis is optional — failure is reported but does not fail readiness
    unless READY_REQUIRE_REDIS=1 (multi-instance shared-cache mode).
    """
    import os

    checks = {'database': 'ok', 'redis': 'skipped'}
    status = 200

    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except Exception:
        checks['database'] = 'error'
        status = 503

    redis_required = os.environ.get('READY_REQUIRE_REDIS', '').lower() in ('1', 'true', 'yes')
    try:
        cache.set('ready_probe', '1', 5)
        if cache.get('ready_probe') != '1':
            raise RuntimeError('cache round-trip failed')
        checks['redis'] = 'ok'
    except Exception:
        checks['redis'] = 'error'
        if redis_required:
            status = 503

    body = {'status': 'ready' if status == 200 else 'not_ready', 'checks': checks}
    return JsonResponse(body, status=status)
