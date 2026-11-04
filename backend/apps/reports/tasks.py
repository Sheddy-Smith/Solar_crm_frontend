"""Background report/export tasks — Celery when Redis available, eager otherwise."""
from __future__ import annotations

import csv
import logging
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)

EXPORT_CACHE_TTL = 60 * 60  # 1 hour


def _export_dir() -> Path:
    root = Path(settings.MEDIA_ROOT) / 'exports'
    root.mkdir(parents=True, exist_ok=True)
    return root


def _status_key(task_id: str) -> str:
    return f'report_export:{task_id}'


def set_export_status(task_id: str, payload: dict) -> None:
    cache.set(_status_key(task_id), payload, EXPORT_CACHE_TTL)


def get_export_status(task_id: str) -> dict | None:
    return cache.get(_status_key(task_id))


@shared_task(
    bind=True,
    name='reports.export_leads_csv',
    autoretry_for=(OSError, ConnectionError),
    retry_backoff=True,
    retry_kwargs={'max_retries': 3},
    soft_time_limit=120,
    time_limit=180,
    acks_late=True,
)
def export_leads_csv(self, user_id: int, filters: dict | None = None):
    """Idempotent lead CSV export keyed by Celery task id."""
    from apps.leads.models import Lead

    task_id = self.request.id or f'eager-{timezone.now().timestamp()}'
    filters = filters or {}
    set_export_status(task_id, {'status': 'running', 'progress': 0})

    qs = Lead.objects.filter(is_deleted=False).select_related('assigned_to', 'created_by')
    status = filters.get('status')
    if status:
        qs = qs.filter(status=status)

    out_path = _export_dir() / f'leads_{user_id}_{task_id}.csv'
    # Idempotent: if file already exists for this task id, reuse it.
    if out_path.exists() and out_path.stat().st_size > 0:
        rel = str(out_path.relative_to(settings.MEDIA_ROOT)).replace('\\', '/')
        payload = {'status': 'done', 'path': rel, 'rows': None}
        set_export_status(task_id, payload)
        return payload

    rows = 0
    with out_path.open('w', newline='', encoding='utf-8') as fh:
        writer = csv.writer(fh)
        writer.writerow([
            'id', 'customer_name', 'mobile_number', 'ivrs_number', 'status',
            'city', 'assigned_to', 'created_at',
        ])
        for lead in qs.iterator(chunk_size=500):
            writer.writerow([
                lead.id,
                lead.customer_name,
                lead.mobile_number,
                lead.ivrs_number,
                lead.status,
                lead.city,
                getattr(lead.assigned_to, 'name', '') or '',
                lead.created_at.isoformat() if lead.created_at else '',
            ])
            rows += 1
            if rows % 500 == 0:
                set_export_status(task_id, {'status': 'running', 'progress': rows})

    rel = str(out_path.relative_to(settings.MEDIA_ROOT)).replace('\\', '/')
    payload = {'status': 'done', 'path': rel, 'rows': rows}
    set_export_status(task_id, payload)
    logger.info('export_leads_csv done task=%s rows=%s user=%s', task_id, rows, user_id)
    return payload


@shared_task(
    bind=True,
    name='reports.bulk_notify_stub',
    soft_time_limit=60,
    time_limit=90,
    acks_late=True,
)
def bulk_notify_stub(self, user_ids: list[int], title: str, body: str):
    """Safe bulk notification fan-out stub (no external push yet)."""
    from django.db import IntegrityError
    from apps.notifications.models import Notification

    task_id = self.request.id or f'eager-notify-{timezone.now().timestamp()}'
    created = 0
    for uid in user_ids:
        dedupe = f'reports-bulk:{task_id}:{uid}'
        try:
            Notification.objects.create(
                user_id=uid,
                title=(title or 'Report')[:255],
                message=(body or '')[:2000],
                module='Reports',
                category='General',
                severity='info',
                dedupe_key=dedupe,
            )
            created += 1
        except IntegrityError:
            # Same task/user already notified — idempotent success.
            continue
        except Exception:
            logger.exception('bulk_notify failed user=%s task=%s', uid, task_id)
    return {'status': 'done', 'created': created, 'task_id': task_id}


