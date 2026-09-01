"""Cross-module financial sync: Project Expense, Material Dispatch cost, Project P&L.

Preserves InventoryItem.rate as actual purchase cost.
MaterialPlan.planning_unit_price is the project planned/charge price.
Planning Difference = planning_unit_price − inventory rate (report-only; not mixed into material cost journals).
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from .category_map import (
    decimal_or_zero,
    resolve_material_coa,
    resolve_planning_difference_coa,
    resolve_project_expense_coa,
)
from .models import Payment, PaymentVoucher
from .services import (
    _payment_mode_for_voucher,
    remove_payment_voucher_and_journal,
    sync_journal_for_payment_voucher,
)


def _next_voucher_no(prefix='EXP'):
    from .document_services import next_document_number
    return next_document_number(prefix, PaymentVoucher, 'voucher_no')


# ─── Project Expense → PaymentVoucher → Journal ───────────────────────────────


@transaction.atomic
def sync_accounts_for_project_expense(expense, user=None):
    """Upsert PaymentVoucher + journal for a ProjectExpense. Idempotent via OneToOne FK."""
    amount = decimal_or_zero(expense.amount)
    # Pending expenses keep voucher for audit but skip journal (status Pending/cancelled).
    journal_status = 'Completed' if expense.status in ('Paid', 'Partial') and amount > 0 else 'Pending'

    if amount <= 0:
        remove_accounts_for_project_expense(expense)
        return None

    mode = _payment_mode_for_voucher(expense.payment_mode or 'Cash')
    defaults = {
        'voucher_date': expense.date or timezone.now().date(),
        'entry_type': 'Expense',
        'payee_type': 'Other',
        'payee_name': (expense.paid_by or '').strip() or expense.description or 'Project expense',
        'category': expense.category or 'Miscellaneous',
        'particulars': expense.description or f'Project expense — {expense.project.project_id}',
        'payment_mode': mode,
        'amount': amount,
        'project': expense.project,
        'status': journal_status if journal_status == 'Completed' else 'Pending',
    }
    if user is not None:
        defaults['created_by'] = user

    voucher, created = PaymentVoucher.objects.update_or_create(
        project_expense=expense,
        defaults=defaults,
    )
    if created and not voucher.voucher_no:
        voucher.voucher_no = _next_voucher_no('EXP')
        voucher.save(update_fields=['voucher_no'])

    sync_journal_for_payment_voucher(
        voucher,
        debit_account=resolve_project_expense_coa(expense.category),
    )
    return voucher


def remove_accounts_for_project_expense(expense):
    voucher = getattr(expense, 'accounts_voucher', None)
    if voucher is None:
        voucher = PaymentVoucher.objects.filter(project_expense_id=expense.pk).first()
    if voucher:
        remove_payment_voucher_and_journal(voucher)


# ─── Material Dispatch → Actual Material Cost (Inventory rate × qty) ───────────

@transaction.atomic
def sync_accounts_for_material_dispatch(plan, user=None):
    """
    Post actual warehouse cost for dispatched qty.
    Cost = dispatched_qty × InventoryItem.rate  (NOT planning_unit_price).
    """
    from apps.inventory.dispatch_sync import resolve_inventory_item

    qty = decimal_or_zero(plan.dispatched_qty)
    item = plan.inventory_item or resolve_inventory_item(plan)

    if qty <= 0 or item is None:
        remove_accounts_for_material_plan(plan)
        return {'synced': False, 'reason': 'no_qty_or_item'}

    unit_cost = decimal_or_zero(item.rate)
    total_cost = (qty * unit_cost).quantize(Decimal('0.01'))
    if total_cost <= 0:
        remove_accounts_for_material_plan(plan)
        return {'synced': False, 'reason': 'zero_cost'}

    category = (plan.category or item.category or 'Other').strip()
    project = plan.project
    project_ref = getattr(project, 'project_id', None) or f'PRJ-{plan.project_id}'
    voucher_date = plan.dispatch_date or timezone.now().date()

    defaults = {
        'voucher_date': voucher_date,
        'entry_type': 'Expense',
        'payee_type': 'Supplier',
        'payee_name': item.name or 'Material dispatch',
        'category': category,
        'particulars': (
            f'Material dispatch {project_ref} — {category} '
            f'(qty {qty} × inventory cost ₹{unit_cost})'
        ),
        'payment_mode': 'Other',
        'amount': total_cost,
        'project': project,
        'status': 'Completed',
    }
    if user is not None:
        defaults['created_by'] = user

    voucher, created = PaymentVoucher.objects.update_or_create(
        material_plan=plan,
        defaults=defaults,
    )
    if created and not voucher.voucher_no:
        voucher.voucher_no = _next_voucher_no('MAT')
        voucher.save(update_fields=['voucher_no'])

    sync_journal_for_payment_voucher(
        voucher,
        debit_account=resolve_material_coa(category),
    )
    return {
        'synced': True,
        'voucher_id': voucher.id,
        'actual_material_cost': float(total_cost),
        'unit_cost': float(unit_cost),
        'qty': float(qty),
    }


def remove_accounts_for_material_plan(plan):
    voucher = getattr(plan, 'cost_voucher', None)
    if voucher is None:
        voucher = PaymentVoucher.objects.filter(material_plan_id=plan.pk).first()
    if voucher:
        remove_payment_voucher_and_journal(voucher)


# ─── Planning price helpers (no journal — report metrics) ─────────────────────

def material_plan_pricing(plan):
    """
    Returns dict with inventory_unit_cost, planning_unit_price, unit_difference,
    planned_qty, inventory_total_cost, planning_total_value, planning_difference_total.
    Never mutates InventoryItem.rate.
    """
    from apps.inventory.dispatch_sync import resolve_inventory_item

    item = plan.inventory_item or resolve_inventory_item(plan)
    inventory_unit = decimal_or_zero(item.rate) if item else Decimal('0')
    planning_unit = plan.planning_unit_price
    if planning_unit is None or planning_unit == '':
        # Fallback: derive from planned_value / qty when planning_unit_price not set yet
        qty = decimal_or_zero(plan.planned_qty)
        planned_val = decimal_or_zero(plan.planned_value)
        planning_unit = (planned_val / qty) if qty > 0 and planned_val > 0 else inventory_unit
    else:
        planning_unit = decimal_or_zero(planning_unit)

    qty = decimal_or_zero(plan.planned_qty)
    unit_diff = planning_unit - inventory_unit
    return {
        'inventory_unit_cost': inventory_unit,
        'planning_unit_price': planning_unit,
        'unit_difference': unit_diff,
        'planned_qty': qty,
        'inventory_total_cost': (inventory_unit * qty).quantize(Decimal('0.01')),
        'planning_total_value': (planning_unit * qty).quantize(Decimal('0.01')),
        'planning_difference_total': (unit_diff * qty).quantize(Decimal('0.01')),
        'planning_difference_coa_code': getattr(resolve_planning_difference_coa(), 'account_code', '5410'),
    }


# ─── Project P&L ──────────────────────────────────────────────────────────────

_SELL_INVOICE_REVENUE_STATUSES = {'Issued', 'Paid'}


def _project_sell_invoice_revenue(project):
    """Accrual revenue from project-linked Sell Invoices (not customer payments)."""
    from .models import SellInvoice

    invoices = SellInvoice.objects.filter(
        project=project,
        status__in=_SELL_INVOICE_REVENUE_STATUSES,
    )
    return sum((decimal_or_zero(inv.total_amount) for inv in invoices), Decimal('0'))


def _project_customer_collections(project):
    """Cash collected against the project — reduces AR, not P&L revenue."""
    collected = Payment.objects.filter(
        project=project, direction='Received', status='Completed',
    ).aggregate(total=Coalesce(Sum('amount'), Decimal('0.00')))['total']
    return decimal_or_zero(collected)


def project_pnl(project):
    """
    Actual profitability:
      Revenue (Sell Invoices issued/paid for this project — accrual basis)
    − Actual Material Cost (dispatch cost vouchers / stock × inventory rate)
    − Labour (project expense labour only — general employee vouchers excluded)
    − Transport / Subcontractor / Other project expenses
    = Actual Profit

    Customer payments reduce Accounts Receivable; they are NOT added to revenue.

    Separately:
      Material Planning Value, Actual Material Cost, Planning Difference
    """
    revenue = _project_sell_invoice_revenue(project)
    collected = _project_customer_collections(project)
    outstanding_ar = (revenue - collected).quantize(Decimal('0.01'))
    if outstanding_ar < 0:
        outstanding_ar = Decimal('0.00')

    # Actual material cost from dispatch-linked cost vouchers
    material_vouchers = PaymentVoucher.objects.filter(
        material_plan__project=project, status='Completed',
    )
    actual_material = sum((v.amount for v in material_vouchers), Decimal('0'))

    # Project expenses by category
    expenses = list(project.expenses.all())
    labour_exp = sum((e.amount for e in expenses if e.category == 'Labor'), Decimal('0'))
    transport_exp = sum((e.amount for e in expenses if e.category == 'Transport'), Decimal('0'))
    materials_exp = sum((e.amount for e in expenses if e.category == 'Materials'), Decimal('0'))
    equipment_exp = sum((e.amount for e in expenses if e.category == 'Equipment'), Decimal('0'))
    misc_exp = sum((e.amount for e in expenses if e.category == 'Miscellaneous'), Decimal('0'))

    # Labour also from employee payment vouchers linked to this project
    labour_vouchers = PaymentVoucher.objects.filter(
        project=project, category__iexact='Labour', status='Completed',
        employee_voucher__isnull=False,
    )
    labour_from_vouchers = sum((v.amount for v in labour_vouchers), Decimal('0'))
    labour_total = labour_exp + labour_from_vouchers

    # Planning metrics across BOM lines
    plans = list(project.material_plans.select_related('inventory_item').all())
    planning_value = Decimal('0')
    planning_inventory_cost = Decimal('0')
    planning_difference = Decimal('0')
    for plan in plans:
        pricing = material_plan_pricing(plan)
        planning_value += pricing['planning_total_value']
        planning_inventory_cost += pricing['inventory_total_cost']
        planning_difference += pricing['planning_difference_total']

    # If no dispatch vouchers yet, actual material for P&L can still use inventory planned cost of dispatched qty
    if actual_material == 0:
        for plan in plans:
            qty = decimal_or_zero(plan.dispatched_qty)
            item = plan.inventory_item
            if qty > 0 and item:
                actual_material += (qty * decimal_or_zero(item.rate)).quantize(Decimal('0.01'))

    other_expenses = materials_exp + equipment_exp + misc_exp
    total_cost = actual_material + labour_total + transport_exp + other_expenses
    actual_profit = revenue - total_cost

    return {
        'project_id': project.project_id,
        'project_name': project.project_name,
        'revenue': float(revenue),
        'billing': {
            'revenue_from_sell_invoices': float(revenue),
            'collected_from_customer': float(collected),
            'outstanding_receivable': float(outstanding_ar),
            'note': (
                'Revenue is recognized on Sell Invoice (Dr AR / Cr Sales). '
                'Customer payments reduce Accounts Receivable only.'
            ),
        },
        'costs': {
            'actual_material_cost': float(actual_material),
            'labour_cost': float(labour_total),
            'transport_cost': float(transport_exp),
            'other_project_expenses': float(other_expenses),
            'materials_expense_manual': float(materials_exp),
            'equipment_cost': float(equipment_exp),
            'misc_cost': float(misc_exp),
            'total_cost': float(total_cost),
        },
        'actual_profit': float(actual_profit),
        'material_planning': {
            'planning_value': float(planning_value),
            'inventory_cost_of_planned_qty': float(planning_inventory_cost),
            'planning_difference': float(planning_difference),
            'note': (
                'Planning Difference = Planning Value − Inventory Cost. '
                'Not treated as actual purchase/material cost.'
            ),
            'difference_coa': getattr(resolve_planning_difference_coa(), 'account_code', '5410'),
        },
    }
