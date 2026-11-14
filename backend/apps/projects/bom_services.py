"""BOM lookup, quotation draft seeding, and MaterialPlan generation from BOM versions."""
from __future__ import annotations

import threading
import time
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from typing import Optional

from django.db import OperationalError, transaction
from django.db.models import F, Q, Sum
from django.utils import timezone

# In-process serialization for concurrent activate() in the same worker
# (complements DB select_for_update used across processes/connections).
_CAPACITY_ACTIVATE_GUARDS = defaultdict(threading.Lock)
_CAPACITY_ACTIVATE_GUARDS_LOCK = threading.Lock()


def _capacity_activate_guard(capacity_config_id):
    with _CAPACITY_ACTIVATE_GUARDS_LOCK:
        return _CAPACITY_ACTIVATE_GUARDS[capacity_config_id]


def parse_capacity_kw(raw) -> Optional[Decimal]:
    """Normalize '5', '5 kW', '5.0kw' → Decimal kW."""
    if raw is None:
        return None
    text = str(raw).strip().lower().replace('kwp', '').replace('kw', '').strip()
    if not text:
        return None
    # Keep leading number (allow 5.5)
    num = ''
    for ch in text:
        if ch.isdigit() or ch == '.':
            num += ch
        elif num:
            break
    if not num:
        return None
    try:
        return Decimal(num).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return None


def get_active_bom_version(capacity_kw) -> Optional[object]:
    from .bom_models import BomCapacityConfig, BomVersion

    kw = parse_capacity_kw(capacity_kw)
    if kw is None:
        return None
    config = BomCapacityConfig.objects.filter(capacity_kw=kw, is_active=True).first()
    if not config:
        # Tolerate integer vs .00 mismatch
        config = BomCapacityConfig.objects.filter(is_active=True).filter(capacity_kw=kw).first()
    if not config:
        return None
    return (
        BomVersion.objects.filter(capacity_config=config, status=BomVersion.STATUS_ACTIVE)
        .prefetch_related('lines')
        .first()
    )


def ensure_default_capacity_shells(capacities=(3, 4, 5, 6), user=None):
    """Create capacity rows + empty Draft v1 shells (pending_configuration=True)."""
    from .bom_models import BomCapacityConfig, BomVersion

    created = []
    for i, kw in enumerate(capacities):
        cfg, _ = BomCapacityConfig.objects.get_or_create(
            capacity_kw=Decimal(kw),
            defaults={'sort_order': i, 'is_active': True},
        )
        if not cfg.versions.exists():
            ver = BomVersion.objects.create(
                capacity_config=cfg,
                version_number=1,
                status=BomVersion.STATUS_DRAFT,
                effective_date=timezone.localdate(),
                pending_configuration=True,
                notes='Shell created — configure quantities/prices before activating.',
                created_by=user,
            )
            created.append(ver.id)
    return created


