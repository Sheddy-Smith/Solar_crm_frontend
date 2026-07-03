from django.db.models import Count, F, Sum

from .models import AmcClaim, AmcContract, AmcRenewal, AmcServiceRequest, AmcVisit, AmcWarranty


def amc_dashboard_summary():
    from datetime import timedelta
    from django.utils import timezone

    today = timezone.now().date()
    soon = today + timedelta(days=30)

    contracts = AmcContract.objects.all()
    active = contracts.filter(status='Active').count()
    expiring = contracts.filter(status='Expiring Soon').count()
    if not expiring:
        expiring = contracts.filter(
            status='Active', end_date__gte=today, end_date__lte=soon,
        ).count()

    return {
        'active_contracts': active,
        'expiring_contracts': expiring,
        'open_service_requests': AmcServiceRequest.objects.filter(status__in=['Open', 'In Progress']).count(),
        'pending_renewals': AmcRenewal.objects.filter(status='Pending').count(),
        'open_claims': AmcClaim.objects.filter(status__in=['Submitted', 'Under Review']).count(),
        'scheduled_visits': AmcVisit.objects.filter(status='Scheduled').count(),
        'active_warranties': AmcWarranty.objects.filter(status='Active').count(),
        'contract_value': contracts.filter(status='Active').aggregate(
            total=Sum('annual_value'),
        )['total'] or 0,
        'by_contract_type': list(
            contracts.values('contract_type').annotate(count=Count('id')).order_by('-count'),
        ),
    }
