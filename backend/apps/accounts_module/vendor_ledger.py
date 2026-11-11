"""Vendor ledger — service providers only; no material purchases (MD Rule 4)."""
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum

from .customer_ledger import _d, _iso


def vendor_voucher_qs(party):
    from .models import PaymentVoucher
    return PaymentVoucher.objects.filter(payee_type='Vendor', payee_name=party.name).exclude(status='Cancelled')


def vendor_totals(party, year=None):
    from .models import Payment, VendorLedgerManualEntry

    received = Payment.objects.filter(party_id=party.id, direction='Received', status='Completed')
    made = Payment.objects.filter(party_id=party.id, direction='Made', status='Completed')
    vouchers = vendor_voucher_qs(party).filter(status='Completed')
    manual = VendorLedgerManualEntry.objects.filter(party_id=party.id)
    if year:
        received = received.filter(payment_date__year=year)
        made = made.filter(payment_date__year=year)
        vouchers = vouchers.filter(voucher_date__year=year)
        manual = manual.filter(entry_date__year=year)

    # Credit = work done (vouchers + manual credit) + refunds; Debit = payments + manual debit
    credit = (
        _d(vouchers.aggregate(t=Sum('amount'))['t'])
        + _d(received.aggregate(t=Sum('amount'))['t'])
        + _d(manual.aggregate(t=Sum('credit'))['t'])
    )
    debit = _d(made.aggregate(t=Sum('amount'))['t']) + _d(manual.aggregate(t=Sum('debit'))['t'])
    opening = _d(party.opening_balance)
    if opening > 0:
        credit += opening
    elif opening < 0:
        debit += abs(opening)

    last_pay = made.order_by('-payment_date').values_list('payment_date', flat=True).first()
    last_vch = vouchers.order_by('-voucher_date').values_list('voucher_date', flat=True).first()
    last_manual = manual.order_by('-entry_date').values_list('entry_date', flat=True).first()
    last_date = max([d for d in (last_pay, last_vch, last_manual) if d] or [None])
    net = credit - debit
    return {
        'opening': opening,
        'debit': debit,
        'credit': credit,
        'net': net,
        'last_date': last_date,
        'yearly': credit + debit,
        'voucher_count': vendor_voucher_qs(party).count(),
    }


