from django.db.models import F, Sum


def reports_dashboard(date_from=None, date_to=None):
    from apps.leads.models import Lead
    from apps.projects.models import Project
    from apps.accounts_module.models import Payment
    from apps.inventory.models import InventoryItem
    from apps.om.models import OmBreakdownTicket, OmMaintenanceTask
    from apps.om.pending_flow import pending_counts_global
    from apps.amc.models import AmcContract, AmcServiceRequest

    lead_qs = Lead.objects.all()
    if date_from:
        lead_qs = lead_qs.filter(created_at__date__gte=date_from)
    if date_to:
        lead_qs = lead_qs.filter(created_at__date__lte=date_to)

    from django.db.models import Count, Q

    lead_counts = lead_qs.aggregate(
        total=Count('id'),
        new=Count('id', filter=Q(status='New')),
        won=Count('id', filter=Q(status='Won')),
        follow_up=Count('id', filter=Q(status='Quotation')),
        quotation=Count('id', filter=Q(status='Quotation')),
    )
    total_leads = lead_counts['total'] or 0
    new_leads = lead_counts['new'] or 0
    won_leads = lead_counts['won'] or 0
    follow_up_done = lead_counts['follow_up'] or 0
    quotations = lead_counts['quotation'] or 0

    payment_qs = Payment.objects.filter(status='Completed', direction='Received')
    if date_from:
        payment_qs = payment_qs.filter(payment_date__gte=date_from)
    if date_to:
        payment_qs = payment_qs.filter(payment_date__lte=date_to)
    revenue = payment_qs.aggregate(total=Sum('amount'))['total'] or 0

    inv = InventoryItem.objects.filter(is_active=True)
    inv_counts = inv.aggregate(
        total_items=Count('id'),
        low_stock=Count('id', filter=Q(current_stock__lte=F('minimum_stock'), current_stock__gt=0)),
        out_of_stock=Count('id', filter=Q(current_stock__lte=0)),
        total_value=Sum(F('current_stock') * F('rate')),
    )
    inventory_value = inv_counts['total_value'] or 0

    from apps.accounts_module.services import accounts_dashboard_summary

    accounts = accounts_dashboard_summary()

    project_counts = Project.objects.aggregate(
        total=Count('id'),
        active=Count('id', filter=~Q(status__in=['Completed', 'Cancelled'])),
        completed=Count('id', filter=Q(status='Completed')),
    )

    return {
        'kpis': [
            {'title': 'Total Leads', 'value': str(total_leads), 'tone': 'blue'},
            {'title': 'New Leads', 'value': str(new_leads), 'tone': 'green'},
            {'title': 'Follow-ups', 'value': str(follow_up_done), 'tone': 'amber'},
            {'title': 'Quotations', 'value': str(quotations), 'tone': 'purple'},
            {'title': 'Leads Won', 'value': str(won_leads), 'tone': 'sky'},
        ],
        'projects': {
            'total': project_counts['total'] or 0,
            'active': project_counts['active'] or 0,
            'completed': project_counts['completed'] or 0,
        },
        'revenue': float(revenue),
        'inventory': {
            'total_items': inv_counts['total_items'] or 0,
            'low_stock': inv_counts['low_stock'] or 0,
            'out_of_stock': inv_counts['out_of_stock'] or 0,
            'total_value': float(inventory_value),
        },
        'operations': {
            'open_tickets': OmBreakdownTicket.objects.filter(status__in=['Open', 'In Progress']).count(),
            'pending_tasks': OmMaintenanceTask.objects.filter(status__in=['Pending', 'In Progress', 'Overdue']).count(),
            'active_amc': AmcContract.objects.filter(status='Active').count(),
            'open_amc_requests': AmcServiceRequest.objects.filter(status__in=['Open', 'In Progress']).count(),
            'pending_flow': pending_counts_global(),
        },
        'accounts': accounts,
    }
