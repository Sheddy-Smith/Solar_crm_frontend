"""Durable Lead → BOM Draft quotation outbox (BUG-04).

Lead persistence must not roll back when quotation generation fails.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import timedelta

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

logger = logging.getLogger(__name__)


def _safe_error(exc):
    name = type(exc).__name__
    code = re.sub(r'[^A-Za-z0-9_]', '', name)[:64] or 'BomDraftError'
    return code, f'BOM draft quotation failed ({code}). See server logs.'


def ensure_lead_bom_draft_outbox_pending(lead, user=None):
    """Upsert pending outbox row in the caller's transaction (Lead save)."""
    from .models import LeadBomDraftOutbox

    capacity = (getattr(lead, 'estimated_capacity', None) or '')[:50]
    sync, _created = LeadBomDraftOutbox.objects.get_or_create(
        lead=lead,
        defaults={
            'requested_by': user if getattr(user, 'pk', None) else None,
            'status': LeadBomDraftOutbox.STATUS_PENDING,
            'capacity_snapshot': capacity,
        },
    )
    updates = []
    if capacity and sync.capacity_snapshot != capacity:
        sync.capacity_snapshot = capacity
        updates.append('capacity_snapshot')
    if user and sync.requested_by_id is None:
        sync.requested_by = user
        updates.append('requested_by')
    if sync.status in (
        LeadBomDraftOutbox.STATUS_SUCCESS,
        LeadBomDraftOutbox.STATUS_FAILED,
        LeadBomDraftOutbox.STATUS_SKIPPED,
        LeadBomDraftOutbox.STATUS_PROCESSING,
    ):
        # Re-queue on subsequent lead capacity saves.
        sync.status = LeadBomDraftOutbox.STATUS_PENDING
        updates.append('status')
        sync.last_error = ''
        sync.last_error_code = ''
        sync.last_skip_reason = ''
        updates.extend(['last_error', 'last_error_code', 'last_skip_reason'])
    if updates:
        sync.save(update_fields=[*updates, 'updated_at'])
    return sync


def claim_lead_bom_draft_outbox(lead_id):
    """Atomically claim a pending/failed/stale-processing outbox row."""
    from .models import LeadBomDraftOutbox

    now = timezone.now()
    stale_before = now - timedelta(seconds=LeadBomDraftOutbox.LOCK_STALE_SECONDS)
    token = str(uuid.uuid4())

    with transaction.atomic():
        qs = (
            LeadBomDraftOutbox.objects.select_for_update()
            .filter(lead_id=lead_id)
            .filter(
                Q(status__in=[
                    LeadBomDraftOutbox.STATUS_PENDING,
                    LeadBomDraftOutbox.STATUS_FAILED,
                ])
                | Q(
                    status=LeadBomDraftOutbox.STATUS_PROCESSING,
                    locked_at__lt=stale_before,
                )
            )
        )
        sync = qs.first()
        if sync is None:
            return None
        if sync.attempts >= LeadBomDraftOutbox.MAX_ATTEMPTS:
            LeadBomDraftOutbox.objects.filter(pk=sync.pk).update(
                status=LeadBomDraftOutbox.STATUS_FAILED,
                last_error_code='MaxAttempts',
                last_error='BOM draft outbox exceeded max attempts.',
                lock_token='',
                locked_at=None,
                updated_at=now,
            )
            return None
        LeadBomDraftOutbox.objects.filter(pk=sync.pk).update(
            status=LeadBomDraftOutbox.STATUS_PROCESSING,
            locked_at=now,
            lock_token=token,
            attempts=F('attempts') + 1,
            updated_at=now,
        )
        sync.refresh_from_db()
        if sync.lock_token != token:
            return None
        return sync


def finalize_lead_bom_draft_outbox(sync, token, *, fields):
    """Apply terminal status only if this worker still owns lock_token.

    Returns True when the conditional update matched; False if another worker
    reclaimed the stale lock (caller must not treat its local result as authoritative).
    """
    from .models import LeadBomDraftOutbox

    if not token:
        logger.warning(
            'BOM draft outbox finalize refused — empty lock_token lead_id=%s',
            getattr(sync, 'lead_id', None),
        )
        return False

    payload = {
        **fields,
        'lock_token': '',
        'locked_at': None,
        'updated_at': timezone.now(),
    }
    updated = LeadBomDraftOutbox.objects.filter(
        pk=sync.pk,
        lock_token=token,
        status=LeadBomDraftOutbox.STATUS_PROCESSING,
    ).update(**payload)
    if updated != 1:
        logger.warning(
            'BOM draft outbox stale lock lost ownership lead_id=%s sync_id=%s token=%s…',
            getattr(sync, 'lead_id', None),
            getattr(sync, 'pk', None),
            token[:8],
        )
        return False
    sync.refresh_from_db()
    return True


