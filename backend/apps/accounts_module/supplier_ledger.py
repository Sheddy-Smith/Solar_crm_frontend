"""Supplier ledger — material purchases, GRN/challans, payments (MD Rule 4)."""
from datetime import date, timedelta
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
    )
    debit = _d(made.aggregate(t=Sum('amount'))['t'])
    # Refunds from supplier reduce payable (credit side in some books; keep as credit add-back)
    credit += _d(received.aggregate(t=Sum('amount'))['t'])
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
            'work': 'Opening Balance',
            'ref': 'OPENING',
            'category': '',
            'debit': float(abs(opening)) if opening < 0 else 0,
            'credit': float(opening) if opening > 0 else 0,
            'type': 'Opening',
            'type_label': 'opening',
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
        ref = inv.invoice_no or f'PI-{inv.id}'
        work = f'Purchase Invoice - {ref}'
        entries.append({
            'date': _iso(inv.invoice_date),
            'particulars': work,
            'work': work,
            'ref': ref,
            'category': inv.category or '',
            'debit': 0,
            'credit': float(_d(inv.total_amount)),
            'type': 'Purchase',
            'type_label': 'purchase',
        })
    for ch in challans.order_by('challan_date', 'id'):
        ref = ch.challan_no or f'PC-{ch.id}'
        work = f'Purchase Challan - {ref}'
        entries.append({
            'date': _iso(ch.challan_date),
            'particulars': work,
            'work': work,
            'ref': ref,
            'category': '',
            'debit': 0,
            'credit': float(_d(ch.total_amount)),
            'type': 'Purchase Challan',
            'type_label': 'purchase',
        })
    for pay in made.order_by('payment_date', 'id'):
        work = pay.description or pay.particulars or 'Payment to supplier'
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': work,
            'work': work,
            'ref': pay.reference_no or f'PMT-{pay.id}',
            'category': '',
            'debit': float(_d(pay.amount)),
            'credit': 0,
            'type': 'Payment',
            'type_label': 'payment',
        })
    for pay in received.order_by('payment_date', 'id'):
        work = pay.description or pay.particulars or 'Refund / receipt'
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': work,
            'work': work,
            'ref': pay.reference_no or f'RCPT-{pay.id}',
            'category': '',
            'debit': 0,
            'credit': float(_d(pay.amount)),
            'type': 'Receipt',
            'type_label': 'receipt',
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


def previous_supplier_balance(party, start):
    if not start:
        return Decimal('0')
    try:
        start_date = date.fromisoformat(str(start)[:10])
    except ValueError:
        return Decimal('0')
    day_before = (start_date - timedelta(days=1)).isoformat()
    rows = build_supplier_ledger_entries(party, start=None, end=day_before)
    if not rows:
        return _d(party.opening_balance)
    return _d(rows[-1].get('balance'))


def supplier_ledger_summary(party, entries, start=None):
    debit = sum((_d(e.get('debit')) for e in entries), Decimal('0'))
    credit = sum((_d(e.get('credit')) for e in entries), Decimal('0'))
    current = _d(entries[-1]['balance']) if entries else _d(party.opening_balance)
    prev = previous_supplier_balance(party, start) if start else _d(party.opening_balance)
    return {
        'opening': float(_d(party.opening_balance)),
        'previous_balance': float(prev),
        'total_debit': float(debit),
        'total_credit': float(credit),
        'current_balance': float(current),
        'final_balance': float(current),
        'payable_label': 'Payable' if current > 0 else ('Receivable' if current < 0 else 'Clear'),
    }
