from decimal import Decimal, ROUND_HALF_UP
from datetime import date

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


def next_document_number(prefix, model, field_name):
    count = model.objects.count() + 1
    return f'{prefix}-{count:05d}'


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


def gst_ledger_report(year, month):
    start = month_start(year, month)
    opening = GstOpeningBalance.objects.filter(month=start).first()
    igst_open = float(opening.igst_opening) if opening else 0.0
    cgst_open = float(opening.cgst_opening) if opening else 0.0
    sgst_open = float(opening.sgst_opening) if opening else 0.0

    purchase_qs = PurchaseInvoice.objects.filter(
        invoice_date__year=year, invoice_date__month=month,
    ).exclude(status='Cancelled')
    sell_qs = SellInvoice.objects.filter(
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
