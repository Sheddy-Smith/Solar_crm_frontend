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


def sync_inventory_for_purchase_challan(challan, user=None):
    """Create or remove inward StockMovement rows when a purchase challan is received (BUG-019)."""
    from apps.inventory.models import StockMovement, Warehouse

    ref = challan.challan_no or f'PC-{challan.id:04d}'
    default_warehouse = Warehouse.objects.filter(is_active=True).order_by('id').first()

    if challan.status != 'Received':
        for line in challan.lines.filter(stock_movement__isnull=False).select_related('stock_movement'):
            movement = line.stock_movement
            line.stock_movement = None
            line.save(update_fields=['stock_movement'])
            movement.delete()
        return

    for line in challan.lines.select_related('inventory_item', 'stock_movement').all():
        if not line.inventory_item_id:
            if line.stock_movement_id:
                movement = line.stock_movement
                line.stock_movement = None
                line.save(update_fields=['stock_movement'])
                movement.delete()
            continue

        warehouse = line.inventory_item.warehouse or default_warehouse
        if warehouse is None:
            continue

        if line.stock_movement_id:
            movement = line.stock_movement
            movement.item = line.inventory_item
            movement.quantity = line.quantity
            movement.rate = line.rate
            movement.to_warehouse = warehouse
            movement.reference = ref
            movement.notes = f'Purchase challan {ref} — {line.material_name}'
            movement.save()
            continue

        movement = StockMovement.objects.create(
            item=line.inventory_item,
            movement_type='Inward',
            quantity=line.quantity,
            rate=line.rate,
            to_warehouse=warehouse,
            reference=ref,
            notes=f'Purchase challan {ref} — {line.material_name}',
            created_by=user,
        )
        line.stock_movement = movement
        line.save(update_fields=['stock_movement'])


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
