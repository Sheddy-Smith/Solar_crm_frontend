"""Supplier ledger — material purchases, GRN/challans, payments (MD Rule 4)."""
from decimal import Decimal

from django.db.models import Sum

from .customer_ledger import _d, _iso


def supplier_totals(party, year=None):
    from .models import Payment, PurchaseChallan, PurchaseInvoice

    invoices = PurchaseInvoice.objects.filter(supplier_id=party.id).exclude(status='Cancelled')
    challans = PurchaseChallan.objects.filter(supplier_id=party.id, status='Received')
    received = Payment.objects.filter(party_id=party.id, direction='Received', status='Completed')
    made = Payment.objects.filter(party_id=party.id, direction='Made', status='Completed')
    if year:
        invoices = invoices.filter(invoice_date__year=year)
        challans = challans.filter(challan_date__year=year)
        received = received.filter(payment_date__year=year)
        made = made.filter(payment_date__year=year)

    credit = (
        _d(invoices.aggregate(t=Sum('total_amount'))['t'])
        + _d(challans.aggregate(t=Sum('total_amount'))['t'])
        + _d(made.aggregate(t=Sum('amount'))['t'])
    )
    debit = _d(received.aggregate(t=Sum('amount'))['t'])
    opening = _d(party.opening_balance)
    if opening > 0:
        credit += opening
    elif opening < 0:
        debit += abs(opening)

    last_inv = invoices.order_by('-invoice_date').values_list('invoice_date', flat=True).first()
    last_ch = challans.order_by('-challan_date').values_list('challan_date', flat=True).first()
    last_pay = made.order_by('-payment_date').values_list('payment_date', flat=True).first()
    last_date = max([d for d in (last_inv, last_ch, last_pay) if d] or [None])
    net = credit - debit
    return {
        'opening': opening,
        'debit': debit,
        'credit': credit,
        'net': net,
        'last_date': last_date,
        'yearly': credit + debit,
    }


def build_supplier_ledger_entries(party, start=None, end=None, category=''):
    from .models import Payment, PurchaseChallan, PurchaseInvoice

    entries = []
    opening = _d(party.opening_balance)
    if opening:
        entries.append({
            'date': None,
            'particulars': 'Opening Balance',
            'ref': 'OPENING',
            'category': '',
            'debit': float(abs(opening)) if opening < 0 else 0,
            'credit': float(opening) if opening > 0 else 0,
            'type': 'Opening',
        })

    invoices = PurchaseInvoice.objects.filter(supplier_id=party.id).exclude(status='Cancelled')
    challans = PurchaseChallan.objects.filter(supplier_id=party.id, status='Received')
    received = Payment.objects.filter(party_id=party.id, direction='Received', status='Completed')
    made = Payment.objects.filter(party_id=party.id, direction='Made', status='Completed')
    if start:
        invoices = invoices.filter(invoice_date__gte=start)
        challans = challans.filter(challan_date__gte=start)
        received = received.filter(payment_date__gte=start)
        made = made.filter(payment_date__gte=start)
    if end:
        invoices = invoices.filter(invoice_date__lte=end)
        challans = challans.filter(challan_date__lte=end)
        received = received.filter(payment_date__lte=end)
        made = made.filter(payment_date__lte=end)
    if category:
        cat = category.strip().lower()
        invoices = invoices.filter(category__icontains=cat)

    for inv in invoices.order_by('invoice_date', 'id'):
        entries.append({
            'date': _iso(inv.invoice_date),
            'particulars': f'Purchase {inv.invoice_no or inv.id}',
            'ref': inv.invoice_no or f'PI-{inv.id}',
            'category': inv.category or '',
            'debit': 0,
            'credit': float(_d(inv.total_amount)),
            'type': 'Purchase',
        })
    for ch in challans.order_by('challan_date', 'id'):
        entries.append({
            'date': _iso(ch.challan_date),
            'particulars': f'Purchase Challan {ch.challan_no or ch.id}',
            'ref': ch.challan_no or f'PC-{ch.id}',
            'category': '',
            'debit': 0,
            'credit': float(_d(ch.total_amount)),
            'type': 'Purchase Challan',
        })
    for pay in made.order_by('payment_date', 'id'):
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': pay.description or pay.particulars or 'Payment to supplier',
            'ref': pay.reference_no or f'PMT-{pay.id}',
            'category': '',
            'debit': float(_d(pay.amount)),
            'credit': 0,
            'type': 'Payment',
        })
    for pay in received.order_by('payment_date', 'id'):
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': pay.description or pay.particulars or 'Refund / receipt',
            'ref': pay.reference_no or f'RCPT-{pay.id}',
            'category': '',
            'debit': 0,
            'credit': float(_d(pay.amount)),
            'type': 'Receipt',
        })

    dated = [e for e in entries if e['date']]
    undated = [e for e in entries if not e['date']]
    dated.sort(key=lambda e: e['date'] or '')
    running = Decimal('0')
    out = []
    for row in undated + dated:
        running += _d(row['credit']) - _d(row['debit'])
        out.append({**row, 'balance': float(running)})
    return out