@shared_task(
    bind=True,
    name='reports.export_leads_xlsx',
    autoretry_for=(OSError, ConnectionError),
    retry_backoff=True,
    retry_kwargs={'max_retries': 3},
    soft_time_limit=180,
    time_limit=240,
    acks_late=True,
)
def export_leads_xlsx(self, user_id: int, filters: dict | None = None):
    """Excel export of leads (openpyxl). Idempotent by task id file path."""
    from apps.leads.models import Lead

    task_id = self.request.id or f'eager-xlsx-{timezone.now().timestamp()}'
    filters = filters or {}
    set_export_status(task_id, {'status': 'running', 'progress': 0, 'format': 'xlsx'})

    out_path = _export_dir() / f'leads_{user_id}_{task_id}.xlsx'
    if out_path.exists() and out_path.stat().st_size > 0:
        rel = str(out_path.relative_to(settings.MEDIA_ROOT)).replace('\\', '/')
        payload = {'status': 'done', 'path': rel, 'rows': None, 'format': 'xlsx'}
        set_export_status(task_id, payload)
        return payload

    try:
        from openpyxl import Workbook
    except ImportError:
        # Fallback: queue/run the CSV task (bound Celery task — do not call bare).
        logger.warning('openpyxl missing — falling back to CSV for task=%s', task_id)
        return export_leads_csv.apply(args=(user_id, filters)).get()

    qs = Lead.objects.filter(is_deleted=False).select_related('assigned_to')
    status = filters.get('status')
    if status:
        qs = qs.filter(status=status)

    wb = Workbook(write_only=True)
    ws = wb.create_sheet('Leads')
    ws.append([
        'id', 'customer_name', 'mobile_number', 'ivrs_number', 'status',
        'city', 'assigned_to', 'created_at',
    ])
    rows = 0
    for lead in qs.iterator(chunk_size=500):
        ws.append([
            lead.id,
            lead.customer_name,
            lead.mobile_number,
            lead.ivrs_number,
            lead.status,
            lead.city,
            getattr(lead.assigned_to, 'name', '') or '',
            lead.created_at.isoformat() if lead.created_at else '',
        ])
        rows += 1
        if rows % 500 == 0:
            set_export_status(task_id, {'status': 'running', 'progress': rows, 'format': 'xlsx'})
    wb.save(out_path)
    rel = str(out_path.relative_to(settings.MEDIA_ROOT)).replace('\\', '/')
    payload = {'status': 'done', 'path': rel, 'rows': rows, 'format': 'xlsx'}
    set_export_status(task_id, payload)
    logger.info('export_leads_xlsx done task=%s rows=%s user=%s', task_id, rows, user_id)
    return payload


@shared_task(
    bind=True,
    name='media.process_image_thumbnail',
    autoretry_for=(OSError,),
    retry_backoff=True,
    retry_kwargs={'max_retries': 2},
    soft_time_limit=60,
    time_limit=90,
    acks_late=True,
)
def process_image_thumbnail(self, relative_path: str, max_size: int = 512):
    """Create a JPEG thumbnail beside the source image. Idempotent if thumb exists."""
    task_id = self.request.id or f'eager-thumb-{timezone.now().timestamp()}'
    src = Path(settings.MEDIA_ROOT) / relative_path
    if not src.exists() or not src.is_file():
        logger.error('thumbnail source missing path=%s task=%s', relative_path, task_id)
        return {'status': 'error', 'reason': 'missing', 'task_id': task_id}

    thumb = src.with_name(f'{src.stem}_thumb{src.suffix or ".jpg"}')
    if thumb.exists() and thumb.stat().st_size > 0:
        rel = str(thumb.relative_to(settings.MEDIA_ROOT)).replace('\\', '/')
        return {'status': 'done', 'path': rel, 'cached': True, 'task_id': task_id}

    try:
        from PIL import Image
    except ImportError:
        logger.exception('Pillow missing — cannot thumbnail task=%s', task_id)
        return {'status': 'error', 'reason': 'pillow_missing', 'task_id': task_id}

    with Image.open(src) as im:
        im = im.convert('RGB')
        im.thumbnail((max_size, max_size))
        im.save(thumb, format='JPEG', quality=82, optimize=True)

    rel = str(thumb.relative_to(settings.MEDIA_ROOT)).replace('\\', '/')
    logger.info('thumbnail done task=%s path=%s', task_id, rel)
    return {'status': 'done', 'path': rel, 'cached': False, 'task_id': task_id}


@shared_task(
    bind=True,
    name='leads.import_leads_csv',
    autoretry_for=(OSError, ConnectionError),
    retry_backoff=True,
    retry_kwargs={'max_retries': 2},
    soft_time_limit=300,
    time_limit=360,
    acks_late=True,
)
def import_leads_csv(self, user_id: int, relative_path: str):
    """Large lead CSV import. Idempotent via cache lock keyed by task id + file hash."""
    import hashlib
    from apps.leads.models import Lead

    task_id = self.request.id or f'eager-import-{timezone.now().timestamp()}'
    src = Path(settings.MEDIA_ROOT) / relative_path
    if not src.exists():
        return {'status': 'error', 'reason': 'missing_file', 'task_id': task_id}

    digest = hashlib.sha256(src.read_bytes()).hexdigest()[:16]
    lock_key = f'lead_import:{digest}:{user_id}'
    prior = cache.get(lock_key)
    if prior and prior.get('status') == 'done':
        return prior

    set_export_status(task_id, {'status': 'running', 'progress': 0})
    created = 0
    skipped = 0
    with src.open('r', encoding='utf-8-sig', newline='') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            mobile = (row.get('mobile_number') or row.get('mobile') or '').strip()
            name = (row.get('customer_name') or row.get('name') or '').strip()
            if not mobile or not name:
                skipped += 1
                continue
            # Soft idempotency: skip exact mobile already present.
            if Lead.objects.filter(is_deleted=False, mobile_number=mobile).exists():
                skipped += 1
                continue
            Lead.objects.create(
                customer_name=name[:200],
                mobile_number=mobile[:15],
                city=(row.get('city') or '')[:100],
                status=(row.get('status') or 'New')[:50],
                created_by_id=user_id,
            )
            created += 1
            if created % 100 == 0:
                set_export_status(task_id, {'status': 'running', 'progress': created})

    payload = {'status': 'done', 'created': created, 'skipped': skipped, 'task_id': task_id}
    cache.set(lock_key, payload, EXPORT_CACHE_TTL)
    set_export_status(task_id, payload)
    logger.info('import_leads_csv done task=%s created=%s skipped=%s', task_id, created, skipped)
    return payload
