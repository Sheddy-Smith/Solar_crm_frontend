from datetime import datetime

from django.db.models import Count, F, Sum


def reports_dashboard(date_from=None, date_to=None):
    from apps.leads.models import Lead
    from apps.projects.models import Project
    from apps.accounts_module.models import Payment
    from apps.inventory.models import InventoryItem
    from apps.om.models import OmBreakdownTicket, OmMaintenanceTask
    from apps.amc.models import AmcContract, AmcServiceRequest

    lead_qs = Lead.objects.all()
    if date_from:
        lead_qs = lead_qs.filter(created_at__date__gte=date_from)
    if date_to:
        lead_qs = lead_qs.filter(created_at__date__lte=date_to)

    total_leads = lead_qs.count()
    new_leads = lead_qs.filter(status='New').count()
    won_leads = lead_qs.filter(status='Won').count()
    follow_up_done = lead_qs.filter(status='Follow-up').count()
    site_visits = lead_qs.filter(status='Site Visit').count()

    payment_qs = Payment.objects.filter(status='Completed', direction='Received')
    if date_from:
        payment_qs = payment_qs.filter(payment_date__gte=date_from)
    if date_to:
        payment_qs = payment_qs.filter(payment_date__lte=date_to)
    revenue = payment_qs.aggregate(total=Sum('amount'))['total'] or 0

    inv = InventoryItem.objects.filter(is_active=True)
    inventory_value = inv.aggregate(val=Sum(F('current_stock') * F('rate')))['val'] or 0

    return {
        'kpis': [
            {'title': 'Total Leads', 'value': str(total_leads), 'tone': 'blue'},
            {'title': 'New Leads', 'value': str(new_leads), 'tone': 'green'},
            {'title': 'Follow-ups', 'value': str(follow_up_done), 'tone': 'amber'},
            {'title': 'Site Visits', 'value': str(site_visits), 'tone': 'purple'},
            {'title': 'Leads Won', 'value': str(won_leads), 'tone': 'sky'},
        ],
        'projects': {
            'total': Project.objects.count(),
            'active': Project.objects.exclude(status__in=['Completed', 'Cancelled']).count(),
            'completed': Project.objects.filter(status='Completed').count(),
        },
        'revenue': float(revenue),
        'inventory': {
            'total_items': inv.count(),
            'low_stock': inv.filter(current_stock__lte=F('minimum_stock'), current_stock__gt=0).count(),
            'out_of_stock': inv.filter(current_stock__lte=0).count(),
            'total_value': float(inventory_value),
        },
        'operations': {
            'open_tickets': OmBreakdownTicket.objects.filter(status__in=['Open', 'In Progress']).count(),
            'pending_tasks': OmMaintenanceTask.objects.filter(status__in=['Pending', 'In Progress', 'Overdue']).count(),
            'active_amc': AmcContract.objects.filter(status='Active').count(),
            'open_amc_requests': AmcServiceRequest.objects.filter(status__in=['Open', 'In Progress']).count(),
        },
    }
