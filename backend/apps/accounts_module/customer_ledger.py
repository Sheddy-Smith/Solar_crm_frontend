"""Customer ledger / credit-summary helpers for Account parties."""
import re
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


def customer_phone_keys(party):
    """Primary + alternate + normalized phone keys for this Customer master."""
    from .services import normalize_phone

    keys = set()
    for raw in (
        getattr(party, 'normalized_phone', None),
        getattr(party, 'phone', None),
        getattr(party, 'alternate_phone', None),
    ):
        key = normalize_phone(raw)
        if key and len(key) >= 10:
            keys.add(key)
    return keys


def projects_queryset_for_customer(party):
    """Projects linked via customer FK OR lead mobile matching primary/alternate number.

    Used by Account Scope / Add-Edit Ledger project dropdown so "another number"
    projects also appear for the same Customer master.
    """
    from django.db.models import Q

    from apps.leads.models import Lead
    from apps.projects.models import Project

    q = Q(customer_id=party.id)
    keys = customer_phone_keys(party)
    if keys:
        lead_q = Q(normalized_mobile__in=keys)
        for key in keys:
            lead_q |= Q(mobile_number__endswith=key)
        lead_ids = (
            Lead.objects.filter(is_deleted=False)
            .filter(lead_q)
            .values_list('id', flat=True)
        )
        # Also Lead.customer FK when backfilled.
        lead_ids_via_customer = Lead.objects.filter(
            is_deleted=False, customer_id=party.id,
        ).values_list('id', flat=True)
        all_lead_ids = set(lead_ids) | set(lead_ids_via_customer)
        if all_lead_ids:
            q |= Q(lead_id__in=all_lead_ids)
    return Project.objects.filter(q, is_deleted=False).distinct()


def resolve_project_for_customer(party, project_pk):
    """Resolve a Project that belongs to this customer (FK or phone/alternate match)."""
    try:
        pk = int(project_pk)
    except (TypeError, ValueError):
        return None
    project = projects_queryset_for_customer(party).filter(pk=pk).first()
    if not project:
        return None
    # Soft-link orphan phone-matched project onto this Customer master.
    if project.customer_id != party.id:
        project.customer_id = party.id
        project.save(update_fields=['customer', 'updated_at'])
    return project


