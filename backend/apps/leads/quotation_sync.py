"""Downstream sync: Quotation → Customer Account/Ledger + Material Planning."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Optional

from django.db import transaction
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

    # Keep lead/project cost mirrors in sync with quotation pricing.
    if not lead.project_cost or _d(lead.project_cost) != amount:
        lead.project_cost = amount
        lead.save(update_fields=['project_cost', 'updated_at'])

    project = getattr(lead, 'projects', None)
    if project is not None:
        for proj in lead.projects.filter(is_deleted=False):
            if not proj.total_value or _d(proj.total_value) != amount:
                # Prefer quotation total when present; update empty or previous quote-backed value.
                proj.total_value = amount
                proj.save(update_fields=['total_value', 'updated_at'])

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

    # If pricing exists but no material lines, keep one planning placeholder.
    if not lines and quotation_amount(quotation) > 0:
        mat = _d(quotation.material_cost)
        lines.append({
            'category': 'Material Supply',
            'items': 'Quoted materials',
            'uom': 'Lot',
            'planned_qty': '1',
            'planned_value': _money_str(mat if mat > 0 else quotation_amount(quotation)),
            'planning_unit_price': mat if mat > 0 else quotation_amount(quotation),
            'inventory_name': 'Material Supply',
            'brand': '',
        })
    return lines


def sync_quotation_to_material_plans(quotation, project=None) -> int:
    """Auto-fill Material Planning from quotation materials (project required)."""
    from apps.projects.models import MaterialPlan, Project

    if getattr(quotation, 'is_deleted', False) or (quotation.status or '') == 'Rejected':
        return 0

    lead = getattr(quotation, 'lead', None)
    if not lead:
        return 0

    if project is None:
        project = (
            Project.objects.filter(lead=lead, is_deleted=False)
            .order_by('-updated_at', '-id')
            .first()
        )
    if project is None:
        return 0

    note_tag = f'{QUOT_PLAN_NOTE_PREFIX}{quotation.quotation_number or quotation.id}'
    desired = _material_lines_from_quotation(quotation)
    if not desired:
        return 0

    created_or_updated = 0
    with transaction.atomic():
        # Refresh auto-seeded undistracted lines for this quotation; keep manual/dispatched.
        stale = MaterialPlan.objects.filter(
            project=project,
            dispatch_notes__startswith=QUOT_PLAN_NOTE_PREFIX,
        )
        for plan in stale:
            if MaterialPlan.parse_qty(plan.dispatched_qty) > 0 or plan.dispatch_status in ('Partial', 'Dispatched', 'Packed'):
                continue
            # Will recreate from desired set below — delete unmatched later.
            plan._quot_refresh = True  # type: ignore[attr-defined]

        existing_by_key = {}
        for plan in MaterialPlan.objects.filter(project=project):
            key = (plan.category.strip().lower(), (plan.items or '').strip().lower())
            existing_by_key.setdefault(key, plan)

        seen_keys = set()
        for row in desired:
            key = (row['category'].strip().lower(), (row['items'] or '').strip().lower())
            seen_keys.add(key)
            inv = _match_inventory_item(row['inventory_name'], row.get('brand') or '')
            plan = existing_by_key.get(key)
            if plan and (
                MaterialPlan.parse_qty(plan.dispatched_qty) > 0
                or plan.dispatch_status in ('Partial', 'Dispatched')
            ):
                continue

            payload = {
                'category': row['category'],
                'items': row['items'],
                'uom': row['uom'],
                'planned_qty': row['planned_qty'],
                'planned_value': row['planned_value'],
                'planning_unit_price': row['planning_unit_price'],
                'status': 'Not Started',
                'dispatch_notes': note_tag[:500],
                'inventory_item': inv,
            }
            if plan:
                for field, value in payload.items():
                    setattr(plan, field, value)
                plan.save()
            else:
                plan = MaterialPlan.objects.create(project=project, **payload)
                existing_by_key[key] = plan
            created_or_updated += 1

        # Remove previous auto-lines for this quote that are no longer in desired and not dispatched.
        for plan in MaterialPlan.objects.filter(project=project, dispatch_notes=note_tag):
            key = (plan.category.strip().lower(), (plan.items or '').strip().lower())
            if key in seen_keys:
                continue
            if MaterialPlan.parse_qty(plan.dispatched_qty) > 0:
                continue
            plan.delete()

    return created_or_updated


def sync_quotation_downstream(quotation, user=None) -> dict:
    """Run ledger + material-plan sync after quotation create/update."""
    entry = sync_quotation_to_customer_ledger(quotation, user=user)
    plans = sync_quotation_to_material_plans(quotation)
    return {
        'ledger_entry_id': getattr(entry, 'id', None),
        'material_plans': plans,
        'amount': float(quotation_amount(quotation)),
    }


def run_quotation_downstream_sync(quotation_id, user_id=None) -> dict:
    """Execute sync and persist durable outbox status for retries."""
    import logging

    from django.contrib.auth import get_user_model
    from django.utils import timezone

    from .models import Quotation, QuotationDownstreamSync

    logger = logging.getLogger(__name__)
    quotation = Quotation.objects.filter(pk=quotation_id, is_deleted=False).first()
    if quotation is None:
        return {'ok': False, 'reason': 'missing'}

    user = None
    if user_id:
        User = get_user_model()
        user = User.objects.filter(pk=user_id).first()

    sync, _ = QuotationDownstreamSync.objects.get_or_create(
        quotation=quotation,
        defaults={'requested_by': user, 'status': QuotationDownstreamSync.STATUS_PENDING},
    )
    if user and sync.requested_by_id is None:
        sync.requested_by = user

    sync.attempts = (sync.attempts or 0) + 1
    try:
        result = sync_quotation_downstream(quotation, user=user)
        sync.status = QuotationDownstreamSync.STATUS_SUCCESS
        sync.last_error = ''
        sync.last_synced_at = timezone.now()
        sync.save(update_fields=['status', 'last_error', 'last_synced_at', 'attempts', 'requested_by', 'updated_at'])
        return {'ok': True, **result}
    except Exception as exc:
        sync.status = QuotationDownstreamSync.STATUS_FAILED
        sync.last_error = str(exc)[:1000]
        sync.save(update_fields=['status', 'last_error', 'attempts', 'requested_by', 'updated_at'])
        logger.exception(
            'Quotation downstream sync failed for quotation_id=%s number=%s',
            quotation.pk,
            getattr(quotation, 'quotation_number', ''),
        )
        return {'ok': False, 'error': str(exc)}


def enqueue_quotation_downstream_sync(quotation, user=None):
    """Schedule durable sync after the surrounding DB transaction commits."""
    from django.db import transaction

    quotation_id = getattr(quotation, 'pk', None)
    if not quotation_id:
        return
    user_id = getattr(user, 'pk', None) if user is not None else None

    def _run():
        run_quotation_downstream_sync(quotation_id, user_id=user_id)

    transaction.on_commit(_run)
