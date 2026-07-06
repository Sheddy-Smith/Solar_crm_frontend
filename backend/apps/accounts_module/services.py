"""Accounts business logic — balances, ledger entries, project sync."""

from decimal import Decimal

from django.db.models import Sum

from .models import Account, BankAccount, ChartOfAccount, Cheque, Payment, Transaction


PAYMENT_MODE_MAP = {
    'Bank Transfer': 'NEFT',
    'Cash': 'Cash',
    'UPI': 'UPI',
    'Cheque': 'Cheque',
    'NEFT': 'NEFT',
    'RTGS': 'RTGS',
}


def _default_accounts():
    defaults = [
        ('1110', 'Cash in Hand', 'Asset'),
        ('1120', 'Cash at Bank', 'Asset'),
        ('1130', 'Accounts Receivable', 'Asset'),
        ('2110', 'Accounts Payable', 'Liability'),
        ('4100', 'Sales Revenue', 'Income'),
        ('5100', 'General Expenses', 'Expense'),
    ]
    accounts = {}
    for code, name, acct_type in defaults:
        obj, _ = ChartOfAccount.objects.get_or_create(
            account_code=code,
            defaults={'account_name': name, 'account_type': acct_type, 'is_active': True},
        )
        accounts[code] = obj
    return accounts


def get_or_create_party_for_project(project):
    lead = project.lead if project.lead_id else None
    phone = (lead.mobile_number or '').strip() if lead else ''

    # Phone is the identity when available — matching by name alone merges
    # two different customers who happen to share a name.
    party = None
    if phone:
        party = Account.objects.filter(phone=phone).first()
    if party is None:
        name_qs = Account.objects.filter(name=project.customer_name)
        if phone:
            name_qs = name_qs.filter(phone__in=['', phone])
        party = name_qs.first()

    if party is None:
        party = Account.objects.create(
            name=project.customer_name,
            account_type='Customer',
            city=project.city or (lead.city if lead else '') or '',
            phone=phone,
            email=(lead.email or '') if lead else '',
            status='Active',
        )
    elif lead:
        updates = []
        if not party.phone and phone:
            party.phone = phone
            updates.append('phone')
        if not party.email and lead.email:
            party.email = lead.email
            updates.append('email')
        if not party.city and (project.city or lead.city):
            party.city = project.city or lead.city
            updates.append('city')
        if updates:
            party.save(update_fields=updates)
    return party


