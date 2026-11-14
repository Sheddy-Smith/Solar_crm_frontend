"""Downstream sync: Quotation → Customer Account/Ledger + Material Planning."""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Optional

from django.db import transaction
from django.db.models import Q
from django.utils import timezone


QUOT_LEDGER_REF_PREFIX = 'QUOT-'
QUOT_PLAN_NOTE_PREFIX = 'Auto from quotation '


def _d(value) -> Decimal:
    try:
        return Decimal(str(value or '0'))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')


def _qty_str(value) -> str:
    raw = str(value or '').strip()
    if not raw:
        return ''
    try:
        q = Decimal(raw.replace(',', ''))
        if q == q.to_integral_value():
            return str(int(q))
        return str(q.normalize())
    except (InvalidOperation, TypeError, ValueError):
        return raw[:50]


def _money_str(value: Decimal) -> str:
    return f'{_d(value).quantize(Decimal("0.01"))}'


def quotation_amount(quotation) -> Decimal:
    if getattr(quotation, 'use_split_gst', False) and quotation.project_cost_with_gst:
        return _d(quotation.project_cost_with_gst)
    return _d(quotation.grand_total)


def quotation_ledger_ref(quotation) -> str:
    return f'{QUOT_LEDGER_REF_PREFIX}{quotation.id}'


def get_or_create_party_for_lead(lead, created_by=None):
    """Ensure a Customer Account exists for any lead (phone = identity)."""
    from apps.accounts_module.models import Account
    from apps.accounts_module.services import find_party_by_phone, normalize_phone

    raw_phone = (lead.mobile_number or '').strip()
    phone = normalize_phone(raw_phone)
    party = find_party_by_phone(phone) if phone else None
    if party is None and lead.customer_name:
        qs = Account.objects.filter(name=lead.customer_name, account_type='Customer')
        if phone:
            qs = qs.filter(phone__in=['', phone, raw_phone])
        party = qs.first()

    if party is None:
        party = Account.objects.create(
            name=lead.customer_name or (f'Customer {phone}' if phone else 'Customer'),
            account_type='Customer',
            phone=phone or raw_phone,
            email=(lead.email or '').strip(),
            address=(lead.address or '').strip(),
            city=(lead.city or '').strip(),
            company=(lead.project_name or '').strip(),
            status='Active',
            created_by=created_by,
        )
        return party

    updates = []
    if phone and normalize_phone(party.phone) != phone:
        party.phone = phone
        updates.append('phone')
    elif not (party.phone or '').strip() and (phone or raw_phone):
        party.phone = phone or raw_phone
        updates.append('phone')
    if not (party.email or '').strip() and lead.email:
        party.email = lead.email
        updates.append('email')
    if not (party.address or '').strip() and lead.address:
        party.address = lead.address
        updates.append('address')
    if not (party.city or '').strip() and lead.city:
        party.city = lead.city
        updates.append('city')
    if not (party.name or '').strip() and lead.customer_name:
        party.name = lead.customer_name
        updates.append('name')
    if updates:
        party.save(update_fields=updates + ['updated_at'])
    return party


def sync_quotation_to_customer_ledger(quotation, user=None) -> Optional[object]:
    """Upsert a Sale (Debit) ledger row for the quotation total on the lead's customer."""
    from apps.accounts_module.models import CustomerLedgerManualEntry
    from apps.accounts_module.services import recalculate_party_balance

    if getattr(quotation, 'is_deleted', False):
        _clear_quotation_ledger(quotation)
        return None

    lead = getattr(quotation, 'lead', None)
    if not lead or getattr(lead, 'is_deleted', False):
        return None

    amount = quotation_amount(quotation)
    ref = quotation_ledger_ref(quotation)
    status = (quotation.status or '').strip()

    if status == 'Rejected' or amount <= 0:
        _clear_quotation_ledger(quotation)
        return None

    party = get_or_create_party_for_lead(lead, created_by=user or quotation.created_by)
    entry_date = quotation.quotation_date or timezone.localdate()
    qno = quotation.quotation_number or f'#{quotation.id}'
    work = f'Quotation {qno} — materials & pricing (Sale)'

    entry = CustomerLedgerManualEntry.objects.filter(party=party, reference_no=ref).first()
    if entry:
        entry.entry_date = entry_date
        entry.entry_type = 'sale'
        entry.amount = amount
        entry.work = work
        entry.save(update_fields=['entry_date', 'entry_type', 'amount', 'work', 'updated_at'])
    else:
        entry = CustomerLedgerManualEntry.objects.create(
            party=party,
            entry_date=entry_date,
            entry_type='sale',
            payment_mode='',
            amount=amount,
            reference_no=ref,
            work=work,
            created_by=user or quotation.created_by,
        )

    # Lead.project_cost / Project.total_value are NOT overwritten here.
    # Direction: Lead Project Cost → new Draft Quotation prefill only.
    # Quotation ↔ Material Planning exchange is Manual Sync only.

    recalculate_party_balance(party.id)
    return entry


