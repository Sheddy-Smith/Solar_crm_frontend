"""Customer ledger / credit-summary helpers for Account parties."""
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.db.models import Sum


def _d(value):
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')


def _iso(value):
    if not value:
        return None
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return str(value)


def infer_relation(party, net, yearly):
    stored = (party.relation or '').strip()
    if stored:
        return stored
    limit = _d(party.credit_limit)
    if net <= 0:
        return 'Good'
    if limit > 0 and net > limit:
        return 'Bad'
    if yearly >= Decimal('100000') and net > yearly * Decimal('0.5'):
        return 'Poor'
    if net > Decimal('50000'):
        return 'Poor'
    return 'Ok'


def visit_count(party):
    from apps.leads.models import FollowUp, Lead
    from .services import normalize_phone

    key = normalize_phone(party.phone)
    if not key:
        return 0
    leads = Lead.objects.filter(is_deleted=False, mobile_number__endswith=key)
    lead_ids = [lead.id for lead in leads if normalize_phone(lead.mobile_number) == key]
    if not lead_ids:
        return 0
    visits = FollowUp.objects.filter(lead_id__in=lead_ids, follow_up_type='Site Visit').count()
    return visits


def party_totals(party, year=None):
    from .models import Payment, SellInvoice

    invoices = SellInvoice.objects.filter(party_id=party.id).exclude(status='Cancelled')
    received = Payment.objects.filter(party_id=party.id, direction='Received', status='Completed')
    made = Payment.objects.filter(party_id=party.id, direction='Made', status='Completed')
    if year:
        invoices = invoices.filter(invoice_date__year=year)
        received = received.filter(payment_date__year=year)
        made = made.filter(payment_date__year=year)

    debit = _d(invoices.aggregate(t=Sum('total_amount'))['t']) + _d(made.aggregate(t=Sum('amount'))['t'])
    credit = _d(received.aggregate(t=Sum('amount'))['t'])
    opening = _d(party.opening_balance)
    if opening > 0:
        debit += opening
    elif opening < 0:
        credit += abs(opening)
    last_inv = invoices.order_by('-invoice_date').values_list('invoice_date', flat=True).first()
    last_pay = received.order_by('-payment_date').values_list('payment_date', flat=True).first()
    last_date = max([d for d in (last_inv, last_pay) if d] or [None])
    return {
        'opening': opening,
        'debit': debit,
        'credit': credit,
        'net': debit - credit,
        'last_date': last_date,
        'yearly': debit + credit,
    }


def _entry_type_label(raw_type, particulars=''):
    text = f'{raw_type} {particulars}'.lower()
    if 'discount' in text:
        return 'discount'
    if raw_type in ('Invoice', 'Challan', 'sale'):
        return 'sale'
    if raw_type in ('Receipt', 'payment', 'Payment'):
        return 'payment'
    if raw_type == 'Opening':
        return 'opening'
    return (raw_type or 'sale').lower()


def credit_aging_15_plus(party):
    """Outstanding sell-invoice balance older than 15 days."""
    from .models import SellInvoice

    cutoff = date.today() - timedelta(days=15)
    total = Decimal('0')
    for inv in SellInvoice.objects.filter(party_id=party.id, invoice_date__lte=cutoff).exclude(status__in=['Cancelled', 'Paid']):
        due = _d(getattr(inv, 'balance_due', None))
        if due > 0:
            total += due
    return total


def build_ledger_entries(party, start=None, end=None):
    from .models import Payment, SellInvoice

    vehicle_fallback = (party.vehicle_number or '').strip()
    entries = []
    opening = _d(party.opening_balance)
    if opening:
        entries.append({
            'date': None,
            'particulars': 'Opening Balance',
            'work': 'Opening Balance',
            'ref': 'OPENING',
            'vehicle_no': vehicle_fallback or '',
            'debit': float(opening) if opening > 0 else 0,
            'credit': float(abs(opening)) if opening < 0 else 0,
            'type': 'Opening',
            'type_label': 'opening',
        })

    invoices = SellInvoice.objects.filter(party_id=party.id).exclude(status='Cancelled')
    received = Payment.objects.filter(party_id=party.id, direction='Received', status='Completed')
    made = Payment.objects.filter(party_id=party.id, direction='Made', status='Completed')
    if start:
        invoices = invoices.filter(invoice_date__gte=start)
        received = received.filter(payment_date__gte=start)
        made = made.filter(payment_date__gte=start)
    if end:
        invoices = invoices.filter(invoice_date__lte=end)
        received = received.filter(payment_date__lte=end)
        made = made.filter(payment_date__lte=end)

    for inv in invoices.order_by('invoice_date', 'id'):
        particulars = f'Sell Invoice {inv.invoice_no or inv.id}'
        work = (getattr(inv, 'remarks', None) or particulars or '').strip() or particulars
        entries.append({
            'date': _iso(inv.invoice_date),
            'particulars': particulars,
            'work': work,
            'ref': inv.invoice_no or f'SI-{inv.id}',
            'vehicle_no': vehicle_fallback or '',
            'debit': float(_d(inv.total_amount)),
            'credit': 0,
            'type': 'Invoice',
            'type_label': _entry_type_label('Invoice', f'{particulars} {work}'),
            'source_id': inv.id,
            'source_kind': 'sell_invoice',
        })

    for pay in received.order_by('payment_date', 'id'):
        particulars = pay.description or pay.particulars or 'Payment received'
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': particulars,
            'work': particulars,
            'ref': pay.reference_no or f'RCPT-{pay.id}',
            'vehicle_no': vehicle_fallback or '',
            'debit': 0,
            'credit': float(_d(pay.amount)),
            'type': 'Receipt',
            'type_label': _entry_type_label('Receipt', particulars),
            'source_id': pay.id,
            'source_kind': 'payment',
        })

    for pay in made.order_by('payment_date', 'id'):
        particulars = pay.description or pay.particulars or 'Payment made'
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': particulars,
            'work': particulars,
            'ref': pay.reference_no or f'PMT-{pay.id}',
            'vehicle_no': vehicle_fallback or '',
            'debit': float(_d(pay.amount)),
            'credit': 0,
            'type': 'Payment',
            'type_label': _entry_type_label('Payment', particulars),
            'source_id': pay.id,
            'source_kind': 'payment',
        })

    dated = [e for e in entries if e['date']]
    undated = [e for e in entries if not e['date']]
    dated.sort(key=lambda e: e['date'] or '')
    running = Decimal('0')
    out = []
    for row in undated + dated:
        running += _d(row['debit']) - _d(row['credit'])
        out.append({**row, 'balance': float(running)})
    return out


