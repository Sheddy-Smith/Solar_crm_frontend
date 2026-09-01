import re
from decimal import Decimal, ROUND_HALF_UP
from datetime import date

from django.db import transaction
from django.db.models import Sum

from .models import (
    PurchaseInvoice, SellInvoice, GstOpeningBalance,
)


def _d(value):
    if value is None:
        return Decimal('0')
    return Decimal(str(value))


def _round_money(value):
    return _d(value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def compute_line_total(quantity, rate):
    return _round_money(_d(quantity) * _d(rate))


def compute_gst_amounts(subtotal, extra_total, gst_type, cgst_percent, sgst_percent, igst_percent):
    taxable = _round_money(_d(subtotal) + _d(extra_total))
    cgst = sgst = igst = Decimal('0')
    if gst_type == 'IGST':
        igst = _round_money(taxable * _d(igst_percent) / Decimal('100'))
    else:
        cgst = _round_money(taxable * _d(cgst_percent) / Decimal('100'))
        sgst = _round_money(taxable * _d(sgst_percent) / Decimal('100'))
    gst_amount = _round_money(igst + cgst + sgst)
    total = _round_money(taxable + gst_amount)
    return {
        'subtotal': _round_money(subtotal),
        'extra_charges_total': _round_money(extra_total),
        'gst_amount': gst_amount,
        'total_amount': total,
        'cgst_amount': cgst,
        'sgst_amount': sgst,
        'igst_amount': igst,
    }


def apply_invoice_totals(invoice, lines, extra_charges=None):
    subtotal = sum(_d(line.get('line_total') or compute_line_total(line.get('quantity'), line.get('rate'))) for line in lines)
    extra_total = Decimal('0')
    if extra_charges is not None:
        extra_total = sum(_d(c.get('amount')) for c in extra_charges)
    elif hasattr(invoice, 'extra_charges'):
        extra_total = invoice.extra_charges.aggregate(t=Sum('amount'))['t'] or Decimal('0')

    totals = compute_gst_amounts(
        subtotal,
        extra_total,
        invoice.gst_type,
        invoice.cgst_percent,
        invoice.sgst_percent,
        invoice.igst_percent,
    )
    invoice.subtotal = totals['subtotal']
    if hasattr(invoice, 'extra_charges_total'):
        invoice.extra_charges_total = totals['extra_charges_total']
    invoice.gst_amount = totals['gst_amount']
    invoice.total_amount = totals['total_amount']
    paid = _d(getattr(invoice, 'payment_amount', 0))
    invoice.balance_due = _round_money(totals['total_amount'] - paid)
    return totals


def apply_challan_totals(challan, lines):
    total = sum(_d(line.get('line_total') or compute_line_total(line.get('quantity'), line.get('rate'))) for line in lines)
    challan.total_amount = _round_money(total)
    if hasattr(challan, 'balance_due'):
        paid = _d(challan.payment_amount)
        challan.balance_due = _round_money(total - paid)
    return challan.total_amount


def _initial_next_number(model, field_name, prefix):
    """Best-effort starting point for a brand-new series: one past the highest
    numeric suffix already used for this prefix, so we never collide with
    numbers that were issued before the series row existed. Falls back to the
    row count if nothing parses (e.g. an empty table)."""
    pattern = re.compile(rf'^{re.escape(prefix)}-(\d+)$')
    max_seen = 0
    values = model.objects.filter(
        **{f'{field_name}__startswith': f'{prefix}-'}
    ).values_list(field_name, flat=True)
    for value in values:
        match = pattern.match(value or '')
        if match:
            max_seen = max(max_seen, int(match.group(1)))
    if max_seen:
        return max_seen + 1
    return model.objects.count() + 1


def next_document_number(prefix, model, field_name):
    """Atomically read-and-increment the DocumentNumberSeries row for this
    model/prefix instead of racing on `model.objects.count() + 1` (BUG-014),
    reusing the DocumentNumberSeries model that crm_settings already exposes
    for CRUD but never wired up for actual numbering (BUG-067)."""
    from apps.crm_settings.models import DocumentNumberSeries

    document_type = model.__name__
    with transaction.atomic():
        series, created = DocumentNumberSeries.objects.get_or_create(
            document_type=document_type,
            prefix=prefix,
            defaults={'next_number': 1, 'padding': 5},
        )
        # select_for_update locks the row for the remainder of this
        # transaction so concurrent callers block instead of reading the
        # same next_number and generating duplicate document numbers.
        series = DocumentNumberSeries.objects.select_for_update().get(pk=series.pk)
        if created:
            series.next_number = _initial_next_number(model, field_name, prefix)
        number = series.next_number
        series.next_number = number + 1
        series.save(update_fields=['next_number'])
        padding = series.padding or 5
    return f'{prefix}-{number:0{padding}d}'


def month_start(year, month):
    return date(int(year), int(month), 1)


def gst_split_for_invoice(invoice):
    taxable = _d(invoice.subtotal) + _d(getattr(invoice, 'extra_charges_total', 0))
    if invoice.gst_type == 'IGST':
        igst = _round_money(taxable * _d(invoice.igst_percent) / Decimal('100'))
        return {'igst': float(igst), 'cgst': 0.0, 'sgst': 0.0}
    cgst = _round_money(taxable * _d(invoice.cgst_percent) / Decimal('100'))
    sgst = _round_money(taxable * _d(invoice.sgst_percent) / Decimal('100'))
    return {'igst': 0.0, 'cgst': float(cgst), 'sgst': float(sgst)}


def _resolve_inventory_item(line):
    """Match line to inventory master by FK or material name (legacy MD flow)."""
    from apps.inventory.models import InventoryItem

    if line.inventory_item_id:
        return line.inventory_item

    name = (line.material_name or '').strip()
    if not name:
        return None

    exact = InventoryItem.objects.filter(is_active=True, name__iexact=name).first()
    if exact:
        return exact
    return InventoryItem.objects.filter(is_active=True, name__icontains=name).order_by('id').first()


def _clear_line_movement(line):
    if not line.stock_movement_id:
        return
    movement = line.stock_movement
    line.stock_movement = None
    line.save(update_fields=['stock_movement'])
    movement.delete()


def _apply_received_item_rate(item, rate):
    """Purchase receipt updates inventory purchase cost (InventoryItem.rate)."""
    from apps.inventory.models import InventoryItem

    parsed = _d(rate)
    if parsed <= 0:
        return
    InventoryItem.objects.filter(pk=item.pk).update(rate=parsed)


@transaction.atomic
def sync_inventory_for_purchase_challan(challan, user=None):
    """Purchase Challan Received → StockMovement IN + inventory_items.current_stock (MD §4.2)."""
    from apps.inventory.models import StockMovement, Warehouse

    ref_no = challan.challan_no or f'PC-{challan.id:04d}'
    default_warehouse = Warehouse.objects.filter(is_active=True).order_by('id').first()

    if challan.status != 'Received':
        for line in challan.lines.filter(stock_movement__isnull=False).select_related('stock_movement'):
            _clear_line_movement(line)
        return

    for line in challan.lines.select_related('inventory_item', 'stock_movement').all():
        item = _resolve_inventory_item(line)
        if not item:
            _clear_line_movement(line)
            continue

        if not line.inventory_item_id:
            line.inventory_item = item
            line.save(update_fields=['inventory_item'])

        warehouse = item.warehouse or default_warehouse
        if warehouse is None:
            continue

        notes = f'Purchase challan {ref_no} — {line.material_name}'

        if line.stock_movement_id:
            movement = line.stock_movement
            movement.item = item
            movement.quantity = line.quantity
            movement.rate = line.rate
            movement.movement_type = 'Inward'
            movement.to_warehouse = warehouse
            movement.from_warehouse = None
            movement.reference_type = 'Purchase Challan'
            movement.reference_no = ref_no
            movement.reference = ref_no
            movement.notes = notes
            if user and not movement.created_by_id:
                movement.created_by = user
            movement.save()
        else:
            movement = StockMovement.objects.create(
                item=item,
                movement_type='Inward',
                quantity=line.quantity,
                rate=line.rate,
                to_warehouse=warehouse,
                reference_type='Purchase Challan',
                reference_no=ref_no,
                reference=ref_no,
                notes=notes,
                created_by=user,
            )
            line.stock_movement = movement
            line.save(update_fields=['stock_movement'])

        _apply_received_item_rate(item, line.rate)


@transaction.atomic
def sync_inventory_for_sell_challan(challan, user=None):
    """Sell Challan Dispatched/Delivered → StockMovement OUT (MD §4.3)."""
    from apps.inventory.models import StockMovement, Warehouse

    ref_no = challan.challan_no or f'SC-{challan.id:04d}'
    default_warehouse = Warehouse.objects.filter(is_active=True).order_by('id').first()
    active_statuses = {'Dispatched', 'Delivered'}

    if challan.status not in active_statuses:
        for line in challan.lines.filter(stock_movement__isnull=False).select_related('stock_movement'):
            _clear_line_movement(line)
        return

    for line in challan.lines.select_related('inventory_item', 'stock_movement').all():
        item = _resolve_inventory_item(line)
        if not item:
            _clear_line_movement(line)
            continue

        if not line.inventory_item_id:
            line.inventory_item = item
            line.save(update_fields=['inventory_item'])

        warehouse = item.warehouse or default_warehouse
        if warehouse is None:
            continue

        notes = f'Sell challan {ref_no} — {line.material_name}'

        if line.stock_movement_id:
            movement = line.stock_movement
            movement.item = item
            movement.quantity = line.quantity
            movement.rate = line.rate or item.rate or 0
            movement.movement_type = 'Outward'
            movement.from_warehouse = warehouse
            movement.to_warehouse = None
            movement.reference_type = 'Sell Challan'
            movement.reference_no = ref_no
            movement.reference = ref_no
            movement.notes = notes
            if user and not movement.created_by_id:
                movement.created_by = user
            movement.save()
        else:
            movement = StockMovement.objects.create(
                item=item,
                movement_type='Outward',
                quantity=line.quantity,
                rate=line.rate or item.rate or 0,
                from_warehouse=warehouse,
                reference_type='Sell Challan',
                reference_no=ref_no,
                reference=ref_no,
                notes=notes,
                created_by=user,
            )
            line.stock_movement = movement
            line.save(update_fields=['stock_movement'])


def remove_purchase_challan_stock(challan):
    """Delete linked stock movements before challan removal."""
    for line in challan.lines.select_related('stock_movement').all():
        _clear_line_movement(line)


def remove_sell_challan_stock(challan):
    for line in challan.lines.select_related('stock_movement').all():
        _clear_line_movement(line)


def _sync_document_line_stock(line, *, movement_type, reference_type, ref_no, notes_prefix, user=None):
    """Shared IN/OUT sync for invoice/challan lines linked to inventory_item."""
    from apps.inventory.models import StockMovement, Warehouse

    item = _resolve_inventory_item(line)
    if not item:
        _clear_line_movement(line)
        return

    if not line.inventory_item_id:
        line.inventory_item = item
        line.save(update_fields=['inventory_item'])

    warehouse = item.warehouse or Warehouse.objects.filter(is_active=True).order_by('id').first()
    if warehouse is None:
        return

    notes = f'{notes_prefix} — {line.material_name}'
    inward = movement_type == 'Inward'

    if line.stock_movement_id:
        movement = line.stock_movement
        movement.item = item
        movement.quantity = line.quantity
        movement.rate = line.rate or item.rate or 0
        movement.movement_type = movement_type
        movement.from_warehouse = None if inward else warehouse
        movement.to_warehouse = warehouse if inward else None
        movement.reference_type = reference_type
        movement.reference_no = ref_no
        movement.reference = ref_no
        movement.notes = notes
        if user and not movement.created_by_id:
            movement.created_by = user
        movement.save()
    else:
        movement = StockMovement.objects.create(
            item=item,
            movement_type=movement_type,
            quantity=line.quantity,
            rate=line.rate or item.rate or 0,
            from_warehouse=None if inward else warehouse,
            to_warehouse=warehouse if inward else None,
            reference_type=reference_type,
            reference_no=ref_no,
            reference=ref_no,
            notes=notes,
            created_by=user,
        )
        line.stock_movement = movement
        line.save(update_fields=['stock_movement'])

    if inward:
        _apply_received_item_rate(item, line.rate)


@transaction.atomic
def sync_inventory_for_purchase_invoice(invoice, user=None):
    """Purchase Invoice Recorded/Paid → Stock IN (MD §5.1)."""
    ref_no = invoice.invoice_no or f'PI-{invoice.id:04d}'
    active = invoice.status in {'Recorded', 'Paid'}

    if not active:
        for line in invoice.lines.filter(stock_movement__isnull=False).select_related('stock_movement'):
            _clear_line_movement(line)
        return

    for line in invoice.lines.select_related('inventory_item', 'stock_movement').all():
        _sync_document_line_stock(
            line,
            movement_type='Inward',
            reference_type='Purchase Invoice',
            ref_no=ref_no,
            notes_prefix=f'Purchase invoice {ref_no}',
            user=user,
        )


@transaction.atomic
def sync_inventory_for_sell_invoice(invoice, user=None):
    """Sell Invoice Issued/Paid → Stock OUT (MD §5.3)."""
    ref_no = invoice.invoice_no or f'SI-{invoice.id:04d}'
    active = invoice.status in {'Issued', 'Paid'}

    if not active:
        for line in invoice.lines.filter(stock_movement__isnull=False).select_related('stock_movement'):
            _clear_line_movement(line)
        return

    for line in invoice.lines.select_related('inventory_item', 'stock_movement').all():
        _sync_document_line_stock(
            line,
            movement_type='Outward',
            reference_type='Sell Invoice',
            ref_no=ref_no,
            notes_prefix=f'Sell invoice {ref_no}',
            user=user,
        )


def remove_purchase_invoice_stock(invoice):
    for line in invoice.lines.select_related('stock_movement').all():
        _clear_line_movement(line)


def remove_sell_invoice_stock(invoice):
    for line in invoice.lines.select_related('stock_movement').all():
        _clear_line_movement(line)


def gst_ledger_report(year, month):
    start = month_start(year, month)
    opening = GstOpeningBalance.objects.filter(month=start).first()
    igst_open = float(opening.igst_opening) if opening else 0.0
    cgst_open = float(opening.cgst_opening) if opening else 0.0
    sgst_open = float(opening.sgst_opening) if opening else 0.0

    purchase_qs = PurchaseInvoice.objects.select_related('supplier').filter(
        invoice_date__year=year, invoice_date__month=month,
    ).exclude(status='Cancelled')
    sell_qs = SellInvoice.objects.select_related('party').filter(
        invoice_date__year=year, invoice_date__month=month,
    ).exclude(status='Cancelled')

    entries = []
    input_igst = input_cgst = input_sgst = 0.0
    output_igst = output_cgst = output_sgst = 0.0

    for inv in purchase_qs:
        split = gst_split_for_invoice(inv)
        input_igst += split['igst']
        input_cgst += split['cgst']
        input_sgst += split['sgst']
        entries.append({
            'date': inv.invoice_date.isoformat(),
            'doc_type': 'Purchase Invoice',
            'doc_no': inv.invoice_no or f'PI-{inv.id:04d}',
            'party': inv.supplier_name or (inv.supplier.name if inv.supplier_id else '—'),
            'taxable': float(inv.subtotal) + float(inv.extra_charges_total),
            'igst': split['igst'],
            'cgst': split['cgst'],
            'sgst': split['sgst'],
            'direction': 'input',
        })

    for inv in sell_qs:
        split = gst_split_for_invoice(inv)
        output_igst += split['igst']
        output_cgst += split['cgst']
        output_sgst += split['sgst']
        entries.append({
            'date': inv.invoice_date.isoformat(),
            'doc_type': 'Sell Invoice',
            'doc_no': inv.invoice_no or f'SI-{inv.id:04d}',
            'party': inv.party_name or (inv.party.name if inv.party_id else '—'),
            'taxable': float(inv.subtotal),
            'igst': split['igst'],
            'cgst': split['cgst'],
            'sgst': split['sgst'],
            'direction': 'output',
        })

    entries.sort(key=lambda e: e['date'])

    closing_igst = igst_open + output_igst - input_igst
    closing_cgst = cgst_open + output_cgst - input_cgst
    closing_sgst = sgst_open + output_sgst - input_sgst

    return {
        'year': int(year),
        'month': int(month),
        'opening': {'igst': igst_open, 'cgst': cgst_open, 'sgst': sgst_open},
        'input': {'igst': input_igst, 'cgst': input_cgst, 'sgst': input_sgst},
        'output': {'igst': output_igst, 'cgst': output_cgst, 'sgst': output_sgst},
        'closing': {'igst': closing_igst, 'cgst': closing_cgst, 'sgst': closing_sgst},
        'entries': entries,
    }
