import hashlib
import json
import logging

from django.conf import settings
from django.core.cache import cache
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission

from .services import reports_dashboard
from .tasks import export_leads_csv, export_leads_xlsx, get_export_status, import_leads_csv

logger = logging.getLogger(__name__)

# Short window to collapse client retries into one queued task id.
_EXPORT_DEDUPE_TTL = 45


def _refuse_eager_heavy_export():
    """When Celery is eager (no Redis worker), large exports would block a Gunicorn thread."""
    if not getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        return None
    if getattr(settings, 'ALLOW_EAGER_EXPORTS', False):
        return None
    return Response(
        {
            'detail': 'Large exports require Redis + Celery worker. Set REDIS_URL and run a worker, '
                      'or ALLOW_EAGER_EXPORTS=1 for small local datasets only.',
            'status': 'unavailable',
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def _broker_unavailable(detail: str = ''):
    return Response(
        {
            'detail': detail or (
                'Export could not be queued — Celery broker/Redis is unavailable. '
                'Retry after the broker recovers; no job was created.'
            ),
            'status': 'unavailable',
            'queued': False,
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def _dedupe_key(kind: str, user_id: int, filters: dict) -> str:
    blob = json.dumps({'kind': kind, 'user': user_id, 'filters': filters}, sort_keys=True, default=str)
    digest = hashlib.md5(blob.encode()).hexdigest()
    return f'report_export_submit:{digest}'


def _queue_or_503(task, kind: str, user_id: int, args: tuple, extra_body: dict | None = None):
    """Queue a Celery task or return a controlled 503 — never fake success."""
    refused = _refuse_eager_heavy_export()
    if refused is not None:
        return refused

    filters = args[1] if len(args) > 1 and isinstance(args[1], dict) else {}
    # Import uses (user_id, path) — still dedupe on full args.
    if kind == 'import_leads':
        filters = {'path': args[1] if len(args) > 1 else ''}

    dkey = _dedupe_key(kind, user_id, filters if isinstance(filters, dict) else {'raw': str(filters)})
    try:
        prior = cache.get(dkey)
    except Exception:
        prior = None
    if prior and isinstance(prior, dict) and prior.get('task_id'):
        body = {'task_id': prior['task_id'], 'status': 'queued', 'deduped': True, 'queued': True}
        if extra_body:
            body.update(extra_body)
        return Response(body, status=status.HTTP_202_ACCEPTED)

    try:
        async_result = task.delay(*args)
    except Exception:
        logger.exception('export queue failed kind=%s user=%s', kind, user_id)
        return _broker_unavailable()

    task_id = getattr(async_result, 'id', None)
    if not task_id:
        return _broker_unavailable('Export broker returned no task id; job was not queued.')

    try:
        cache.set(dkey, {'task_id': task_id}, _EXPORT_DEDUPE_TTL)
    except Exception:
        pass

    body = {'task_id': task_id, 'status': 'queued', 'queued': True}
    if extra_body:
        body.update(extra_body)
    return Response(body, status=status.HTTP_202_ACCEPTED)


class ReportsViewSet(viewsets.ViewSet):
    # Cross-module reports dashboard (`/reports/dashboard/`). Gated by
    # Dashboard; Insights covers the Insights sidebar module for future
    # report/export endpoints.
    permission_classes = [HasModulePermission]
    permission_module = 'Dashboard'
    permission_action_map = {
        'dashboard': 'can_view',
        'export_leads': 'can_view',
        'export_leads_xlsx': 'can_view',
        'import_leads': 'can_view',
        'export_status': 'can_view',
    }

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        return Response(reports_dashboard(date_from=date_from, date_to=date_to))

    @action(detail=False, methods=['post'], url_path='export-leads')
    def export_leads(self, request):
        """Queue a CSV export (Celery when Redis is up; eager inline otherwise)."""
        filters = {}
        if request.data.get('status'):
            filters['status'] = request.data.get('status')
        return _queue_or_503(export_leads_csv, 'export_leads_csv', request.user.id, (request.user.id, filters))

    @action(detail=False, methods=['post'], url_path='export-leads-xlsx')
    def export_leads_xlsx(self, request):
        """Queue an Excel export — heavy work off the request thread when Celery runs."""
        filters = {}
        if request.data.get('status'):
            filters['status'] = request.data.get('status')
        return _queue_or_503(
            export_leads_xlsx,
            'export_leads_xlsx',
            request.user.id,
            (request.user.id, filters),
            extra_body={'format': 'xlsx'},
        )

    @action(detail=False, methods=['post'], url_path='import-leads')
    def import_leads(self, request):
        """Queue a large CSV import from an already-uploaded media-relative path."""
        relative_path = (request.data.get('path') or '').strip().lstrip('/')
        if not relative_path or '..' in relative_path:
            return Response({'detail': 'path required'}, status=status.HTTP_400_BAD_REQUEST)
        return _queue_or_503(
            import_leads_csv,
            'import_leads',
            request.user.id,
            (request.user.id, relative_path),
        )

    @action(detail=False, methods=['get'], url_path=r'export-status/(?P<task_id>[^/.]+)')
    def export_status(self, request, task_id=None):
        payload = get_export_status(task_id)
        if not payload:
            return Response({'status': 'unknown', 'task_id': task_id}, status=status.HTTP_404_NOT_FOUND)
        return Response({'task_id': task_id, **payload})
