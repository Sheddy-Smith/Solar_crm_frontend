"""Vendor ledger — service providers only; no material purchases (MD Rule 4)."""
from decimal import Decimal

from django.db.models import Sum

from .customer_ledger import _d, _iso


def vendor_totals(party, year=None):
    from .models import Payment, PaymentVoucher

    received = Payment.objects.filter(party_id=party.id, direction='Received', status='Completed')
    made = Payment.objects.filter(party_id=party.id, direction='Made', status='Completed')
    vouchers = PaymentVoucher.objects.filter(payee_type='Vendor', payee_name=party.name, status='Completed')
    if year:
        received = received.filter(payment_date__year=year)
        made = made.filter(payment_date__year=year)
        vouchers = vouchers.filter(voucher_date__year=year)

    credit = _d(made.aggregate(t=Sum('amount'))['t']) + _d(vouchers.aggregate(t=Sum('amount'))['t'])
    debit = _d(received.aggregate(t=Sum('amount'))['t'])
    opening = _d(party.opening_balance)
    if opening > 0:
        credit += opening
    elif opening < 0:
        debit += abs(opening)

    last_pay = made.order_by('-payment_date').values_list('payment_date', flat=True).first()
    last_vch = vouchers.order_by('-voucher_date').values_list('voucher_date', flat=True).first()
    last_date = max([d for d in (last_pay, last_vch) if d] or [None])
    net = credit - debit
    return {
        'opening': opening,
        'debit': debit,
        'credit': credit,
        'net': net,
        'last_date': last_date,
        'yearly': credit + debit,
    }


def build_vendor_ledger_entries(party, start=None, end=None, category=''):
    from .models import Payment, PaymentVoucher

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

    received = Payment.objects.filter(party_id=party.id, direction='Received', status='Completed')
    made = Payment.objects.filter(party_id=party.id, direction='Made', status='Completed')
    vouchers = PaymentVoucher.objects.filter(payee_type='Vendor', payee_name=party.name).exclude(status='Cancelled')
    if start:
        received = received.filter(payment_date__gte=start)
        made = made.filter(payment_date__gte=start)
        vouchers = vouchers.filter(voucher_date__gte=start)
    if end:
        received = received.filter(payment_date__lte=end)
        made = made.filter(payment_date__lte=end)
        vouchers = vouchers.filter(voucher_date__lte=end)
    if category:
        cat = category.strip().lower()
        vouchers = vouchers.filter(category__icontains=cat)

    for vch in vouchers.order_by('voucher_date', 'id'):
        entries.append({
            'date': _iso(vch.voucher_date),
            'particulars': vch.particulars or f'Service — {vch.category or "Vendor"}',
            'ref': vch.voucher_no or f'VCH-{vch.id}',
            'category': vch.category or '',
            'debit': 0,
            'credit': float(_d(vch.amount)),
            'type': 'Service',
        })
    for pay in made.order_by('payment_date', 'id'):
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': pay.description or pay.particulars or 'Payment to vendor',
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
