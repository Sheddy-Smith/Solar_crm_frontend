"""Customer ledger / credit-summary helpers for Account parties."""
from datetime import date
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

    phone = (party.phone or '').strip()
    if not phone:
        return 0
    leads = Lead.objects.filter(mobile_number=phone)
    lead_ids = list(leads.values_list('id', flat=True))
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


def build_ledger_entries(party, start=None, end=None):
    from .models import Payment, SellInvoice

    entries = []
    opening = _d(party.opening_balance)
    if opening:
        entries.append({
            'date': None,
            'particulars': 'Opening Balance',
            'ref': 'OPENING',
            'debit': float(opening) if opening > 0 else 0,
            'credit': float(abs(opening)) if opening < 0 else 0,
            'type': 'Opening',
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
        entries.append({
            'date': _iso(inv.invoice_date),
            'particulars': f'Sell Invoice {inv.invoice_no or inv.id}',
            'ref': inv.invoice_no or f'SI-{inv.id}',
            'debit': float(_d(inv.total_amount)),
            'credit': 0,
            'type': 'Invoice',
        })
    for pay in received.order_by('payment_date', 'id'):
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': pay.description or pay.particulars or 'Payment received',
            'ref': pay.reference_no or f'RCPT-{pay.id}',
            'debit': 0,
            'credit': float(_d(pay.amount)),
            'type': 'Receipt',
        })
    for pay in made.order_by('payment_date', 'id'):
        entries.append({
            'date': _iso(pay.payment_date),
            'particulars': pay.description or pay.particulars or 'Payment made',
            'ref': pay.reference_no or f'PMT-{pay.id}',
            'debit': float(_d(pay.amount)),
            'credit': 0,
            'type': 'Payment',
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