def _clear_quotation_ledger(quotation) -> None:
    from apps.accounts_module.models import CustomerLedgerManualEntry
    from apps.accounts_module.services import recalculate_party_balance

    ref = quotation_ledger_ref(quotation)
    rows = list(CustomerLedgerManualEntry.objects.filter(reference_no=ref))
    party_ids = {row.party_id for row in rows}
    for row in rows:
        row.delete()
    for party_id in party_ids:
        recalculate_party_balance(party_id)


def _match_inventory_item(name: str, brand: str = ''):
    from apps.inventory.models import InventoryItem

    label = (name or '').strip()
    if not label:
        return None
    qs = InventoryItem.objects.filter(is_active=True)
    item = qs.filter(name__iexact=label).first()
    if item:
        return item
    if brand:
        branded = f'{brand} {label}'.strip()
        item = qs.filter(name__iexact=branded).first()
        if item:
            return item
    return qs.filter(name__icontains=label[:40]).order_by('id').first()


def _material_lines_from_quotation(quotation) -> list[dict]:
    """Build MaterialPlan-ready rows from quotation items + key plant materials."""
    lines = []
    for it in quotation.items.all():
        qty = _qty_str(it.quantity)
        rate = _d(it.rate)
        amount = _d(it.amount) or (rate * _d(qty))
        name = (it.item_name or '').strip()
        if not name:
            continue
        brand = (it.brand or '').strip()
        label = f'{brand} {name}'.strip() if brand else name
        lines.append({
            'category': name[:100],
            'items': label[:50],
            'uom': (it.unit or 'Nos')[:20],
            'planned_qty': qty,
            'planned_value': _money_str(amount) if amount else '',
            'planning_unit_price': rate if rate > 0 else None,
            'inventory_name': name,
            'brand': brand,
        })

    # Core plant materials from quotation specs (fill when item rows omit them).
    existing_cats = {ln['category'].lower() for ln in lines}
    spec_rows = [
        ('Solar PV Modules', quotation.number_of_panels, 'Nos',
         ' '.join(p for p in [quotation.panel_brand, quotation.panel_model] if p).strip() or 'Solar Panel'),
        ('Solar Inverter', quotation.inverter_quantity, 'Nos',
         ' '.join(p for p in [quotation.inverter_brand, quotation.inverter_model] if p).strip() or 'Inverter'),
        ('Module Mounting Structure', 1 if (quotation.structure_type or quotation.structure_material) else None, 'Set',
         quotation.structure_material or quotation.structure_type or 'Structure'),
    ]
    for category, qty, uom, items in spec_rows:
        if category.lower() in existing_cats:
            continue
        if qty in (None, '', 0, '0'):
            continue
        lines.append({
            'category': category,
            'items': (items or category)[:50],
            'uom': uom,
            'planned_qty': _qty_str(qty),
            'planned_value': '',
            'planning_unit_price': None,
            'inventory_name': items or category,
            'brand': '',
        })

    # Do not invent a catch-all "Material Supply" row when the quotation has no
    # item/spec lines — that double-counts Project P&L once planners add real BOM.
    # Ledger sync still records the quotation total separately.
    return lines


