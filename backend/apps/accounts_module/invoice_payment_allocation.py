"""Invoice-wise Payment Allocation — service layer.

Payment = money received (cash journal once).
SellInvoice = customer receivable (AR journal once).
InvoicePaymentAllocation = how much of a Payment settles a specific invoice.

Does NOT create cash/bank journals. Updates invoice settlement fields only.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .category_map import decimal_or_zero
from .models import InvoicePaymentAllocation, Payment, SellInvoice


TWOPLACES = Decimal('0.01')
ZERO = Decimal('0.00')


def _money(value) -> Decimal:
    return decimal_or_zero(value).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def active_allocations_qs(invoice_id=None, payment_id=None):
    qs = InvoicePaymentAllocation.objects.filter(status=InvoicePaymentAllocation.STATUS_ACTIVE)
    if invoice_id is not None:
        qs = qs.filter(invoice_id=invoice_id)
    if payment_id is not None:
        qs = qs.filter(payment_id=payment_id)
    return qs


def sum_active_allocations(*, invoice_id=None, payment_id=None) -> Decimal:
    total = active_allocations_qs(invoice_id=invoice_id, payment_id=payment_id).aggregate(
        total=Sum('allocated_amount'),
    )['total']
    return _money(total or 0)


def payment_available_amount(payment: Payment, *, exclude_allocation_id=None) -> Decimal:
    used = active_allocations_qs(payment_id=payment.id)
    if exclude_allocation_id:
        used = used.exclude(id=exclude_allocation_id)
    allocated = _money(used.aggregate(total=Sum('allocated_amount'))['total'] or 0)
    return max(_money(payment.amount) - allocated, ZERO)


def invoice_allocated_amount(invoice: SellInvoice, *, exclude_allocation_id=None) -> Decimal:
    qs = active_allocations_qs(invoice_id=invoice.id)
    if exclude_allocation_id:
        qs = qs.exclude(id=exclude_allocation_id)
    return _money(qs.aggregate(total=Sum('allocated_amount'))['total'] or 0)


def invoice_has_active_allocations(invoice: SellInvoice) -> bool:
    return active_allocations_qs(invoice_id=invoice.id).exists()


def invoice_has_allocation_history(invoice: SellInvoice) -> bool:
    return InvoicePaymentAllocation.objects.filter(invoice_id=invoice.id).exists()


def invoice_effective_paid(invoice: SellInvoice) -> Decimal:
    """Single source for paid amount.

    Prefer sum of active InvoicePaymentAllocation rows once any allocation history exists.
    Otherwise fall back to legacy SellInvoice.payment_amount (manual scalar —
    not inventing Payment rows). Flagged via invoice_settlement_summary.legacy_manual_paid.
    """
    if invoice_has_allocation_history(invoice):
        return invoice_allocated_amount(invoice)
    return _money(getattr(invoice, 'payment_amount', 0))


def invoice_outstanding(invoice: SellInvoice, *, exclude_allocation_id=None) -> Decimal:
    total = _money(invoice.total_amount)
    if exclude_allocation_id is not None or invoice_has_allocation_history(invoice):
        paid = invoice_allocated_amount(invoice, exclude_allocation_id=exclude_allocation_id)
    else:
        paid = invoice_effective_paid(invoice)
    return max(total - paid, ZERO)


def invoice_payment_status(invoice: SellInvoice) -> str:
    if invoice.status == 'Cancelled':
        return 'Cancelled'
    outstanding = invoice_outstanding(invoice)
    paid = invoice_effective_paid(invoice)
    if outstanding <= ZERO and _money(invoice.total_amount) > ZERO:
        return 'Paid'
    if paid > ZERO:
        return 'Partially Paid'
    return 'Unpaid'


@transaction.atomic
def refresh_invoice_settlement(invoice: SellInvoice, *, sync_status: bool = True) -> SellInvoice:
    """Recalculate payment_amount / balance_due from allocations (or legacy scalar)."""
    invoice = SellInvoice.objects.select_for_update().get(pk=invoice.pk)
    allocated = invoice_allocated_amount(invoice)
    if invoice_has_allocation_history(invoice):
        # Allocation system owns payment_amount once any IPA row exists (incl. reversed).
        invoice.payment_amount = allocated
    paid = invoice_effective_paid(invoice)
    balance = max(_money(invoice.total_amount) - paid, ZERO)
    invoice.balance_due = balance
    update_fields = ['payment_amount', 'balance_due', 'updated_at']
    if sync_status and invoice.status != 'Cancelled':
        if balance <= ZERO and _money(invoice.total_amount) > ZERO and invoice.status in ('Pending', 'Issued', 'Paid'):
            invoice.status = 'Paid'
            update_fields.append('status')
        elif balance > ZERO and invoice.status == 'Paid':
            invoice.status = 'Issued'
            update_fields.append('status')
    invoice.save(update_fields=update_fields)
    return invoice


def invoice_settlement_summary(invoice: SellInvoice) -> dict:
    allocated = invoice_allocated_amount(invoice)
    legacy = _money(invoice.payment_amount)
    has_history = invoice_has_allocation_history(invoice)
    paid = invoice_effective_paid(invoice)
    total = _money(invoice.total_amount)
    balance = max(total - paid, ZERO)
    history = list(
        InvoicePaymentAllocation.objects.filter(invoice_id=invoice.id)
        .select_related('payment', 'allocated_by', 'reversed_by')
        .order_by('-allocated_at', '-id')
    )
    return {
        'invoice_id': invoice.id,
        'invoice_no': invoice.invoice_no or f'SI-{invoice.id:04d}',
        'invoice_total': float(total),
        'total_allocated': float(allocated),
        'legacy_manual_paid': float(legacy) if not has_history and legacy > ZERO else 0.0,
        'legacy_unreconciled': bool(not has_history and legacy > ZERO),
        'balance_due': float(balance),
        'payment_status': invoice_payment_status(invoice),
        'allocations': [
            {
                'id': row.id,
                'payment_id': row.payment_id,
                'receipt_no': row.payment.reference_no or f'RCPT-{row.payment_id:04d}',
                'payment_date': row.payment.payment_date.isoformat() if row.payment.payment_date else None,
                'payment_mode': row.payment.payment_mode,
                'reference': row.payment.reference_no or '',
                'allocated_amount': float(_money(row.allocated_amount)),
                'status': row.status,
                'notes': row.notes or '',
                'allocated_at': row.allocated_at.isoformat() if row.allocated_at else None,
                'reversal_reason': row.reversal_reason or '',
            }
            for row in history
        ],
    }


def _assert_parties_match(payment: Payment, invoice: SellInvoice):
    if payment.party_id and invoice.party_id and payment.party_id != invoice.party_id:
        raise ValidationError(
            'Payment customer must match Sell Invoice customer. '
            'Use Customer Master merge/reassign before allocating.'
        )
    # If only one side has party, allow when names loosely match is too risky — require party on both.
    if not payment.party_id or not invoice.party_id:
        raise ValidationError('Both Payment and Sell Invoice must have a linked Customer party.')


def _assert_projects_match(payment: Payment, invoice: SellInvoice):
    if payment.project_id and invoice.project_id and payment.project_id != invoice.project_id:
        raise ValidationError(
            'Payment is linked to a different Project than this Sell Invoice.'
        )
    if payment.project_id and not invoice.project_id:
        raise ValidationError('Sell Invoice has no Project; cannot allocate a project-linked Payment.')


def _validate_payment_for_allocation(payment: Payment):
    if payment.direction != 'Received':
        raise ValidationError('Only Received (Cash Receipt) payments can be allocated to invoices.')
    if payment.status != 'Completed':
        raise ValidationError('Only Completed payments can be allocated.')
    if _money(payment.amount) <= ZERO:
        raise ValidationError('Payment amount must be greater than zero.')


def _validate_invoice_for_allocation(invoice: SellInvoice):
    if invoice.status == 'Cancelled':
        raise ValidationError('Cannot allocate to a Cancelled Sell Invoice.')
    if _money(invoice.total_amount) <= ZERO:
        raise ValidationError('Invoice total must be greater than zero.')


@transaction.atomic
def allocate_payment_to_invoice(
    *,
    payment_id: int,
    invoice_id: int,
    allocated_amount,
    user=None,
    notes: str = '',
) -> InvoicePaymentAllocation:
    amount = _money(allocated_amount)
    if amount <= ZERO:
        raise ValidationError('Allocation amount must be greater than zero.')

    payment = Payment.objects.select_for_update().get(pk=payment_id)
    invoice = SellInvoice.objects.select_for_update().get(pk=invoice_id)

    _validate_payment_for_allocation(payment)
    _validate_invoice_for_allocation(invoice)
    _assert_parties_match(payment, invoice)
    _assert_projects_match(payment, invoice)

    available = payment_available_amount(payment)
    outstanding = invoice_outstanding(invoice)

    if amount > available:
        raise ValidationError(
            f'Allocation {amount} exceeds payment available amount {available}.'
        )
    if amount > outstanding:
        raise ValidationError(
            f'Allocation {amount} exceeds invoice outstanding {outstanding}.'
        )

    row = InvoicePaymentAllocation.objects.create(
        payment=payment,
        invoice=invoice,
        allocated_amount=amount,
        status=InvoicePaymentAllocation.STATUS_ACTIVE,
        notes=(notes or '').strip(),
        allocated_by=user,
    )
    refresh_invoice_settlement(invoice)
    return row


@transaction.atomic
def allocate_payment_bulk(
    *,
    payment_id: int,
    lines: list,
    user=None,
) -> list:
    """lines: [{invoice_id, allocated_amount, notes?}, ...]"""
    if not lines:
        raise ValidationError('At least one allocation line is required.')
    created = []
    # Lock payment once; each allocate_payment_to_invoice re-locks safely in same atomic block.
    Payment.objects.select_for_update().get(pk=payment_id)
    for line in lines:
        row = allocate_payment_to_invoice(
            payment_id=payment_id,
            invoice_id=int(line['invoice_id']),
            allocated_amount=line.get('allocated_amount'),
            user=user,
            notes=line.get('notes') or '',
        )
        created.append(row)
    return created


@transaction.atomic
def reverse_invoice_allocation(
    *,
    allocation_id: int,
    user=None,
    reversal_reason: str = '',
) -> InvoicePaymentAllocation:
    reason = (reversal_reason or '').strip()
    if not reason:
        raise ValidationError('Reversal reason is required.')

    row = InvoicePaymentAllocation.objects.select_for_update().select_related('invoice').get(
        pk=allocation_id,
    )
    if row.status == InvoicePaymentAllocation.STATUS_REVERSED:
        raise ValidationError('Allocation is already reversed.')

    row.status = InvoicePaymentAllocation.STATUS_REVERSED
    row.reversed_by = user
    row.reversed_at = timezone.now()
    row.reversal_reason = reason
    row.save(update_fields=[
        'status', 'reversed_by', 'reversed_at', 'reversal_reason', 'updated_at',
    ])
    refresh_invoice_settlement(row.invoice)
    return row


def assert_payment_amount_covers_allocations(payment: Payment, new_amount) -> None:
    """Block shrinking a Payment below active invoice allocations."""
    active = sum_active_allocations(payment_id=payment.id)
    if _money(new_amount) < active:
        raise ValidationError(
            f'Cannot set payment amount below active invoice allocations ({active}). '
            'Reverse or adjust allocations first.'
        )


def outstanding_invoices_for_receipt(*, party_id, project_id=None) -> list:
    """Eligible Sell Invoices for Cash Receipt allocation UI."""
    qs = SellInvoice.objects.filter(party_id=party_id).exclude(status='Cancelled')
    if project_id:
        qs = qs.filter(project_id=project_id)
    qs = qs.select_related('project').order_by('invoice_date', 'id')
    rows = []
    for inv in qs:
        outstanding = invoice_outstanding(inv)
        if outstanding <= ZERO:
            continue
        paid = invoice_effective_paid(inv)
        rows.append({
            'id': inv.id,
            'invoice_no': inv.invoice_no or f'SI-{inv.id:04d}',
            'invoice_date': inv.invoice_date.isoformat() if inv.invoice_date else None,
            'project_id': inv.project_id,
            'project_name': inv.project.project_name if inv.project_id else '',
            'total_amount': float(_money(inv.total_amount)),
            'already_paid': float(paid),
            'outstanding': float(outstanding),
            'status': inv.status,
            'payment_status': invoice_payment_status(inv),
        })
    return rows


def legacy_payment_amount_audit(limit: int = 500) -> dict:
    """Report invoices with legacy payment_amount but no InvoicePaymentAllocation rows."""
    flagged = []
    qs = SellInvoice.objects.filter(payment_amount__gt=0).exclude(status='Cancelled').order_by('-invoice_date')[:limit]
    for inv in qs:
        if invoice_has_active_allocations(inv):
            continue
        flagged.append({
            'invoice_id': inv.id,
            'invoice_no': inv.invoice_no,
            'party_id': inv.party_id,
            'project_id': inv.project_id,
            'total_amount': float(_money(inv.total_amount)),
            'legacy_payment_amount': float(_money(inv.payment_amount)),
            'balance_due': float(_money(inv.balance_due)),
            'note': 'Manual payment_amount without linked Payment allocation — do not fabricate receipts.',
        })
    return {
        'flagged_count': len(flagged),
        'flagged': flagged,
        'guidance': (
            'Do not invent Payment or bank journals for these rows. '
            'Reconcile manually by creating real Cash Receipts and InvoicePaymentAllocation rows.'
        ),
    }