def build_vendor_ledger_entries(party, start=None, end=None, category=''):
    from .models import Payment, VendorLedgerManualEntry

    vehicle = (party.vehicle_number or '').strip()
    entries = []
    opening = _d(party.opening_balance)
    if opening:
        entries.append({
            'date': None,
            'particulars': 'Opening Balance',
            'work': 'Opening Balance',
            'ref': 'OPENING',
            'category': '',
            'vehicle_no': vehicle,
            'wheeler': '',
            'owner_name': '',
            'debit': float(abs(opening)) if opening < 0 else 0,
            'credit': float(opening) if opening > 0 else 0,
            'type': 'Opening',
            'type_label': 'opening',
            'source': 'opening',
            'editable': False,
        })

    received = Payment.objects.filter(party_id=party.id, direction='Received', status='Completed')
    made = Payment.objects.filter(party_id=party.id, direction='Made', status='Completed')
    vouchers = vendor_voucher_qs(party)
    manual = VendorLedgerManualEntry.objects.filter(party_id=party.id)
    if start:
        received = received.filter(payment_date__gte=start)
        made = made.filter(payment_date__gte=start)
        vouchers = vouchers.filter(voucher_date__gte=start)
        manual = manual.filter(entry_date__gte=start)
    if end:
        received = received.filter(payment_date__lte=end)
        made = made.filter(payment_date__lte=end)
        vouchers = vouchers.filter(voucher_date__lte=end)
        manual = manual.filter(entry_date__lte=end)
    if category:
        cat = category.strip().lower()
        vouchers = vouchers.filter(category__icontains=cat)
        manual = manual.filter(work__icontains=cat)

    for vch in vouchers.order_by('voucher_date', 'id'):
        work = vch.particulars or f'Service — {vch.category or "Vendor"}'
        entries.append({
            'date': _iso(vch.voucher_date),
            'particulars': work,
            'work': work,
            'ref': vch.voucher_no or f'VCH-{vch.id}',
            'category': vch.category or '',
            'vehicle_no': vehicle,
            'wheeler': '',
            'owner_name': '',
            'debit': 0,
            'credit': float(_d(vch.amount)),
            'type': 'Service',
            'type_label': 'service',
            'source': 'voucher',
            'source_id': vch.id,
            'editable': False,
        })
    for pay in made.order_by('payment_date', 'id'):
        work = pay.description or pay.particulars or 'Payment to vendor'
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': work,
            'work': work,
            'ref': pay.reference_no or f'PMT-{pay.id}',
            'category': '',
            'vehicle_no': vehicle,
            'wheeler': '',
            'owner_name': '',
            'debit': float(_d(pay.amount)),
            'credit': 0,
            'type': 'Payment',
            'type_label': 'payment',
            'source': 'payment',
            'source_id': pay.id,
            'editable': False,
        })
    for pay in received.order_by('payment_date', 'id'):
        work = pay.description or pay.particulars or 'Refund / receipt'
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': work,
            'work': work,
            'ref': pay.reference_no or f'RCPT-{pay.id}',
            'category': '',
            'vehicle_no': vehicle,
            'wheeler': '',
            'owner_name': '',
            'debit': 0,
            'credit': float(_d(pay.amount)),
            'type': 'Receipt',
            'type_label': 'receipt',
            'source': 'payment',
            'source_id': pay.id,
            'editable': False,
        })
    for row in manual.order_by('entry_date', 'id'):
        entries.append({
            'date': _iso(row.entry_date),
            'particulars': row.work or 'Manual entry',
            'work': row.work or 'Manual entry',
            'ref': f'MAN-{row.id}',
            'category': '',
            'vehicle_no': row.vehicle_no or vehicle,
            'wheeler': row.wheeler or '',
            'owner_name': row.owner_name or '',
            'debit': float(_d(row.debit)),
            'credit': float(_d(row.credit)),
            'type': 'Manual',
            'type_label': 'manual',
            'source': 'manual',
            'source_id': row.id,
            'editable': True,
        })

    dated = [e for e in entries if e['date']]
    undated = [e for e in entries if not e['date']]
    dated.sort(key=lambda e: (e['date'] or '', e.get('ref') or ''))
    running = Decimal('0')
    out = []
    for row in undated + dated:
        running += _d(row['credit']) - _d(row['debit'])
        out.append({**row, 'balance': float(running)})
    return out


def previous_vendor_balance(party, start):
    if not start:
        return Decimal('0')
    try:
        start_date = date.fromisoformat(str(start)[:10])
    except ValueError:
        return Decimal('0')
    day_before = (start_date - timedelta(days=1)).isoformat()
    rows = build_vendor_ledger_entries(party, start=None, end=day_before)
    if not rows:
        return _d(party.opening_balance)
    return _d(rows[-1].get('balance'))


def vendor_ledger_summary(party, entries, start=None):
    debit = sum((_d(e.get('debit')) for e in entries), Decimal('0'))
    credit = sum((_d(e.get('credit')) for e in entries), Decimal('0'))
    current = _d(entries[-1]['balance']) if entries else _d(party.opening_balance)
    prev = previous_vendor_balance(party, start) if start else Decimal('0')
    return {
        'opening': float(_d(party.opening_balance)),
        'previous_balance': float(prev),
        'total_debit': float(debit),
        'total_credit': float(credit),
        'current_balance': float(current),
        'final_balance': float(current),
        'payable_label': 'Payable' if current > 0 else ('Receivable' if current < 0 else 'Clear'),
        'voucher_count': vendor_voucher_qs(party).count(),
    }