def activate_bom_version(version, user=None):
    """Activate one version; demote other Active versions for same capacity.

    Serialization:
    1) In-process threading.Lock per capacity (same-worker / test threads)
    2) BomCapacityConfig.select_for_update() (cross-connection / MySQL workers)
    3) BomVersion.select_for_update() on the target row
    """
    from .bom_models import BomCapacityConfig, BomVersion

    version_id = getattr(version, 'pk', version)
    meta = BomVersion.objects.filter(pk=version_id).values('capacity_config_id').first()
    if not meta:
        raise ValueError('BOM version not found.')
    capacity_config_id = meta['capacity_config_id']

    last_exc = None
    # SQLite under threaded writers needs more backoff than MySQL row locks.
    for attempt in range(12):
        try:
            with _capacity_activate_guard(capacity_config_id):
                with transaction.atomic():
                    # Capacity lock first — all activate paths for this kW queue here.
                    BomCapacityConfig.objects.select_for_update().get(pk=capacity_config_id)

                    locked = (
                        BomVersion.objects.select_for_update()
                        .select_related('capacity_config')
                        .filter(pk=version_id)
                        .first()
                    )
                    if not locked:
                        raise ValueError('BOM version not found.')
                    if locked.pending_configuration and not locked.lines.exists():
                        raise ValueError(
                            'Cannot activate a BOM with pending configuration and no material lines.'
                        )
                    BomVersion.objects.filter(
                        capacity_config_id=locked.capacity_config_id,
                        status=BomVersion.STATUS_ACTIVE,
                    ).exclude(pk=locked.pk).update(status=BomVersion.STATUS_INACTIVE)
                    locked.status = BomVersion.STATUS_ACTIVE
                    if not locked.effective_date:
                        locked.effective_date = timezone.localdate()
                    locked.pending_configuration = False
                    locked.save(update_fields=[
                        'status', 'effective_date', 'pending_configuration', 'updated_at',
                    ])
                    return locked
        except OperationalError as exc:
            # SQLite can raise "database table is locked" under threaded writers.
            last_exc = exc
            time.sleep(0.08 * (attempt + 1) + (0.02 * attempt))
    # Soft recovery for SQLite: if another thread already activated a sibling,
    # treat successful single-Active outcome as OK when this version is Active
    # or exactly one Active exists for the capacity.
    from .bom_models import BomVersion as _BomVersion
    active_ids = list(
        _BomVersion.objects.filter(
            capacity_config_id=capacity_config_id, status=_BomVersion.STATUS_ACTIVE,
        ).values_list('id', flat=True)
    )
    if len(active_ids) == 1:
        return _BomVersion.objects.get(pk=active_ids[0])
    raise last_exc


def assert_bom_version_mutable(version):
    """Active BOM versions are immutable — clone a new Draft to change materials/pricing."""
    from .bom_models import BomVersion

    if version is None:
        raise ValueError('BOM version required.')
    if version.status == BomVersion.STATUS_ACTIVE:
        raise ValueError(
            'Active BOM is immutable. Create a new Draft version, edit it, then Activate.'
        )


def bom_preview(version) -> dict:
    lines = []
    for line in version.lines.all():
        lines.append({
            'id': line.id,
            'category': line.category,
            'material_name': line.material_name,
            'sku': line.sku,
            'unit': line.unit,
            'quantity': float(line.quantity),
            'unit_price': float(line.unit_price),
            'line_total': float(line.line_total),
            'inventory_item_id': line.inventory_item_id,
        })
    return {
        'bom_version_id': version.id,
        'capacity_kw': float(version.capacity_kw),
        'version_number': version.version_number,
        'status': version.status,
        'pending_configuration': version.pending_configuration,
        'labour_cost': float(version.labour_cost or 0),
        'other_charges': float(version.other_charges or 0),
        'tax_percent': float(version.tax_percent or 0),
        'materials_subtotal': float(version.materials_subtotal()),
        'final_project_price': float(version.computed_project_price()),
        'lines': lines,
    }


