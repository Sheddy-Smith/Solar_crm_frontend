"""Read-only inventory reconciliation — detect ledger mismatches without rewriting data."""

from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce

from .models import InventoryItem, StockMovement


def _d(v):
    return Decimal(str(v or 0))


def _movement_signed_qty(movement_type, quantity, to_warehouse_id=None, from_warehouse_id=None):
    qty = _d(quantity)
    if movement_type == 'Inward':
        return qty
    if movement_type == 'Outward':
        return -qty
    if movement_type == 'Adjustment':
        if to_warehouse_id:
            return qty
        if from_warehouse_id:
            return -qty
    return Decimal('0')


def build_stock_reconciliation(*, project_id=None, warehouse_id=None, item_id=None,
                               date_from=None, date_to=None, limit=200):
    """Return mismatch / risk findings for inventory audit UI (read-only)."""
    items_qs = InventoryItem.objects.select_related('warehouse').filter(is_active=True)
    if item_id:
        items_qs = items_qs.filter(pk=item_id)
    if warehouse_id:
        items_qs = items_qs.filter(warehouse_id=warehouse_id)

    balance_mismatches = []
    negative_stock = []
    for item in items_qs.order_by('name')[:limit]:
        item_movs = StockMovement.objects.filter(item_id=item.id)
        if date_from:
            item_movs = item_movs.filter(created_at__date__gte=date_from)
        if date_to:
            item_movs = item_movs.filter(created_at__date__lte=date_to)
        expected = Decimal('0')
        for m in item_movs.only(
            'movement_type', 'quantity', 'to_warehouse_id', 'from_warehouse_id',
        ).iterator():
            expected += _movement_signed_qty(
                m.movement_type, m.quantity, m.to_warehouse_id, m.from_warehouse_id,
            )
        recorded = _d(item.current_stock)
        diff = recorded - expected
        if diff != 0:
            balance_mismatches.append({
                'type': 'balance_mismatch',
                'item_id': item.id,
                'item_name': item.name,
                'warehouse': item.warehouse.name if item.warehouse_id else None,
                'expected_balance': float(expected),
                'recorded_balance': float(recorded),
                'difference': float(diff),
            })
        if recorded < 0:
            negative_stock.append({
                'type': 'negative_stock',
                'item_id': item.id,
                'item_name': item.name,
                'recorded_balance': float(recorded),
            })

    # Duplicate document-linked movements (same reference_type + reference_no + item)
    dup_rows = (
        StockMovement.objects.exclude(reference_type='Manual')
        .exclude(reference_no='')
        .values('reference_type', 'reference_no', 'item_id')
        .annotate(cnt=Count('id'))
        .filter(cnt__gt=1)[:limit]
    )
    duplicates = []
    for row in dup_rows:
        item = InventoryItem.objects.filter(pk=row['item_id']).first()
        duplicates.append({
            'type': 'duplicate_document_movement',
            'reference_type': row['reference_type'],
            'reference_no': row['reference_no'],
            'item_id': row['item_id'],
            'item_name': item.name if item else None,
            'count': row['cnt'],
        })

    # Orphan protected movements without matching line link (best-effort)
    from apps.accounts_module.models import (
        PurchaseInvoiceLine, SellInvoiceLine, PurchaseChallanLine, SellChallanLine,
    )
    from apps.projects.models import MaterialPlan

    linked_ids = set()
    for Model in (PurchaseInvoiceLine, SellInvoiceLine, PurchaseChallanLine, SellChallanLine):
        linked_ids.update(
            Model.objects.exclude(stock_movement_id=None).values_list('stock_movement_id', flat=True)
        )
    linked_ids.update(
        MaterialPlan.objects.exclude(stock_movement_id=None).values_list('stock_movement_id', flat=True)
    )
    orphans = []
    orphan_qs = StockMovement.objects.filter(
        reference_type__in=list(StockMovement.SOURCE_PROTECTED_REFERENCE_TYPES),
    ).exclude(id__in=linked_ids)[:limit]
    for m in orphan_qs:
        orphans.append({
            'type': 'orphan_source_movement',
            'movement_id': m.id,
            'reference_type': m.reference_type,
            'reference_no': m.reference_no,
            'item_id': m.item_id,
            'item_name': m.item.name if m.item_id else None,
            'project_id': m.project_id,
            'quantity': float(m.quantity),
        })

    # Missing project where reference is Jobs / Sell Invoice with project-capable docs
    missing_project = []
    for m in StockMovement.objects.filter(
        project_id__isnull=True,
        reference_type__in=('Jobs', 'Sell Invoice', 'Sell Challan', 'Purchase Invoice'),
    ).select_related('item')[:limit]:
        missing_project.append({
            'type': 'missing_project',
            'movement_id': m.id,
            'reference_type': m.reference_type,
            'reference_no': m.reference_no,
            'item_name': m.item.name if m.item_id else None,
        })

    # Double-OUT risk: same project+item has Jobs OUT and Sell Invoice OUT
    double_out = []
    jobs = (
        StockMovement.objects.filter(reference_type='Jobs', movement_type='Outward', project_id__isnull=False)
        .values('project_id', 'item_id')
        .annotate(qty=Coalesce(Sum('quantity'), Decimal('0')))
    )
    for row in jobs:
        sell_out = StockMovement.objects.filter(
            reference_type='Sell Invoice',
            movement_type='Outward',
            project_id=row['project_id'],
            item_id=row['item_id'],
        ).aggregate(qty=Coalesce(Sum('quantity'), Decimal('0')))['qty']
        if sell_out and _d(sell_out) > 0:
            item = InventoryItem.objects.filter(pk=row['item_id']).first()
            double_out.append({
                'type': 'double_out_risk',
                'project_id': row['project_id'],
                'item_id': row['item_id'],
                'item_name': item.name if item else None,
                'jobs_out_qty': float(row['qty']),
                'sell_invoice_out_qty': float(sell_out),
            })

    findings = (
        balance_mismatches + negative_stock + duplicates + orphans + missing_project + double_out
    )
    return {
        'summary': {
            'balance_mismatches': len(balance_mismatches),
            'negative_stock': len(negative_stock),
            'duplicate_document_movements': len(duplicates),
            'orphan_source_movements': len(orphans),
            'missing_project': len(missing_project),
            'double_out_risk': len(double_out),
            'total_findings': len(findings),
        },
        'findings': findings[:limit],
    }


def models_q_warehouse(warehouse_id):
    from django.db.models import Q
    return Q(from_warehouse_id=warehouse_id) | Q(to_warehouse_id=warehouse_id)