def party_totals(party, year=None, project_id=None, unallocated_only=False):
    """Party financial totals.

    project_id: restrict to one Project's invoices/payments.
    unallocated_only: payments/invoices with project IS NULL (customer advances).
    Opening balance is included only for consolidated (no project filter) views.
    """
    from .models import CustomerLedgerManualEntry, Payment, PaymentAllocation, SellInvoice

    invoices = SellInvoice.objects.filter(party_id=party.id).exclude(status='Cancelled')
    received = Payment.objects.filter(party_id=party.id, direction='Received', status='Completed')
    made = Payment.objects.filter(party_id=party.id, direction='Made', status='Completed')
    manual = CustomerLedgerManualEntry.objects.filter(party_id=party.id)
    if project_id is not None:
        invoices = invoices.filter(project_id=project_id)
        received = received.filter(project_id=project_id)
        made = made.filter(project_id=project_id)
        manual = manual.filter(project_id=project_id)
        # Allocations from unallocated advances count toward this project without double-counting
        # full unallocated payment in consolidated (those stay project_id null on Payment).
        # Only count allocations from payments that remain unstamped (project IS NULL).
        # Fully allocated advances stamp Payment.project and are already in `received`.
        alloc_credit = _d(
            PaymentAllocation.objects.filter(
                project_id=project_id,
                payment__party_id=party.id,
                payment__status='Completed',
                payment__project__isnull=True,
            ).aggregate(t=Sum('amount'))['t']
        )
    elif unallocated_only:
        invoices = invoices.filter(project__isnull=True)
        received = received.filter(project__isnull=True)
        made = made.filter(project__isnull=True)
        manual = manual.filter(project__isnull=True)
        alloc_credit = Decimal('0')
    else:
        alloc_credit = Decimal('0')
    if year:
        invoices = invoices.filter(invoice_date__year=year)
        received = received.filter(payment_date__year=year)
        made = made.filter(payment_date__year=year)
        manual = manual.filter(entry_date__year=year)

    debit = _d(invoices.aggregate(t=Sum('total_amount'))['t']) + _d(made.aggregate(t=Sum('amount'))['t'])
    credit = _d(received.aggregate(t=Sum('amount'))['t']) + alloc_credit
    debit += _d(manual.filter(entry_type='sale').aggregate(t=Sum('amount'))['t'])
    credit += _d(manual.exclude(entry_type='sale').aggregate(t=Sum('amount'))['t'])
    opening = _d(party.opening_balance) if project_id is None and not unallocated_only else Decimal('0')
    if opening > 0:
        debit += opening
    elif opening < 0:
        credit += abs(opening)
    last_inv = invoices.order_by('-invoice_date').values_list('invoice_date', flat=True).first()
    last_pay = received.order_by('-payment_date').values_list('payment_date', flat=True).first()
    last_manual = manual.order_by('-entry_date').values_list('entry_date', flat=True).first()
    last_date = max([d for d in (last_inv, last_pay, last_manual) if d] or [None])
    return {
        'opening': opening,
        'debit': debit,
        'credit': credit,
        'net': debit - credit,
        'invoiced': _d(invoices.aggregate(t=Sum('total_amount'))['t']),
        'received': _d(received.aggregate(t=Sum('amount'))['t']) + alloc_credit,
        'outstanding': debit - credit,
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


def build_ledger_entries(party, start=None, end=None, project_id=None, unallocated_only=False):
    from .models import CustomerLedgerManualEntry, Payment, PaymentAllocation, SellInvoice

    vehicle_fallback = (party.vehicle_number or '').strip()
    entries = []
    include_opening = project_id is None and not unallocated_only
    opening = _d(party.opening_balance) if include_opening else Decimal('0')
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
            'payment_mode': '',
            'project_id': None,
        })

    invoices = SellInvoice.objects.filter(party_id=party.id).exclude(status='Cancelled')
    received = Payment.objects.filter(party_id=party.id, direction='Received', status='Completed')
    made = Payment.objects.filter(party_id=party.id, direction='Made', status='Completed')
    manual = CustomerLedgerManualEntry.objects.filter(party_id=party.id)
    if project_id is not None:
        invoices = invoices.filter(project_id=project_id)
        received = received.filter(project_id=project_id)
        made = made.filter(project_id=project_id)
        manual = manual.filter(project_id=project_id)
    elif unallocated_only:
        invoices = invoices.filter(project__isnull=True)
        received = received.filter(project__isnull=True)
        made = made.filter(project__isnull=True)
        manual = manual.filter(project__isnull=True)
    if start:
        invoices = invoices.filter(invoice_date__gte=start)
        received = received.filter(payment_date__gte=start)
        made = made.filter(payment_date__gte=start)
        manual = manual.filter(entry_date__gte=start)
    if end:
        invoices = invoices.filter(invoice_date__lte=end)
        received = received.filter(payment_date__lte=end)
        made = made.filter(payment_date__lte=end)
        manual = manual.filter(entry_date__lte=end)

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
            'payment_mode': (getattr(inv, 'payment_mode', None) or '').strip(),
            'source_id': inv.id,
            'source_kind': 'sell_invoice',
            'project_id': inv.project_id,
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
            'payment_mode': (getattr(pay, 'payment_mode', None) or '').strip(),
            'source_id': pay.id,
            'source_kind': 'payment',
            'project_id': pay.project_id,
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
            'payment_mode': (getattr(pay, 'payment_mode', None) or '').strip(),
            'source_id': pay.id,
            'source_kind': 'payment',
            'project_id': pay.project_id,
        })

    if project_id is not None:
        alloc_qs = PaymentAllocation.objects.filter(
            project_id=project_id, payment__party_id=party.id, payment__status='Completed',
        ).select_related('payment')
        if start:
            alloc_qs = alloc_qs.filter(created_at__date__gte=start)
        if end:
            alloc_qs = alloc_qs.filter(created_at__date__lte=end)
        for alloc in alloc_qs.order_by('created_at', 'id'):
            # Skip if payment already stamped onto a project (counted via Payment.received).
            if alloc.payment.project_id:
                continue
            particulars = f'Advance allocated from RCPT-{alloc.payment_id}'
            entries.append({
                'date': _iso(alloc.created_at.date() if alloc.created_at else None),
                'particulars': particulars,
                'work': alloc.notes or particulars,
                'ref': f'ALLOC-{alloc.id}',
                'vehicle_no': vehicle_fallback or '',
                'debit': 0,
                'credit': float(_d(alloc.amount)),
                'type': 'Allocation',
                'type_label': 'payment',
                'payment_mode': (getattr(alloc.payment, 'payment_mode', None) or '').strip(),
                'source_id': alloc.id,
                'source_kind': 'payment_allocation',
                'project_id': project_id,
            })

    for row in manual.select_related('project').order_by('entry_date', 'id'):
        is_debit = row.entry_type == 'sale'
        work = (row.work or '').strip() or row.get_entry_type_display()
        entries.append({
            'date': _iso(row.entry_date),
            'particulars': work,
            'work': work,
            'ref': (row.reference_no or '').strip() or f'MLE-{row.id}',
            'vehicle_no': (row.vehicle_no or '').strip() or vehicle_fallback or '',
            'debit': float(_d(row.amount)) if is_debit else 0,
            'credit': float(_d(row.amount)) if not is_debit else 0,
            'type': 'Invoice' if is_debit else 'Receipt',
            'type_label': row.entry_type,
            'payment_mode': (row.payment_mode or '').strip(),
            'source_id': row.id,
            'source_kind': 'manual_ledger',
            'project_id': row.project_id,
        })

    dated = [e for e in entries if e['date']]
    undated = [e for e in entries if not e['date']]
    dated.sort(key=lambda e: e['date'] or '')
    running = Decimal('0')
    out = []
    for row in undated + dated:
        running += _d(row['debit']) - _d(row['credit'])
        out.append({**row, 'balance': float(running)})

    # Attach Project Name + Project Code for UI (Vehicle No column replacement).
    from apps.projects.models import Project
    project_ids = {row.get('project_id') for row in out if row.get('project_id')}
    project_map = {}
    if project_ids:
        for project in Project.objects.filter(id__in=project_ids).only('id', 'project_id', 'project_name'):
            project_map[project.id] = {
                'project_code': project.project_id or '',
                'project_name': project.project_name or '',
            }
    for row in out:
        info = project_map.get(row.get('project_id')) or {}
        row['project_code'] = info.get('project_code') or ''
        row['project_name'] = info.get('project_name') or ''
    return out


