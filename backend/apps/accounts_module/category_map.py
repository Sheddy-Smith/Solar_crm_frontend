"""Category → Chart of Account mapping helpers + recommended COA seed.

Inventory purchase cost stays on InventoryItem.rate.
Material Planning uses MaterialPlan.planning_unit_price.
Difference = planning price − inventory cost (never mixed into purchase cost).
"""

from decimal import Decimal

from django.db import transaction

from .models import AccountCategoryMap, ChartOfAccount


# Recommended chart of accounts (account_code, name, type, parent_code or None)
RECOMMENDED_COA = [
    ('4000', 'Income', 'Income', None),
    ('4100', 'Sales Revenue', 'Income', '4000'),
    ('5000', 'Direct Project Cost', 'Expense', None),
    ('5210', 'Material — Panels', 'Expense', '5000'),
    ('5220', 'Material — Inverters', 'Expense', '5000'),
    ('5230', 'Material — Structure', 'Expense', '5000'),
    ('5240', 'Material — Cables', 'Expense', '5000'),
    ('5310', 'Direct Labour', 'Expense', '5000'),
    ('5320', 'Transport & Logistics', 'Expense', '5000'),
    ('5330', 'Subcontractor', 'Expense', '5000'),
    ('5400', 'Material Planning', 'Expense', None),
    ('5410', 'Material Planning Price Difference', 'Expense', '5400'),
    ('6000', 'Overheads', 'Expense', None),
    ('6100', 'Office Expense', 'Expense', '6000'),
    ('6200', 'Admin Salaries', 'Expense', '6000'),
]

# (business_module, business_category, account_code)
DEFAULT_CATEGORY_MAPS = [
    ('Material', 'Panel', '5210'),
    ('Material', 'Panels', '5210'),
    ('Material', 'Solar Panel', '5210'),
    ('Material', 'Modules', '5210'),
    ('Material', 'Inverter', '5220'),
    ('Material', 'Invertor', '5220'),
    ('Material', 'Structure', '5230'),
    ('Material', 'Cable', '5240'),
    ('Material', 'Cables', '5240'),
    ('Material', 'Other', '5210'),
    ('Labour', 'Labour', '5310'),
    ('Labour', 'Labor', '5310'),
    ('Transport', 'Transport', '5320'),
    ('Subcontractor', 'Subcontractor', '5330'),
    ('ProjectExpense', 'Materials', '5210'),
    ('ProjectExpense', 'Labor', '5310'),
    ('ProjectExpense', 'Transport', '5320'),
    ('ProjectExpense', 'Equipment', '5330'),
    ('ProjectExpense', 'Miscellaneous', '5100'),
    ('PlanningDifference', 'Material Planning Price Difference', '5410'),
    ('Revenue', 'Sales', '4100'),
    ('Revenue', 'Customer Receipt', '4100'),
]


def ensure_recommended_coa():
    """Idempotently create recommended COA rows + baseline category maps."""
    # Also ensure legacy defaults used by payment journals exist.
    from .services import _default_accounts
    _default_accounts()

    by_code = {}
    with transaction.atomic():
        for code, name, acct_type, parent_code in RECOMMENDED_COA:
            parent = by_code.get(parent_code) if parent_code else None
            obj, created = ChartOfAccount.objects.get_or_create(
                account_code=code,
                defaults={
                    'account_name': name,
                    'account_type': acct_type,
                    'parent': parent,
                    'is_active': True,
                },
            )
            if not created and parent and obj.parent_id is None:
                obj.parent = parent
                obj.save(update_fields=['parent'])
            by_code[code] = obj

        for module, category, code in DEFAULT_CATEGORY_MAPS:
            coa = by_code.get(code) or ChartOfAccount.objects.filter(account_code=code).first()
            if not coa:
                continue
            AccountCategoryMap.objects.get_or_create(
                business_module=module,
                business_category=category,
                defaults={'chart_account': coa, 'is_active': True},
            )
    return {
        'coa_count': ChartOfAccount.objects.filter(account_code__in=by_code.keys()).count(),
        'map_count': AccountCategoryMap.objects.count(),
    }


def _normalize_category(value):
    return (value or '').strip()


def resolve_coa_for_category(business_module, business_category, fallback_code='5100'):
    """
    Resolve ChartOfAccount for a business category.
    Exact match first, then case-insensitive contains, then module default, then fallback code.
    """
    module = (business_module or 'Other').strip()
    category = _normalize_category(business_category)

    qs = AccountCategoryMap.objects.filter(
        business_module=module, is_active=True,
    ).select_related('chart_account')

    if category:
        exact = qs.filter(business_category__iexact=category).first()
        if exact:
            return exact.chart_account

        cat_lower = category.lower()
        for row in qs:
            key = (row.business_category or '').lower()
            if key and (key in cat_lower or cat_lower in key):
                return row.chart_account

    # Module-level catch-alls
    for fallback_cat in ('Other', 'Miscellaneous', 'Default', category):
        if not fallback_cat:
            continue
        row = qs.filter(business_category__iexact=fallback_cat).first()
        if row:
            return row.chart_account

    defaults = ChartOfAccount.objects.filter(account_code=fallback_code, is_active=True).first()
    if defaults:
        return defaults
    # Last resort: create fallback expense ledger
    obj, _ = ChartOfAccount.objects.get_or_create(
        account_code=fallback_code,
        defaults={'account_name': 'General Expenses', 'account_type': 'Expense', 'is_active': True},
    )
    return obj


def resolve_material_coa(category_name):
    return resolve_coa_for_category('Material', category_name, fallback_code='5210')


def resolve_labour_coa():
    return resolve_coa_for_category('Labour', 'Labour', fallback_code='5310')


def resolve_project_expense_coa(expense_category):
    return resolve_coa_for_category('ProjectExpense', expense_category, fallback_code='5100')


def resolve_planning_difference_coa():
    return resolve_coa_for_category(
        'PlanningDifference', 'Material Planning Price Difference', fallback_code='5410',
    )


def resolve_revenue_coa():
    return resolve_coa_for_category('Revenue', 'Sales', fallback_code='4100')


def decimal_or_zero(value):
    try:
        return Decimal(str(value or '0').replace(',', '').strip() or '0')
    except Exception:
        return Decimal('0')