def _plan_is_protected(plan) -> bool:
    from apps.projects.models import MaterialPlan

    return (
        MaterialPlan.parse_qty(plan.dispatched_qty) > 0
        or (plan.dispatch_status or '') in ('Partial', 'Dispatched', 'Packed')
    )


def sync_quotation_to_material_plans(quotation, project=None, *, dry_run: bool = False) -> dict:
    """Sync quotation materials → Material Plans (Manual Sync engine).

    Ownership rules:
    - Prefer matching by source_quotation_id + (category, items).
    - Never overwrite plans owned by another quotation.
    - Never overwrite pure BOM-owned plans.
    - Never reduce/delete protected (dispatched/packed) rows.
    - Always set source_quotation on created/updated rows.
    """
    from apps.projects.models import Project

    result = {
        'created': 0,
        'updated': 0,
        'skipped': 0,
        'protected': 0,
        'conflicts': [],
        'failed': 0,
        'total': 0,
        'material_plans': 0,
    }

    if getattr(quotation, 'is_deleted', False) or (quotation.status or '') == 'Rejected':
        return result

    lead = getattr(quotation, 'lead', None)
    if not lead:
        return result

    if project is None:
        if getattr(quotation, 'project_id', None):
            project = Project.objects.filter(pk=quotation.project_id, is_deleted=False).first()
        if project is None:
            project = (
                Project.objects.filter(lead=lead, is_deleted=False)
                .order_by('-updated_at', '-id')
                .first()
            )
    if project is None:
        return result

    note_tag = f'{QUOT_PLAN_NOTE_PREFIX}{quotation.quotation_number or quotation.id}'
    desired = _material_lines_from_quotation(quotation)
    result['total'] = len(desired)
    if not desired:
        return result

    if dry_run:
        _apply_sync(quotation, project, note_tag, desired, result, dry_run=True)
    else:
        with transaction.atomic():
            _apply_sync(quotation, project, note_tag, desired, result, dry_run=False)
    return result


def _apply_sync(quotation, project, note_tag, desired, result, *, dry_run: bool):
    from django.db.models import Q
    from apps.projects.models import MaterialPlan

    owned_qs = MaterialPlan.objects.filter(project=project, source_quotation_id=quotation.id)
    owned_by_key = {}
    for plan in owned_qs:
        key = (plan.category.strip().lower(), (plan.items or '').strip().lower())
        owned_by_key[key] = plan

    claimable_by_key = {}
    for plan in MaterialPlan.objects.filter(project=project).filter(
        Q(source_quotation__isnull=True) | Q(dispatch_notes=note_tag)
    ):
        if plan.source_quotation_id and plan.source_quotation_id != quotation.id:
            continue
        if plan.bom_version_id and not plan.source_quotation_id:
            if not (plan.dispatch_notes or '').startswith(QUOT_PLAN_NOTE_PREFIX):
                continue
        key = (plan.category.strip().lower(), (plan.items or '').strip().lower())
        claimable_by_key.setdefault(key, plan)

    other_owned_keys = set()
    for plan in MaterialPlan.objects.filter(project=project).exclude(
        Q(source_quotation__isnull=True) | Q(source_quotation_id=quotation.id)
    ):
        key = (plan.category.strip().lower(), (plan.items or '').strip().lower())
        other_owned_keys.add(key)

    seen_keys = set()
    for row in desired:
        key = (row['category'].strip().lower(), (row['items'] or '').strip().lower())
        seen_keys.add(key)
        inv = _match_inventory_item(row['inventory_name'], row.get('brand') or '')

        if key in other_owned_keys and key not in owned_by_key:
            result['skipped'] += 1
            result['conflicts'].append({
                'key': f'{row["category"]}|{row["items"]}',
                'reason': 'owned_by_other_quotation',
                'source_qty': row['planned_qty'],
            })
            continue

        plan = owned_by_key.get(key) or claimable_by_key.get(key)
        if plan and _plan_is_protected(plan):
            result['protected'] += 1
            result['skipped'] += 1
            continue

        payload = {
            'category': row['category'],
            'items': row['items'],
            'uom': row['uom'],
            'planned_qty': row['planned_qty'],
            'planned_value': row['planned_value'],
            'planning_unit_price': row['planning_unit_price'],
            'status': getattr(plan, 'status', None) or 'Not Started',
            'dispatch_notes': note_tag[:500],
            'inventory_item': inv,
            'source_quotation': quotation,
            'bom_version': getattr(quotation, 'bom_version', None),
        }

        if dry_run:
            if plan:
                result['updated'] += 1
            else:
                result['created'] += 1
            continue

        if plan:
            for field, value in payload.items():
                setattr(plan, field, value)
            plan.save()
            result['updated'] += 1
            owned_by_key[key] = plan
        else:
            plan = MaterialPlan.objects.create(project=project, **payload)
            owned_by_key[key] = plan
            result['created'] += 1

    if not dry_run:
        for plan in MaterialPlan.objects.filter(project=project, source_quotation_id=quotation.id):
            key = (plan.category.strip().lower(), (plan.items or '').strip().lower())
            if key in seen_keys:
                continue
            if _plan_is_protected(plan):
                result['protected'] += 1
                result['skipped'] += 1
                continue
            plan.delete()

    result['material_plans'] = result['created'] + result['updated']