def _project_code_sort_key(code):
    """Trailing digits from codes like MLE-402 / PRJ-2026-0042 for numeric ordering."""
    match = re.search(r'(\d+)\s*$', str(code or ''))
    return int(match.group(1)) if match else 10**12


def project_ledger_breakdown(party):
    """Per-project + unallocated financial summary for a Customer."""
    projects = list(projects_queryset_for_customer(party))
    projects.sort(
        key=lambda p: (_project_code_sort_key(p.project_id), str(p.project_name or ''), p.id or 0)
    )
    rows = []
    for project in projects:
        totals = party_totals(party, project_id=project.id)
        rows.append({
            'project_id': project.id,
            'project_code': project.project_id,
            'project_name': project.project_name,
            'status': project.status,
            'invoiced': float(totals['invoiced']),
            'received': float(totals['received']),
            'outstanding': float(totals['outstanding']),
            'debit': float(totals['debit']),
            'credit': float(totals['credit']),
            'net': float(totals['net']),
        })
    unalloc = party_totals(party, unallocated_only=True)
    consolidated = party_totals(party)
    return {
        'projects': rows,
        'unallocated': {
            'invoiced': float(unalloc['invoiced']),
            'received': float(unalloc['received']),
            'outstanding': float(unalloc['outstanding']),
            'debit': float(unalloc['debit']),
            'credit': float(unalloc['credit']),
            'net': float(unalloc['net']),
        },
        'consolidated': {
            'invoiced': float(consolidated['invoiced']),
            'received': float(consolidated['received']),
            'outstanding': float(consolidated['outstanding']),
            'debit': float(consolidated['debit']),
            'credit': float(consolidated['credit']),
            'net': float(consolidated['net']),
            'projects_count': len(rows),
        },
    }


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
    from .models import Account, CustomerLedgerManualEntry, Payment, SellChallan, SellInvoice
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
            CustomerLedgerManualEntry.objects.filter(party_id=dup.id).update(party_id=keeper.id)
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
