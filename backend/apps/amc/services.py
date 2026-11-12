from django.db.models import Count, F, Sum

from .models import AmcClaim, AmcContract, AmcRenewal, AmcServiceRequest, AmcVisit, AmcWarranty


def amc_dashboard_summary(date_from=None, date_to=None):
    from datetime import timedelta
    from django.utils import timezone

    today = timezone.now().date()
    soon = today + timedelta(days=30)

    # Live operational snapshots (active/expiring) stay current; period filter
    # scopes "created in range" style counts when dates are provided.
    contracts = AmcContract.objects.all()
    period_contracts = contracts
    if date_from:
        period_contracts = period_contracts.filter(created_at__date__gte=date_from)
    if date_to:
        period_contracts = period_contracts.filter(created_at__date__lte=date_to)

    active = contracts.filter(status='Active').count()
    expiring = contracts.filter(status='Expiring Soon').count()
    if not expiring:
        expiring = contracts.filter(
            status='Active', end_date__gte=today, end_date__lte=soon,
        ).count()

    open_requests = AmcServiceRequest.objects.filter(status__in=['Open', 'In Progress'])
    if date_from:
        open_requests = open_requests.filter(created_at__date__gte=date_from)
    if date_to:
        open_requests = open_requests.filter(created_at__date__lte=date_to)

    return {
        'active_contracts': active,
        'expiring_contracts': expiring,
        'open_service_requests': open_requests.count(),
        'pending_renewals': AmcRenewal.objects.filter(status='Pending').count(),
        'open_claims': AmcClaim.objects.filter(status__in=['Submitted', 'Under Review']).count(),
        'scheduled_visits': AmcVisit.objects.filter(status='Scheduled').count(),
        'active_warranties': AmcWarranty.objects.filter(status='Active').count(),
        'contract_value': contracts.filter(status='Active').aggregate(
            total=Sum('annual_value'),
        )['total'] or 0,
        'period_contracts': period_contracts.count(),
        'by_contract_type': list(
            contracts.values('contract_type').annotate(count=Count('id')).order_by('-count'),
        ),
        'date_filtered': bool(date_from or date_to),
    }