def process_lead_bom_draft_outbox(lead_id, user_id=None):
    """Claim outbox, run maybe_draft_quotation_for_lead, mark success/skip/failed."""
    from apps.accounts.models import User
    from apps.projects.bom_services import maybe_draft_quotation_for_lead

    from .models import Lead, LeadBomDraftOutbox

    sync = claim_lead_bom_draft_outbox(lead_id)
    if sync is None:
        return {'ok': True, 'skipped': True, 'reason': 'not_claimable'}

    token = sync.lock_token
    lead = Lead.objects.filter(pk=lead_id, is_deleted=False).first()
    if not lead:
        owned = finalize_lead_bom_draft_outbox(sync, token, fields={
            'status': LeadBomDraftOutbox.STATUS_FAILED,
            'last_error_code': 'LeadMissing',
            'last_error': 'Lead not found or deleted.',
        })
        return {'ok': False, 'reason': 'lead_missing', 'owned': owned}

    user = None
    if user_id:
        user = User.objects.filter(pk=user_id).first()
    user = user or sync.requested_by or lead.created_by

    try:
        quotation, created, skip = maybe_draft_quotation_for_lead(lead, user=user)
    except Exception as exc:
        code, message = _safe_error(exc)
        logger.exception('BOM draft outbox processing failed lead_id=%s', lead_id)
        owned = finalize_lead_bom_draft_outbox(sync, token, fields={
            'status': LeadBomDraftOutbox.STATUS_FAILED,
            'last_error_code': code,
            'last_error': message,
        })
        return {'ok': False, 'reason': code, 'owned': owned}

    if skip:
        owned = finalize_lead_bom_draft_outbox(sync, token, fields={
            'status': LeadBomDraftOutbox.STATUS_SKIPPED,
            'last_skip_reason': str(skip)[:64],
            'quotation_id': getattr(quotation, 'pk', None),
        })
        if owned:
            logger.info('BOM draft outbox skipped lead_id=%s reason=%s', lead_id, skip)
        return {'ok': True, 'skipped': True, 'reason': skip, 'created': False, 'owned': owned}

    owned = finalize_lead_bom_draft_outbox(sync, token, fields={
        'status': LeadBomDraftOutbox.STATUS_SUCCESS,
        'quotation_id': getattr(quotation, 'pk', None),
        'last_skip_reason': '',
        'last_error': '',
        'last_error_code': '',
    })
    if owned:
        logger.info(
            'BOM draft outbox success lead_id=%s quotation_id=%s created=%s',
            lead_id, getattr(quotation, 'pk', None), created,
        )
    else:
        logger.warning(
            'BOM draft outbox success ignored — lock lost lead_id=%s quotation_id=%s',
            lead_id, getattr(quotation, 'pk', None),
        )
    return {
        'ok': True,
        'created': created,
        'quotation_id': getattr(quotation, 'pk', None),
        'owned': owned,
    }


def enqueue_lead_bom_draft_after_commit(lead, user=None):
    """Write pending outbox with the Lead, then process without blocking Lead success.

    Immediate process keeps TestCase/API behaviour consistent. on_commit schedules a
    pending/failed retry after the outer transaction commits (production nested atomics).
    Failures never raise to the Lead save path.
    """
    ensure_lead_bom_draft_outbox_pending(lead, user=user)
    lead_id = lead.pk
    user_id = getattr(user, 'pk', None) or getattr(lead.created_by, 'pk', None)

    def _run():
        try:
            process_lead_bom_draft_outbox(lead_id, user_id=user_id)
        except Exception:
            logger.exception('BOM draft outbox process failed lead_id=%s', lead_id)

    _run()

    def _retry_if_needed():
        from .models import LeadBomDraftOutbox
        row = LeadBomDraftOutbox.objects.filter(lead_id=lead_id).first()
        if row and row.status in (
            LeadBomDraftOutbox.STATUS_PENDING,
            LeadBomDraftOutbox.STATUS_FAILED,
        ):
            _run()

    transaction.on_commit(_retry_if_needed)