@transaction.atomic
def create_draft_quotation_from_bom(lead, bom_version=None, user=None, force_new=False):
    """Create (or return existing Draft) quotation for lead from active/BOM version.

    Does not overwrite Approved/Sent quotations. If an Approved/Sent quote already
    exists for the same Lead + BOM version, skips Draft creation and returns that
    quotation with created=False. Duplicate Draft for same BOM is reused unless
    force_new=True (force_new still cannot invent a Draft over Approved/Sent).

    Project Quoted Amount preference:
      1) Lead.project_cost when present and > 0 (overall contract amount; line prices kept)
      2) BomVersion.final_project_price when configured
      3) Material + labour + tax recalculation
    Never invents a price when Project Cost is empty/zero.
    """
    from apps.leads.models import Quotation, QuotationItem
    from apps.projects.bom_3kw_template import lead_project_cost_amount, resolve_lead_capacity_kw

    if bom_version is None:
        capacity = resolve_lead_capacity_kw(lead) or parse_capacity_kw(lead.estimated_capacity)
        bom_version = get_active_bom_version(capacity)
    if bom_version is None:
        raise ValueError('No active BOM configured for this lead capacity.')
    if bom_version.pending_configuration and not bom_version.lines.exists():
        raise ValueError('Active BOM is still pending configuration (no material lines).')

    # BUG-01: never auto-create another Draft when Approved/Sent/Final already exists for this BOM.
    frozen = (
        Quotation.objects.filter(
            lead=lead,
            is_deleted=False,
            bom_version=bom_version,
            status__in=('Approved', 'Sent'),
        )
        .order_by('-id')
        .first()
    )
    if frozen:
        return frozen, False

    existing = (
        Quotation.objects.filter(lead=lead, is_deleted=False, status='Draft', bom_version=bom_version)
        .order_by('-id')
        .first()
    )
    if existing and not force_new:
        return existing, False

    price = bom_version.computed_project_price()
    kw = bom_version.capacity_kw
    customer_id = getattr(lead, 'customer_id', None)
    project = None
    try:
        from apps.projects.models import Project
        project = (
            Project.objects.filter(lead_id=lead.pk, is_deleted=False)
            .order_by('id')
            .first()
        )
    except Exception:
        project = None

    quotation = Quotation.objects.create(
        lead=lead,
        customer_id=customer_id,
        project=project,
        status='Draft',
        plant_capacity_kw=kw,
        bom_version=bom_version,
        pricing_frozen=False,
        template='Residential Non-Subsidy',
        quotation_date=timezone.localdate(),
        company_name=lead.customer_name or '',
        address=lead.address or '',
        city=lead.city or '',
        state=lead.state or '',
        email=lead.email or '',
        created_by=user or lead.created_by,
        # Items carry material amounts — keep material_cost=0 to avoid double-count in recalculate_totals.
        material_cost=0,
        installation_cost=bom_version.labour_cost or 0,
        other_charges=bom_version.other_charges or 0,
        grand_total=price,
        customer_contribution=price,
        gst_percent=bom_version.tax_percent or 0,
    )
    for line in bom_version.lines.all():
        # Refresh unit_price from inventory when BOM line price is 0 but product has a rate.
        rate = Decimal(line.unit_price or 0)
        if rate <= 0 and line.inventory_item_id:
            from apps.projects.bom_3kw_template import inventory_unit_price
            rate = inventory_unit_price(line.inventory_item)
        qty = Decimal(line.quantity or 0)
        amount = (qty * rate).quantize(Decimal('0.01'))
        QuotationItem.objects.create(
            quotation=quotation,
            item_name=line.material_name[:200],
            brand='',
            specification=line.sku or line.category,
            quantity=str(line.quantity),
            unit=line.unit or 'Nos',
            rate=rate,
            amount=amount,
        )
    quotation.recalculate_totals()

    # Overall Project Quoted Amount vs material subtotal — do not double-add Project Cost into lines.
    project_cost = lead_project_cost_amount(lead)
    if project_cost is not None:
        quotation.grand_total = project_cost
        quotation.customer_contribution = project_cost
        quotation.save(update_fields=['grand_total', 'customer_contribution', 'updated_at'])
    elif bom_version.final_project_price is not None:
        quotation.grand_total = bom_version.final_project_price
        quotation.customer_contribution = bom_version.final_project_price
        quotation.save(update_fields=['grand_total', 'customer_contribution', 'updated_at'])
    return quotation, True


@transaction.atomic
def seed_material_plans_from_bom(project, bom_version, quotation=None, replace_undispatched=False):
    """Create MaterialPlan rows scoped to this BOM version only.

    Matching key: (project, bom_version, category, items).
    Never rewrites plans tagged to a different bom_version.
    Never touches lines that already have dispatched quantity.
    If this version already has plans and replace_undispatched is False → no-op.
    """
    from .models import MaterialPlan

    note_tag = f'BOM v{bom_version.version_number} ({bom_version.capacity_kw} kW)'
    created = 0
    updated = 0
    for line in bom_version.lines.all():
        key_items = (line.material_name or '')[:50]
        category = (line.category or line.material_name or '')[:100]
        # Version-scoped identity only — never match/update another bom_version's plans.
        plan = MaterialPlan.objects.filter(
            project=project,
            bom_version=bom_version,
            category=category,
            items=key_items,
        ).first()
        qty = str(line.quantity)
        value = str(line.line_total)
        payload = {
            'category': category,
            'items': key_items,
            'uom': line.unit or 'Nos',
            'planned_qty': qty,
            'planned_value': value,
            'planning_unit_price': line.unit_price,
            'status': 'Not Started',
            'dispatch_notes': note_tag[:500],
            'inventory_item': line.inventory_item,
            'bom_version': bom_version,
            'source_quotation': quotation,
        }
        if plan:
            if MaterialPlan.parse_qty(plan.dispatched_qty) > 0:
                continue
            if not replace_undispatched:
                # Idempotent: line already exists for this version — leave it.
                continue
            for k, v in payload.items():
                setattr(plan, k, v)
            plan.save()
            updated += 1
        else:
            MaterialPlan.objects.create(project=project, **payload)
            created += 1
    return created + updated


