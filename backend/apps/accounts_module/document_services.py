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


SOLAR_SPLIT_GST_RATE = Decimal('8.9')
SOLAR_SPLIT_GOODS_RATE = Decimal('3.5')  # 5% on the 70% goods share


def compute_challan_gst(taxable, gst_mode, gst_percent):
    """Returns (gst_total, gst_5_part). Split mode rounds the combined 8.9% once,
    the same way quotations do, so a quotation total carries over exactly."""
    taxable = _round_money(taxable)
    if gst_mode == 'Split':
        total = _round_money(taxable * SOLAR_SPLIT_GST_RATE / Decimal('100'))
        return total, _round_money(taxable * SOLAR_SPLIT_GOODS_RATE / Decimal('100'))
    if gst_mode == 'Flat':
        return _round_money(taxable * _d(gst_percent) / Decimal('100')), Decimal('0')
    return Decimal('0'), Decimal('0')


def apply_challan_totals(challan, lines):
    total = sum(_d(line.get('line_total') or compute_line_total(line.get('quantity'), line.get('rate'))) for line in lines)
    total = _round_money(total)
    if hasattr(challan, 'gst_mode'):
        if challan.gst_mode == 'Split':
            challan.gst_percent = SOLAR_SPLIT_GST_RATE
        gst, _ = compute_challan_gst(total, challan.gst_mode, challan.gst_percent)
        challan.subtotal = total
        challan.gst_amount = gst
        gross = _round_money(total + gst)
        # Taxed challans are billed to the whole rupee, like the quotation they come from.
        total = gross.quantize(Decimal('1'), rounding=ROUND_HALF_UP) if challan.gst_mode != 'None' else gross
        challan.round_off = _round_money(total - gross)
    challan.total_amount = total
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


# Explicit non-stock / service lines — never create StockMovement.
NON_STOCK_CATEGORIES = frozenset({
    'service', 'labour', 'labor', 'installation', 'freight', 'transport',
    'charge', 'charges', 'non-stock', 'nonstock', 'fee', 'fees', 'amc',
    'warranty', 'subsidy', 'gst', 'tax', 'rounding',
})


def is_non_stock_line(line) -> bool:
    cat = (getattr(line, 'category', None) or '').strip().lower()
    if cat in NON_STOCK_CATEGORIES:
        return True
    # Explicit null inventory + empty/service-ish name without product intent.
    if getattr(line, 'inventory_item_id', None):
        return False
    return False


def _resolve_inventory_item(line):
    """Resolve inventory master by explicit FK only (no fuzzy name match).

    Ambiguous icontains matching caused wrong item binding. Physical product
    lines must send inventory_item from the form/API.
    """
    if line.inventory_item_id:
        return line.inventory_item
    return None


def validate_document_lines_for_stock(lines, *, document_label='Document'):
    """Raise ValidationError for physical lines missing inventory_item / warehouse."""
    from django.core.exceptions import ValidationError
    from apps.inventory.models import Warehouse

    errors = []
    default_wh = Warehouse.objects.filter(is_active=True).order_by('id').first()
    for idx, line in enumerate(lines, start=1):
        if is_non_stock_line(line):
            continue
        # Product line: must have inventory_item when material_name present or qty>0
        name = (getattr(line, 'material_name', None) or '').strip()
        if not name and not getattr(line, 'inventory_item_id', None):
            continue
        item = _resolve_inventory_item(line)
        if not item:
            errors.append(
                f'{document_label} line {idx} ({name or "unnamed"}): '
                'select a valid Inventory Item for physical products '
                '(or set category to Service/Labour for non-stock).'
            )
            continue
        if not item.is_active:
            errors.append(f'{document_label} line {idx}: Inventory Item is inactive.')
        warehouse = item.warehouse or default_wh
        if warehouse is None:
            errors.append(
                f'{document_label} line {idx}: no warehouse on item and no active warehouse in CRM.'
            )
    if errors:
        raise ValidationError({'lines': errors})


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
    ref_no = challan.challan_no or f'PC-{challan.id:04d}'
    lines = list(challan.lines.select_related('inventory_item', 'stock_movement').all())

    if challan.status != 'Received':
        for line in lines:
            if line.stock_movement_id:
                _clear_line_movement(line)
        return

    validate_document_lines_for_stock(lines, document_label='Purchase Challan')
    for line in lines:
        _sync_document_line_stock(
            line,
            movement_type='Inward',
            reference_type='Purchase Challan',
            ref_no=ref_no,
            notes_prefix=f'Purchase challan {ref_no}',
            user=user,
            project=challan.project,
        )
        item = _resolve_inventory_item(line)
        if item:
            _apply_received_item_rate(item, line.rate)


@transaction.atomic
def sync_inventory_for_sell_challan(challan, user=None):
    """Sell Challan Dispatched/Delivered → StockMovement OUT (MD §4.3)."""
    ref_no = challan.challan_no or f'SC-{challan.id:04d}'
    active = challan.status in {'Dispatched', 'Delivered'} and challan.source != 'Project'
    lines = list(challan.lines.select_related('inventory_item', 'stock_movement').all())

    if not active:
        for line in lines:
            if line.stock_movement_id:
                _clear_line_movement(line)
        return

    validate_document_lines_for_stock(lines, document_label='Sell Challan')
    for line in lines:
        _sync_document_line_stock(
            line,
            movement_type='Outward',
            reference_type='Sell Challan',
            ref_no=ref_no,
            notes_prefix=f'Sell challan {ref_no}',
            user=user,
            project=challan.project,
        )


