"""Accounts business logic — balances, ledger entries, project sync."""

from decimal import Decimal

from django.db.models import Sum

from .models import (
    Account, BankAccount, ChartOfAccount, Cheque, Payment, PurchaseInvoice, SellInvoice, Transaction,
)


PAYMENT_MODE_MAP = {
    'Bank Transfer': 'NEFT',
    'Cash': 'Cash',
    'UPI': 'UPI',
    'Cheque': 'Cheque',
    'NEFT': 'NEFT',
    'RTGS': 'RTGS',
}


def _d(value):
    if value is None:
        return Decimal('0')
    return Decimal(str(value))


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


def _chart_account_for_bank(bank_account):
    """One ChartOfAccount asset row per BankAccount, created on first use, so
    journal entries for a specific bank/cash account don't all collapse into
    the single shared 'Cash at Bank' (1120) bucket (BUG-024)."""
    code = f'1120-{bank_account.id}'
    obj, _ = ChartOfAccount.objects.get_or_create(
        account_code=code,
        defaults={
            'account_name': f'Bank — {bank_account.account_name} ({bank_account.bank_name})',
            'account_type': 'Asset',
            'is_active': True,
        },
    )
    return obj


def account_for_cash_or_bank(payment_mode, bank_account, defaults=None):
    """Map the payment_mode/bank_account actually selected on a payment or
    invoice to the matching chart-of-account row, instead of always assuming
    the shared 'Cash at Bank' (1120) row regardless of what was chosen."""
    defaults = defaults or _default_accounts()
    if bank_account is not None:
        return _chart_account_for_bank(bank_account)
    if payment_mode == 'Cash':
        return defaults['1110']
    return defaults['1120']


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

    # Outstanding invoice balances also move what a party owes/is owed —
    # previously only standalone Payment rows were counted here, so invoice
    # totals were invisible on the party ledger even after being recorded
    # (BUG-013). Sell invoices raise what the customer still owes us;
    # purchase invoices raise what we still owe the supplier.
    receivable = SellInvoice.objects.filter(party_id=party_id).exclude(
        status='Cancelled',
    ).aggregate(total=Sum('balance_due'))['total'] or Decimal('0')
    payable = PurchaseInvoice.objects.filter(supplier_id=party_id).exclude(
        status='Cancelled',
    ).aggregate(total=Sum('balance_due'))['total'] or Decimal('0')

    party.balance = party.opening_balance - received + made + receivable - payable
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
    cash_bank = account_for_cash_or_bank(payment.payment_mode, payment.bank_account, defaults)
    txn_type = 'Payment Received' if payment.direction == 'Received' else 'Payment Made'
    ref = payment.reference_no or f'{"RCPT" if payment.direction == "Received" else "PMT"}-{payment.id:04d}'
    if payment.direction == 'Received':
        debit = cash_bank
        credit = defaults['4100']
    else:
        debit = defaults['5100']
        credit = cash_bank
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


_INVOICE_TERMINAL_STATUSES = {
    'purchase': {'Recorded', 'Paid'},
    'sell': {'Issued', 'Paid'},
}


def sync_journal_for_invoice(invoice, kind):
    """Post (or remove) the journal Transaction for a Purchase/Sell invoice.

    Previously only the standalone Payment model posted to the journal
    (BUG-013) — invoices could sit at any total with nothing hitting the
    chart of accounts or the party ledger. Once an invoice reaches a
    'recorded'/'paid' terminal status this mirrors sync_journal_for_payment's
    posting logic (same cash/bank-account mapping from BUG-024); reverting to
    a non-terminal status (or Cancelled) removes the entry again.
    """
    is_purchase = kind == 'purchase'
    prefix = 'PI' if is_purchase else 'SI'
    ref = invoice.invoice_no or f'{prefix}-{invoice.id:04d}'
    terminal_statuses = _INVOICE_TERMINAL_STATUSES['purchase' if is_purchase else 'sell']

    if invoice.status not in terminal_statuses or _d(invoice.total_amount) <= 0:
        Transaction.objects.filter(reference_number=ref, transaction_date=invoice.invoice_date).delete()
        return

    defaults = _default_accounts()
    fully_paid = _d(invoice.balance_due) <= 0
    if fully_paid:
        settlement_account = account_for_cash_or_bank(invoice.payment_mode, None, defaults)
    else:
        settlement_account = defaults['2110'] if is_purchase else defaults['1130']

    party = invoice.supplier if is_purchase else invoice.party
    party_label = (invoice.supplier_name if is_purchase else invoice.party_name) or (party.name if party else '—')

    if is_purchase:
        txn_type = 'Payment Made'
        debit_account = defaults['5100']
        credit_account = settlement_account
    else:
        txn_type = 'Payment Received'
        debit_account = settlement_account
        credit_account = defaults['4100']

    Transaction.objects.update_or_create(
        reference_number=ref,
        transaction_date=invoice.invoice_date,
        defaults={
            'transaction_type': txn_type,
            'debit_account': debit_account,
            'credit_account': credit_account,
            'party': party,
            'bank_account': None,
            'payment_mode': invoice.payment_mode,
            'amount': invoice.total_amount,
            'description': f'{txn_type} — {prefix} {ref} ({party_label})',
            'status': 'Completed',
            'created_by': invoice.created_by,
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


def _payment_mode_for_voucher(raw_mode):
    mode = PAYMENT_MODE_MAP.get(raw_mode, raw_mode)
    valid_modes = {choice[0] for choice in Payment.MODE_CHOICES}
    if mode in valid_modes:
        return mode
    return 'Cash'


def sync_payment_voucher_for_employee_voucher(employee_voucher, user=None):
    """Mirror workforce labour vouchers into Accounts PaymentVoucher (BUG-020)."""
    from .models import PaymentVoucher
    from .document_services import next_document_number

    employee = employee_voucher.employee
    particulars = (employee_voucher.notes or '').strip()
    if employee_voucher.period_start and employee_voucher.period_end:
        period = f'{employee_voucher.period_start} to {employee_voucher.period_end}'
        particulars = f'{particulars} ({period})'.strip() if particulars else period

    defaults = {
        'voucher_date': employee_voucher.voucher_date,
        'entry_type': 'Expense',
        'payee_type': 'Labour',
        'payee_name': employee.name,
        'category': 'Labour',
        'particulars': particulars or f'Labour payment — {employee.employee_id}',
        'payment_mode': _payment_mode_for_voucher(employee_voucher.payment_mode),
        'amount': employee_voucher.amount,
        'status': 'Completed',
    }
    if user is not None:
        defaults['created_by'] = user

    payment_voucher, created = PaymentVoucher.objects.update_or_create(
        employee_voucher=employee_voucher,
        defaults=defaults,
    )
    if created and not payment_voucher.voucher_no:
        payment_voucher.voucher_no = next_document_number('EXP', PaymentVoucher, 'voucher_no')
        payment_voucher.save(update_fields=['voucher_no'])
    return payment_voucher


def remove_payment_voucher_for_employee_voucher(employee_voucher):
    PaymentVoucher.objects.filter(employee_voucher_id=employee_voucher.pk).delete()


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