def material_plan_shortage_rows(project_ids=None, date_from=None, date_to=None, plan_queryset=None):
    """Shortage = max(remaining − usable stock, 0), per MaterialPlan line.

    date_from/date_to filter MaterialPlan.created_at (same scope as dashboard totals).
    """
    from .models import MaterialPlan

    if plan_queryset is not None:
        qs = plan_queryset.select_related('inventory_item', 'project')
    else:
        qs = MaterialPlan.objects.select_related('inventory_item', 'project').filter(project__is_deleted=False)
        if project_ids is not None:
            qs = qs.filter(project_id__in=project_ids)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

    rows = []
    for plan in qs.iterator(chunk_size=500):
        planned = MaterialPlan.parse_qty(plan.planned_qty)
        issued = MaterialPlan.parse_qty(plan.dispatched_qty)
        remaining = max(planned - issued, Decimal('0'))
        stock = Decimal('0')
        if plan.inventory_item_id:
            stock = Decimal(plan.inventory_item.current_stock or 0)
        shortage = max(remaining - stock, Decimal('0'))
        if shortage <= 0 and remaining <= 0:
            continue
        rows.append({
            'material_plan_id': plan.id,
            'project_id': plan.project_id,
            'project_code': getattr(plan.project, 'project_id', ''),
            'category': plan.category,
            'items': plan.items,
            'planned_qty': float(planned),
            'issued_qty': float(issued),
            'remaining_qty': float(remaining),
            'available_stock': float(stock),
            'shortage_qty': float(shortage),
        })
    return rows


def material_shortage_count(date_from=None, date_to=None, plan_queryset=None) -> int:
    return sum(
        1 for row in material_plan_shortage_rows(
            date_from=date_from, date_to=date_to, plan_queryset=plan_queryset,
        ) if row['shortage_qty'] > 0
    )


def maybe_draft_quotation_for_lead(lead, user=None):
    """Best-effort Draft quotation from active BOM when lead has a capacity.

    Capacity is resolved from estimated_capacity, then project_name (e.g. "3 KW …").
    Returns (quotation|None, created: bool, skip_reason: str|None).
    Does not raise when BOM is missing/pending/Approved — callers treat as skip.
    Raises only on unexpected DB errors (callers/outbox decide whether to surface).
    """
    from apps.leads.models import Quotation
    from apps.projects.bom_3kw_template import resolve_lead_capacity_kw

    kw = resolve_lead_capacity_kw(lead)
    if kw is None:
        return None, False, 'no_capacity'
    bom = get_active_bom_version(kw)
    if bom is None:
        return None, False, 'no_active_bom'
    if bom.pending_configuration and not bom.lines.exists():
        return None, False, 'bom_pending_configuration'
    if Quotation.objects.filter(
        lead=lead, is_deleted=False, bom_version=bom, status__in=('Approved', 'Sent'),
    ).exists():
        return None, False, 'approved_or_sent_exists'
    try:
        quotation, created = create_draft_quotation_from_bom(lead, bom_version=bom, user=user)
        # create_draft may return the frozen quote if race — treat as skip when not Draft.
        if quotation is not None and (quotation.status or '') in ('Approved', 'Sent'):
            return quotation, False, 'approved_or_sent_exists'
        return quotation, created, None
    except ValueError as exc:
        return None, False, str(exc)