def sync_quotation_downstream(quotation, user=None) -> dict:
    """Automatic path after quotation create/update: Customer Ledger only.

    Material Planning is independent — exchange only via Manual Sync APIs.
    """
    entry = sync_quotation_to_customer_ledger(quotation, user=user)
    return {
        'ledger_entry_id': getattr(entry, 'id', None),
        'material_plans': 0,
        'amount': float(quotation_amount(quotation)),
    }


def _sanitize_sync_error(exc) -> tuple[str, str]:
    """Return (safe_code, safe_message) — never store raw exception text in DB."""
    name = type(exc).__name__
    code = re.sub(r'[^A-Za-z0-9_]', '', name)[:64] or 'SyncError'
    return code, f'Downstream sync failed ({code}). See server logs.'


def ensure_quotation_outbox_pending(quotation, user=None):
    """Create/update pending outbox row inside the caller's open transaction."""
    import uuid

    from .models import QuotationDownstreamSync

    sync, created = QuotationDownstreamSync.objects.get_or_create(
        quotation=quotation,
        defaults={
            'requested_by': user if getattr(user, 'pk', None) else None,
            'status': QuotationDownstreamSync.STATUS_PENDING,
            'correlation_id': str(uuid.uuid4()),
        },
    )
    updates = []
    if user and sync.requested_by_id is None:
        sync.requested_by = user
        updates.append('requested_by')
    if sync.status == QuotationDownstreamSync.STATUS_SUCCESS:
        # Quotation changed again — re-queue.
        sync.status = QuotationDownstreamSync.STATUS_PENDING
        updates.append('status')
    elif sync.status == QuotationDownstreamSync.STATUS_FAILED:
        sync.status = QuotationDownstreamSync.STATUS_PENDING
        updates.append('status')
    if not sync.correlation_id:
        sync.correlation_id = str(uuid.uuid4())
        updates.append('correlation_id')
    if updates:
        sync.save(update_fields=[*updates, 'updated_at'])
    return sync


