"""BOM lookup, quotation draft seeding, and MaterialPlan generation from BOM versions."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Optional

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone


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


@transaction.atomic
def activate_bom_version(version, user=None):
    """Activate one version; demote other Active versions for same capacity."""
    from .bom_models import BomVersion

    if version.pending_configuration and not version.lines.exists():
        raise ValueError('Cannot activate a BOM with pending configuration and no material lines.')
    BomVersion.objects.filter(
        capacity_config_id=version.capacity_config_id,
        status=BomVersion.STATUS_ACTIVE,
    ).exclude(pk=version.pk).update(status=BomVersion.STATUS_INACTIVE)
    version.status = BomVersion.STATUS_ACTIVE
    if not version.effective_date:
        version.effective_date = timezone.localdate()
    version.pending_configuration = False
    version.save(update_fields=['status', 'effective_date', 'pending_configuration', 'updated_at'])
    return version


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

    Does not overwrite Approved/Sent quotations. Duplicate Draft for same BOM
    is reused unless force_new=True.
    """
    from apps.leads.models import Quotation, QuotationItem

    if bom_version is None:
        bom_version = get_active_bom_version(lead.estimated_capacity)
    if bom_version is None:
        raise ValueError('No active BOM configured for this lead capacity.')
    if bom_version.pending_configuration and not bom_version.lines.exists():
        raise ValueError('Active BOM is still pending configuration (no material lines).')

    existing = (
        Quotation.objects.filter(lead=lead, is_deleted=False, status='Draft', bom_version=bom_version)
        .order_by('-id')
        .first()
    )
    if existing and not force_new:
        return existing, False

    price = bom_version.computed_project_price()
    kw = bom_version.capacity_kw
    quotation = Quotation.objects.create(
        lead=lead,
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
        QuotationItem.objects.create(
            quotation=quotation,
            item_name=line.material_name[:200],
            brand='',
            specification=line.sku or line.category,
            quantity=str(line.quantity),
            unit=line.unit or 'Nos',
            rate=line.unit_price,
            amount=line.line_total,
        )
    quotation.recalculate_totals()
    # Prefer BOM fixed contract price when configured.
    if bom_version.final_project_price is not None:
        quotation.grand_total = bom_version.final_project_price
        quotation.customer_contribution = bom_version.final_project_price
        quotation.save(update_fields=['grand_total', 'customer_contribution', 'updated_at'])
    return quotation, True


@transaction.atomic
def seed_material_plans_from_bom(project, bom_version, quotation=None, replace_undispatched=False):
    """Create MaterialPlan rows from BOM. Never touch dispatched lines.

    If plans already exist for this bom_version tag, skip unless replace_undispatched.
    """
    from .models import MaterialPlan

    note_tag = f'BOM v{bom_version.version_number} ({bom_version.capacity_kw} kW)'
    existing = MaterialPlan.objects.filter(project=project, bom_version=bom_version)
    if existing.exists() and not replace_undispatched:
        return existing.count()

    created = 0
    for line in bom_version.lines.all():
        key_items = (line.material_name or '')[:50]
        plan = MaterialPlan.objects.filter(
            project=project,
            category=line.category or line.material_name[:100],
            items=key_items,
        ).first()
        if plan and MaterialPlan.parse_qty(plan.dispatched_qty) > 0:
            continue
        qty = str(line.quantity)
        value = str(line.line_total)
        payload = {
            'category': (line.category or line.material_name)[:100],
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
            for k, v in payload.items():
                setattr(plan, k, v)
            plan.save()
        else:
            MaterialPlan.objects.create(project=project, **payload)
            created += 1
    return created


def material_plan_shortage_rows(project_ids=None):
    """Shortage = planned - available stock (floored at 0), per MaterialPlan line."""
    from apps.inventory.models import InventoryItem
    from .models import MaterialPlan

    qs = MaterialPlan.objects.select_related('inventory_item', 'project').filter(project__is_deleted=False)
    if project_ids is not None:
        qs = qs.filter(project_id__in=project_ids)

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


def material_shortage_count() -> int:
    return sum(1 for row in material_plan_shortage_rows() if row['shortage_qty'] > 0)
