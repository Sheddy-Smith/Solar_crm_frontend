"""Authorized Customer merge + project reassignment (no auto phone merge)."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone


def _count_party_links(party_id: int) -> dict:
    from apps.leads.models import Lead, Quotation
    from apps.om.models import OmPlant
    from apps.projects.models import Project
    from .models import CustomerLedgerManualEntry, Payment, SellChallan, SellInvoice

    return {
        'leads': Lead.objects.filter(customer_id=party_id, is_deleted=False).count(),
        'projects': Project.objects.filter(customer_id=party_id, is_deleted=False).count(),
        'quotations': Quotation.objects.filter(customer_id=party_id, is_deleted=False).count(),
        'sell_invoices': SellInvoice.objects.filter(party_id=party_id).count(),
        'sell_challans': SellChallan.objects.filter(party_id=party_id).count(),
        'payments': Payment.objects.filter(party_id=party_id).count(),
        'manual_entries': CustomerLedgerManualEntry.objects.filter(party_id=party_id).count(),
        'om_plants': OmPlant.objects.filter(customer_id=party_id).count(),
    }


def preview_customer_merge(source_id: int, target_id: int) -> dict:
    from .customer_ledger import party_totals
    from .models import Account

    if source_id == target_id:
        raise ValueError('Source and target Customer must be different.')
    source = Account.objects.get(pk=source_id, account_type='Customer')
    target = Account.objects.get(pk=target_id, account_type='Customer')
    if source.status == 'Merged':
        raise ValueError('Source Customer is already merged.')
    if target.status == 'Merged':
        raise ValueError('Target Customer is merged and cannot receive records.')

    source_counts = _count_party_links(source.id)
    target_counts = _count_party_links(target.id)
    source_totals = party_totals(source)
    target_totals = party_totals(target)
    return {
        'source': {
            'id': source.id,
            'name': source.name,
            'phone': source.phone,
            'alternate_phone': source.alternate_phone,
            'status': source.status,
            'counts': source_counts,
            'totals': {k: float(v) if isinstance(v, Decimal) else v for k, v in source_totals.items() if k != 'last_date'},
            'last_date': source_totals.get('last_date').isoformat() if source_totals.get('last_date') else None,
        },
        'target': {
            'id': target.id,
            'name': target.name,
            'phone': target.phone,
            'alternate_phone': target.alternate_phone,
            'status': target.status,
            'counts': target_counts,
            'totals': {k: float(v) if isinstance(v, Decimal) else v for k, v in target_totals.items() if k != 'last_date'},
            'last_date': target_totals.get('last_date').isoformat() if target_totals.get('last_date') else None,
        },
        'warnings': _merge_warnings(source, target),
    }


def _merge_warnings(source, target) -> list:
    warnings = []
    from .services import normalize_phone
    if normalize_phone(source.phone) and normalize_phone(source.phone) != normalize_phone(target.phone):
        warnings.append('Primary mobile numbers differ — confirm this is the same customer.')
    if source.name.strip().lower() != target.name.strip().lower():
        warnings.append('Customer names differ.')
    if source.gstin and target.gstin and source.gstin != target.gstin:
        warnings.append('GSTIN values differ.')
    return warnings


@transaction.atomic
def execute_customer_merge(*, source_id: int, target_id: int, user=None, notes: str = '', confirm: bool = False) -> dict:
    """Reassign all relationships from source → target; soft-retire source as Merged."""
    if not confirm:
        raise ValueError('Merge requires explicit confirm=true.')
    preview = preview_customer_merge(source_id, target_id)
    from apps.leads.models import Lead, Quotation
    from apps.om.models import OmPlant
    from apps.projects.models import Project
    from .customer_ledger import party_totals
    from .models import (
        Account, CustomerLedgerManualEntry, CustomerMergeAudit, Payment, SellChallan, SellInvoice,
    )
    from .services import recalculate_party_balance

    source = Account.objects.select_for_update().get(pk=source_id, account_type='Customer')
    target = Account.objects.select_for_update().get(pk=target_id, account_type='Customer')

    reassignment = {
        'leads': Lead.objects.filter(customer_id=source.id).update(customer_id=target.id),
        'projects': Project.objects.filter(customer_id=source.id).update(customer_id=target.id),
        'quotations': Quotation.objects.filter(customer_id=source.id).update(customer_id=target.id),
        'sell_invoices': SellInvoice.objects.filter(party_id=source.id).update(party_id=target.id),
        'sell_challans': SellChallan.objects.filter(party_id=source.id).update(party_id=target.id),
        'payments': Payment.objects.filter(party_id=source.id).update(party_id=target.id),
        'manual_entries': CustomerLedgerManualEntry.objects.filter(party_id=source.id).update(party_id=target.id),
        'om_plants': OmPlant.objects.filter(customer_id=source.id).update(customer_id=target.id),
    }

    # Prefer filling empty target profile fields from source.
    fill_fields = []
    for field in ('email', 'address', 'city', 'state', 'gstin', 'alternate_phone', 'contact_person', 'company'):
        if not getattr(target, field) and getattr(source, field):
            setattr(target, field, getattr(source, field))
            fill_fields.append(field)
    if fill_fields:
        target.save(update_fields=fill_fields + ['updated_at'])

    source.status = 'Merged'
    source.merged_into = target
    source.merged_at = timezone.now()
    source.save(update_fields=['status', 'merged_into', 'merged_at', 'updated_at'])

    recalculate_party_balance(target.id)
    financial = {
        'source_before': preview['source']['totals'],
        'target_before': preview['target']['totals'],
        'target_after': {
            k: float(v) if isinstance(v, Decimal) else v
            for k, v in party_totals(target).items() if k != 'last_date'
        },
    }
    audit = CustomerMergeAudit.objects.create(
        source=source,
        target=target,
        merged_by=user if getattr(user, 'is_authenticated', False) else None,
        affected_counts=reassignment,
        financial_snapshot=financial,
        reassignment_details={'filled_target_fields': fill_fields},
        result='completed',
        notes=notes or '',
    )
    return {
        'ok': True,
        'audit_id': audit.id,
        'reassignment': reassignment,
        'financial_snapshot': financial,
        'source_id': source.id,
        'target_id': target.id,
    }


def detect_duplicate_customers(limit: int = 100) -> list:
    """Group Active Customers sharing the same normalized primary mobile (suggestion only)."""
    from collections import defaultdict
    from .models import Account
    from .services import normalize_phone

    groups = defaultdict(list)
    qs = Account.objects.filter(account_type='Customer').exclude(status='Merged').exclude(phone='')
    for party in qs.order_by('id'):
        key = party.normalized_phone or normalize_phone(party.phone)
        if not key:
            continue
        groups[key].append({
            'id': party.id,
            'name': party.name,
            'phone': party.phone,
            'alternate_phone': party.alternate_phone,
            'status': party.status,
            'balance': float(party.balance or 0),
        })
    out = []
    for key, members in groups.items():
        if len(members) < 2:
            continue
        out.append({'normalized_phone': key, 'customers': members, 'count': len(members)})
        if len(out) >= limit:
            break
    return out


@transaction.atomic
def reassign_project_customer(*, project_id: int, new_customer_id: int, user=None, update_party_on_docs: bool = True) -> dict:
    """Move a Project to another Customer; optionally re-point financial docs' party FK."""
    from apps.projects.models import Project
    from .models import Account, Payment, SellChallan, SellInvoice
    from .services import recalculate_party_balance

    project = Project.objects.select_for_update().get(pk=project_id, is_deleted=False)
    new_customer = Account.objects.get(pk=new_customer_id, account_type='Customer')
    if new_customer.status == 'Merged':
        raise ValueError('Cannot reassign Project to a merged Customer.')
    old_customer_id = project.customer_id
    project.customer = new_customer
    if not project.customer_name:
        project.customer_name = new_customer.name
    else:
        project.customer_name = new_customer.name
    project.save(update_fields=['customer', 'customer_name', 'updated_at'])

    docs = {'sell_invoices': 0, 'sell_challans': 0, 'payments': 0}
    if update_party_on_docs:
        docs['sell_invoices'] = SellInvoice.objects.filter(project_id=project.id).update(party_id=new_customer.id)
        docs['sell_challans'] = SellChallan.objects.filter(project_id=project.id).update(party_id=new_customer.id)
        docs['payments'] = Payment.objects.filter(project_id=project.id).update(party_id=new_customer.id)
    if old_customer_id:
        recalculate_party_balance(old_customer_id)
    recalculate_party_balance(new_customer.id)
    return {
        'ok': True,
        'project_id': project.id,
        'old_customer_id': old_customer_id,
        'new_customer_id': new_customer.id,
        'documents_updated': docs,
        'reassigned_by': getattr(user, 'id', None),
    }