def previous_balance_before(party, start):
    """Running balance just before the selected start date."""
    if not start:
        return Decimal('0')
    try:
        start_date = date.fromisoformat(str(start)[:10])
    except ValueError:
        return Decimal('0')
    day_before = (start_date - timedelta(days=1)).isoformat()
    rows = build_ledger_entries(party, start=None, end=day_before)
    if not rows:
        return _d(party.opening_balance)
    return _d(rows[-1].get('balance'))


def ledger_summary(party, entries, start=None):
    debit = sum((_d(e.get('debit')) for e in entries), Decimal('0'))
    credit = sum((_d(e.get('credit')) for e in entries), Decimal('0'))
    current = _d(entries[-1]['balance']) if entries else _d(party.opening_balance)
    prev = previous_balance_before(party, start) if start else Decimal('0')
    return {
        'total_debit': float(debit),
        'total_credit': float(credit),
        'credit_15_plus': float(credit_aging_15_plus(party)),
        'current_balance': float(current),
        'previous_balance': float(prev),
        'opening': float(_d(party.opening_balance)),
        'final_balance': float(current),
    }


def merge_duplicate_customers_by_phone():
    """Keep one Customer Account per normalized mobile; move linked rows onto the keeper."""
    from .models import Account, Payment, SellChallan, SellInvoice
    from .services import normalize_phone

    by_phone = {}
    for party in Account.objects.filter(account_type='Customer').exclude(phone='').order_by('id'):
        key = normalize_phone(party.phone)
        if not key:
            continue
        by_phone.setdefault(key, []).append(party)

    merged = 0
    removed = 0
    for key, group in by_phone.items():
        if len(group) < 2:
            continue
        keeper = group[0]
        for dup in group[1:]:
            SellInvoice.objects.filter(party_id=dup.id).update(party_id=keeper.id)
            SellChallan.objects.filter(party_id=dup.id).update(party_id=keeper.id)
            Payment.objects.filter(party_id=dup.id).update(party_id=keeper.id)
            fields = []
            if not keeper.email and dup.email:
                keeper.email = dup.email
                fields.append('email')
            if not keeper.address and dup.address:
                keeper.address = dup.address
                fields.append('address')
            if not keeper.vehicle_number and dup.vehicle_number:
                keeper.vehicle_number = dup.vehicle_number
                fields.append('vehicle_number')
            if not keeper.gstin and dup.gstin:
                keeper.gstin = dup.gstin
                fields.append('gstin')
            if fields:
                keeper.save(update_fields=fields)
            dup.delete()
            removed += 1
        if normalize_phone(keeper.phone) != key or keeper.phone != key:
            keeper.phone = key
            keeper.save(update_fields=['phone'])
        merged += 1
    return {'groups_merged': merged, 'duplicates_removed': removed}


def credit_ledger_rows():
    from .models import Account

    year = date.today().year
    rows = []
    opening_sum = debit_sum = credit_sum = Decimal('0')
    for party in Account.objects.filter(account_type='Customer').order_by('name'):
        totals = party_totals(party, year=year)
        all_totals = party_totals(party)
        net = all_totals['net']
        relation = infer_relation(party, net, totals['yearly'])
        opening_sum += all_totals['opening']
        debit_sum += all_totals['debit']
        credit_sum += all_totals['credit']
        rows.append({
            'id': party.id,
            'name': party.name,
            'company': party.company or party.contact_person or '',
            'phone': party.phone or '',
            'yearly_transaction': float(totals['yearly']),
            'relation': relation,
            'debit': float(all_totals['debit']),
            'credit': float(all_totals['credit']),
            'net': float(net),
            'last_date': _iso(all_totals['last_date']),
            'visits': visit_count(party),
        })
    return {
        'opening_balance': float(opening_sum),
        'total_debit': float(debit_sum),
        'total_credit': float(credit_sum),
        'net_balance': float(debit_sum - credit_sum),
        'results': rows,
    }