def recalculate_party_balance(party_id):
    if not party_id:
        return
    party = Account.objects.get(pk=party_id)
    received = Payment.objects.filter(
        party_id=party_id, direction='Received', status='Completed',
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    made = Payment.objects.filter(
        party_id=party_id, direction='Made', status='Completed',
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    party.balance = party.opening_balance - received + made
    party.save(update_fields=['balance', 'updated_at'])


def recalculate_bank_balance(bank_id):
    if not bank_id:
        return
    bank = BankAccount.objects.get(pk=bank_id)
    received = Payment.objects.filter(
        bank_account_id=bank_id, direction='Received', status='Completed',
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    made = Payment.objects.filter(
        bank_account_id=bank_id, direction='Made', status='Completed',
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    bank.balance = bank.opening_balance + received - made
    bank.save(update_fields=['balance', 'updated_at'])


def sync_cheque_for_payment(payment):
    if payment.payment_mode != 'Cheque' or payment.status != 'Completed':
        # Mode changed away from Cheque (or payment no longer completed):
        # remove the stale cheque record instead of leaving it behind.
        Cheque.objects.filter(payment=payment).delete()
        return
    payee = payment.party.name if payment.party_id else (payment.party_name or '—')
    cheque_type = 'Received' if payment.direction == 'Received' else 'Issued'
    status = 'Deposited' if payment.direction == 'Received' else 'Issued'
    Cheque.objects.update_or_create(
        payment=payment,
        defaults={
            'cheque_no': payment.reference_no or f'CHQ-{payment.id:04d}',
            'cheque_date': payment.payment_date,
            'bank_account': payment.bank_account,
            'payee_name': payee,
            'amount': payment.amount,
            'cheque_type': cheque_type,
            'status': status,
            'created_by': payment.created_by,
        },
    )


def sync_journal_for_payment(payment):
    if payment.status != 'Completed':
        Transaction.objects.filter(source_payment=payment).delete()
        return
    defaults = _default_accounts()
    txn_type = 'Payment Received' if payment.direction == 'Received' else 'Payment Made'
    ref = payment.reference_no or f'{"RCPT" if payment.direction == "Received" else "PMT"}-{payment.id:04d}'
    if payment.direction == 'Received':
        debit = defaults['1120']
        credit = defaults['4100']
    else:
        debit = defaults['5100']
        credit = defaults['1120']
    Transaction.objects.update_or_create(
        source_payment=payment,
        defaults={
            'transaction_date': payment.payment_date,
            'transaction_type': txn_type,
            'reference_number': ref,
            'debit_account': debit,
            'credit_account': credit,
            'party': payment.party,
            'bank_account': payment.bank_account,
            'payment_mode': payment.payment_mode,
            'amount': payment.amount,
            'description': payment.description or f'{txn_type} — {payment.party.name if payment.party_id else payment.party_name}',
            'status': 'Completed',
            'created_by': payment.created_by,
        },
    )


def after_payment_saved(payment, old_party_id=None, old_bank_id=None):
    """Recalculate balances and sync linked records after payment create/update."""
    if old_party_id and old_party_id != payment.party_id:
        recalculate_party_balance(old_party_id)
    if old_bank_id and old_bank_id != payment.bank_account_id:
        recalculate_bank_balance(old_bank_id)
    recalculate_party_balance(payment.party_id)
    recalculate_bank_balance(payment.bank_account_id)
    sync_cheque_for_payment(payment)
    sync_journal_for_payment(payment)


def before_payment_delete(payment):
    """Remove derived records. Call before instance.delete() while the FK is still valid."""
    Transaction.objects.filter(source_payment=payment).delete()
    Cheque.objects.filter(payment=payment).delete()


def after_payment_deleted(party_id, bank_id):
    """Refresh balances. Call after instance.delete() so the aggregate excludes it."""
    recalculate_party_balance(party_id)
    recalculate_bank_balance(bank_id)


def sync_project_payment_to_accounts(project_payment, user):
    """Create or update Accounts Payment from a ProjectPayment."""
    project = project_payment.project
    party = get_or_create_party_for_project(project)
    mode = PAYMENT_MODE_MAP.get(project_payment.payment_mode, 'Other')
    payment, _ = Payment.objects.update_or_create(
        project_payment=project_payment,
        defaults={
            'direction': 'Received',
            'payment_date': project_payment.payment_date,
            'amount': project_payment.amount,
            'payment_mode': mode,
            'party': party,
            'party_name': project.customer_name,
            'project': project,
            'project_ref': project.project_id,
            'reference_no': project_payment.reference or '',
            'description': project_payment.notes or f'Project payment — {project.project_id}',
            'status': 'Completed',
            'created_by': user,
        },
    )
    after_payment_saved(payment)
    return payment


def remove_accounts_payment_for_project_payment(project_payment):
    payment = Payment.objects.filter(project_payment=project_payment).first()
    if payment:
        party_id = payment.party_id
        bank_id = payment.bank_account_id
        before_payment_delete(payment)
        payment.delete()
        after_payment_deleted(party_id, bank_id)


def accounts_dashboard_summary():
    payments = Payment.objects.all()
    received = payments.filter(direction='Received', status='Completed').aggregate(
        total=Sum('amount'),
    )['total'] or Decimal('0')
    made = payments.filter(direction='Made', status='Completed').aggregate(
        total=Sum('amount'),
    )['total'] or Decimal('0')
    pending_in = payments.filter(direction='Received', status='Pending').aggregate(
        total=Sum('amount'),
    )['total'] or Decimal('0')
    pending_out = payments.filter(direction='Made', status='Pending').aggregate(
        total=Sum('amount'),
    )['total'] or Decimal('0')
    bank_total = BankAccount.objects.filter(status='Active').aggregate(
        total=Sum('balance'),
    )['total'] or Decimal('0')
    return {
        'total_received': float(received),
        'total_made': float(made),
        'net_balance': float(received - made),
        'pending_received': float(pending_in),
        'pending_made': float(pending_out),
        'bank_balance': float(bank_total),
        'party_count': Account.objects.filter(status='Active').count(),
        'bank_count': BankAccount.objects.filter(status='Active').count(),
        'pending_cheques': Cheque.objects.filter(status__in=['Issued', 'Pending', 'Deposited']).count(),
        'total_payments': payments.count(),
    }
