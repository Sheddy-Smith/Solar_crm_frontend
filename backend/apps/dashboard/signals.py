"""Invalidate unified dashboard cache when aggregate-driving CRM rows change."""
from django.db.models.signals import post_delete, post_save

from .services import invalidate_unified_dashboard_cache

# Models whose creates/updates/deletes move dashboard totals, alerts, or KPIs.
_WATCHED = (
    ('leads', 'Lead'),
    ('leads', 'FollowUp'),
    ('leads', 'Quotation'),
    ('projects', 'Project'),
    ('projects', 'SiteSurvey'),
    ('projects', 'WorkOrder'),
    ('projects', 'ProjectPayment'),
    ('projects', 'MaterialPlan'),
    ('projects', 'BomVersion'),
    ('projects', 'BomLine'),
    ('accounts_module', 'Payment'),
    ('accounts_module', 'PaymentVoucher'),
    ('accounts_module', 'PurchaseChallan'),
    ('accounts_module', 'PurchaseInvoice'),
    ('inventory', 'InventoryItem'),
    ('inventory', 'StockMovement'),
    ('amc', 'AmcContract'),
    ('amc', 'AmcServiceRequest'),
    ('om', 'OmBreakdownTicket'),
    ('om', 'OmMaintenanceTask'),
)


def _on_crm_write(sender, **kwargs):
    label = f'{sender._meta.app_label}.{sender._meta.model_name}'
    invalidate_unified_dashboard_cache(reason=label)


def connect_dashboard_invalidation():
    for app_label, model in _WATCHED:
        post_save.connect(_on_crm_write, sender=f'{app_label}.{model}', weak=False)
        post_delete.connect(_on_crm_write, sender=f'{app_label}.{model}', weak=False)