@transaction.atomic
def allocate_payment_to_project(*, payment_id: int, project_id: int, amount, user=None, notes: str = '') -> dict:
    """Allocate (part of) an unallocated customer payment to a Project."""
    from decimal import Decimal, InvalidOperation
    from apps.projects.models import Project
    from .models import Payment, PaymentAllocation
    from .services import recalculate_party_balance

    try:
        amount = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError('Invalid allocation amount.') from exc
    if amount <= 0:
        raise ValueError('Allocation amount must be greater than zero.')

    payment = Payment.objects.select_for_update().get(pk=payment_id)
    if payment.direction != 'Received' or payment.status != 'Completed':
        raise ValueError('Only completed received payments can be allocated.')
    if payment.project_id is not None:
        raise ValueError('Payment is already linked to a Project. Create a separate advance for unallocated funds.')
    project = Project.objects.get(pk=project_id, is_deleted=False)
    if payment.party_id and project.customer_id and payment.party_id != project.customer_id:
        raise ValueError('Payment party and Project customer do not match.')

    from django.db.models import Sum
    allocated = PaymentAllocation.objects.filter(payment_id=payment.id).aggregate(t=Sum('amount'))['t'] or Decimal('0')
    remaining = Decimal(str(payment.amount)) - Decimal(str(allocated))
    if amount > remaining:
        raise ValueError(f'Allocation exceeds remaining unallocated amount ({remaining}).')

    alloc = PaymentAllocation.objects.create(
        payment=payment,
        project=project,
        amount=amount,
        notes=notes or '',
        created_by=user if getattr(user, 'is_authenticated', False) else None,
    )
    # If fully allocated, stamp the payment with the project for single-project advances.
    if amount == remaining and allocated == 0:
        payment.project = project
        payment.receipt_source = payment.receipt_source or 'Advance'
        payment.save(update_fields=['project', 'receipt_source', 'updated_at'])
    if payment.party_id:
        recalculate_party_balance(payment.party_id)
    return {
        'ok': True,
        'allocation_id': alloc.id,
        'payment_id': payment.id,
        'project_id': project.id,
        'amount': float(amount),
        'remaining_unallocated': float(remaining - amount),
    }