def remove_purchase_challan_stock(challan):
    """Delete linked stock movements before challan removal."""
    for line in challan.lines.select_related('stock_movement').all():
        _clear_line_movement(line)


def remove_sell_challan_stock(challan):
    for line in challan.lines.select_related('stock_movement').all():
        _clear_line_movement(line)


def _sync_document_line_stock(
    line, *, movement_type, reference_type, ref_no, notes_prefix, user=None, project=None,
):
    """Shared IN/OUT sync for invoice/challan lines linked to inventory_item."""
    from django.core.exceptions import ValidationError
    from apps.inventory.models import StockMovement, Warehouse

    if is_non_stock_line(line):
        _clear_line_movement(line)
        return

    item = _resolve_inventory_item(line)
    if not item:
        # Physical product without item — caller should have validated; clear stale link.
        _clear_line_movement(line)
        return

    if not line.inventory_item_id:
        line.inventory_item = item
        line.save(update_fields=['inventory_item'])

    warehouse = item.warehouse or Warehouse.objects.filter(is_active=True).order_by('id').first()
    if warehouse is None:
        raise ValidationError(
            f'No warehouse available for inventory item "{item.name}" '
            f'({reference_type} {ref_no}).'
        )

    notes = f'{notes_prefix} — {line.material_name}'
    inward = movement_type == 'Inward'
    project_id = None
    if project is not None:
        project_id = project.pk if hasattr(project, 'pk') else project

    if line.stock_movement_id:
        movement = line.stock_movement
        movement.item = item
        movement.quantity = line.quantity
        movement.rate = line.rate or item.rate or 0
        movement.movement_type = movement_type
        movement.from_warehouse = None if inward else warehouse
        movement.to_warehouse = warehouse if inward else None
        movement.project_id = project_id
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
            project_id=project_id,
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
    lines = list(invoice.lines.select_related('inventory_item', 'stock_movement').all())

    if not active:
        for line in lines:
            if line.stock_movement_id:
                _clear_line_movement(line)
        return

    validate_document_lines_for_stock(lines, document_label='Purchase Invoice')
    for line in lines:
        _sync_document_line_stock(
            line,
            movement_type='Inward',
            reference_type='Purchase Invoice',
            ref_no=ref_no,
            notes_prefix=f'Purchase invoice {ref_no}',
            user=user,
            project=invoice.project if getattr(invoice, 'procurement_scope', 'General') == 'Project' else None,
        )


def _project_has_jobs_out_for_item(project_id, item_id) -> bool:
    """True when Material Dispatch already created Jobs Stock OUT for project+item."""
    from apps.inventory.models import StockMovement

    if not project_id or not item_id:
        return False
    return StockMovement.objects.filter(
        project_id=project_id,
        item_id=item_id,
        reference_type='Jobs',
        movement_type='Outward',
    ).exists()


def guard_accounts_sell_against_dispatch_double_out(invoice, lines):
    """Block Accounts-source Sell Stock OUT when Jobs dispatch already OUT the same item.

    Project-source Sell invoices skip stock entirely (billing only). Accounts-source
    Sell that also OUT warehouse stock would double-reduce inventory after Material Dispatch.
    """
    from django.core.exceptions import ValidationError

    if getattr(invoice, 'source', None) == 'Project':
        return
    project_id = getattr(invoice, 'project_id', None)
    if not project_id:
        return
    conflicts = []
    for idx, line in enumerate(lines, start=1):
        if is_non_stock_line(line):
            continue
        item = _resolve_inventory_item(line)
        if not item:
            continue
        if _project_has_jobs_out_for_item(project_id, item.id):
            conflicts.append(
                f'line {idx} ({item.name}): already dispatched via Jobs Stock OUT'
            )
    if conflicts:
        raise ValidationError({
            'lines': (
                'Double Stock OUT blocked: this project already has Material Dispatch '
                '(Jobs) for the same inventory item(s). Use Sell Invoice source=Project '
                'for billing-only (no warehouse OUT), or reverse the dispatch first. '
                + '; '.join(conflicts)
            ),
        })


@transaction.atomic
def sync_inventory_for_sell_invoice(invoice, user=None):
    """Sell Invoice Issued/Paid → Stock OUT (MD §5.3). Project-source skips (dispatch owns OUT)."""
    ref_no = invoice.invoice_no or f'SI-{invoice.id:04d}'
    active = invoice.status in {'Issued', 'Paid'} and invoice.source != 'Project'
    lines = list(invoice.lines.select_related('inventory_item', 'stock_movement').all())

    if not active:
        for line in lines:
            if line.stock_movement_id:
                _clear_line_movement(line)
        return

    validate_document_lines_for_stock(lines, document_label='Sell Invoice')
    guard_accounts_sell_against_dispatch_double_out(invoice, lines)
    for line in lines:
        _sync_document_line_stock(
            line,
            movement_type='Outward',
            reference_type='Sell Invoice',
            ref_no=ref_no,
            notes_prefix=f'Sell invoice {ref_no}',
            user=user,
            project=invoice.project,
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