def claim_quotation_outbox(quotation_id):
    """Atomically claim a pending/failed/stale-processing outbox row."""
    import uuid
    from datetime import timedelta

    from django.db.models import F
    from django.utils import timezone

    from .models import QuotationDownstreamSync

    now = timezone.now()
    stale_before = now - timedelta(seconds=QuotationDownstreamSync.LOCK_STALE_SECONDS)
    token = str(uuid.uuid4())

    with transaction.atomic():
        qs = (
            QuotationDownstreamSync.objects.select_for_update()
            .filter(quotation_id=quotation_id)
            .filter(
                Q(status__in=[
                    QuotationDownstreamSync.STATUS_PENDING,
                    QuotationDownstreamSync.STATUS_FAILED,
                ])
                | Q(
                    status=QuotationDownstreamSync.STATUS_PROCESSING,
                    locked_at__lt=stale_before,
                )
            )
        )
        sync = qs.first()
        if sync is None:
            return None
        if sync.attempts >= QuotationDownstreamSync.MAX_ATTEMPTS:
            sync.status = QuotationDownstreamSync.STATUS_FAILED
            sync.last_error_code = 'MaxAttempts'
            sync.last_error = 'Downstream sync exceeded max attempts.'
            sync.save(update_fields=['status', 'last_error_code', 'last_error', 'updated_at'])
            return None
        QuotationDownstreamSync.objects.filter(pk=sync.pk).update(
            status=QuotationDownstreamSync.STATUS_PROCESSING,
            locked_at=now,
            lock_token=token,
            attempts=F('attempts') + 1,
            updated_at=now,
        )
        sync.refresh_from_db()
        if sync.lock_token != token:
            return None
        return sync


def run_quotation_downstream_sync(quotation_id, user_id=None) -> dict:
    """Claim outbox row, run idempotent sync, mark success/failed."""
    import logging

    from django.contrib.auth import get_user_model
    from django.utils import timezone

    from .models import Quotation, QuotationDownstreamSync

    logger = logging.getLogger(__name__)
    sync = claim_quotation_outbox(quotation_id)
    if sync is None:
        existing = QuotationDownstreamSync.objects.filter(quotation_id=quotation_id).first()
        if existing and existing.status == QuotationDownstreamSync.STATUS_SUCCESS:
            return {'ok': True, 'skipped': 'already_success'}
        return {'ok': False, 'reason': 'not_claimable'}

    quotation = Quotation.objects.filter(pk=quotation_id, is_deleted=False).first()
    if quotation is None:
        sync.status = QuotationDownstreamSync.STATUS_FAILED
        sync.last_error_code = 'MissingQuotation'
        sync.last_error = 'Quotation missing or deleted.'
        sync.lock_token = ''
        sync.locked_at = None
        sync.save(update_fields=['status', 'last_error_code', 'last_error', 'lock_token', 'locked_at', 'updated_at'])
        return {'ok': False, 'reason': 'missing'}

    user = None
    if user_id:
        User = get_user_model()
        user = User.objects.filter(pk=user_id).first()
    elif sync.requested_by_id:
        user = sync.requested_by

    try:
        with transaction.atomic():
            result = sync_quotation_downstream(quotation, user=user)
        sync.status = QuotationDownstreamSync.STATUS_SUCCESS
        sync.last_error = ''
        sync.last_error_code = ''
        sync.last_synced_at = timezone.now()
        sync.lock_token = ''
        sync.locked_at = None
        sync.save(update_fields=[
            'status', 'last_error', 'last_error_code', 'last_synced_at',
            'lock_token', 'locked_at', 'updated_at',
        ])
        return {'ok': True, **result}
    except Exception as exc:
        code, safe_msg = _sanitize_sync_error(exc)
        sync.status = QuotationDownstreamSync.STATUS_FAILED
        sync.last_error_code = code
        sync.last_error = safe_msg
        sync.lock_token = ''
        sync.locked_at = None
        sync.save(update_fields=[
            'status', 'last_error', 'last_error_code', 'lock_token', 'locked_at', 'updated_at',
        ])
        logger.exception(
            'Quotation downstream sync failed quotation_id=%s number=%s correlation_id=%s code=%s',
            quotation.pk,
            getattr(quotation, 'quotation_number', ''),
            sync.correlation_id,
            code,
        )
        return {'ok': False, 'error_code': code}


def enqueue_quotation_downstream_sync(quotation, user=None):
    """Persist pending outbox in-transaction, process after commit."""
    quotation_id = getattr(quotation, 'pk', None)
    if not quotation_id:
        return
    ensure_quotation_outbox_pending(quotation, user=user)
    user_id = getattr(user, 'pk', None) if user is not None else None

    def _run():
        run_quotation_downstream_sync(quotation_id, user_id=user_id)

    transaction.on_commit(_run)
