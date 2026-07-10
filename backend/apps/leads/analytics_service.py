from django.db.models import Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone

from .models import Lead


def lead_analytics(
    date_from=None,
    date_to=None,
    project_type=None,
    status_filter=None,
    assigned_to=None,
):
    qs = Lead.objects.all()
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    if project_type and project_type != 'All':
        qs = qs.filter(project_type=project_type)
    if status_filter and status_filter != 'All':
        qs = qs.filter(status=status_filter)
    if assigned_to and assigned_to != 'All':
        qs = qs.filter(assigned_to__name__icontains=assigned_to)

    status_dist = list(qs.values('status').annotate(count=Count('id')).order_by('status'))

    monthly = list(
        qs.annotate(month=TruncMonth('created_at'))
        .values('month')
        .annotate(
            new=Count('id', filter=Q(status='New')),
            follow_up=Count('id', filter=Q(status='Follow-up')),
            won=Count('id', filter=Q(status='Won')),
            total=Count('id'),
        )
        .order_by('month')
    )
    for m in monthly:
        m['month'] = m['month'].strftime('%b %Y') if m['month'] else '—'

    employee_stats = list(
        qs.filter(assigned_to__isnull=False)
        .values('assigned_to__name')
        .annotate(
            total=Count('id'),
            won=Count('id', filter=Q(status='Won')),
            lost=Count('id', filter=Q(status='Lost')),
        )
        .order_by('-total')[:10]
    )
    for e in employee_stats:
        total = e['total'] or 1
        e['conversion'] = round((e['won'] / total) * 100, 1)
        e['name'] = e.pop('assigned_to__name') or 'Unassigned'

    project_type_stats = list(
        qs.values('project_type')
        .annotate(
            total=Count('id'),
            won=Count('id', filter=Q(status='Won')),
        )
        .order_by('-total')
    )
    for p in project_type_stats:
        total = p['total'] or 1
        p['conversion'] = round((p['won'] / total) * 100, 1)
        p['type'] = p.pop('project_type') or 'Unknown'

    total = qs.count()
    won = qs.filter(status='Won').count()
    with_ivrs = qs.exclude(ivrs_number='').count()

    return {
        'total': total,
        'won': won,
        'lost': qs.filter(status='Lost').count(),
        'conversion_rate': round((won / total * 100), 1) if total else 0,
        'overdue': qs.filter(
            next_follow_up__lt=timezone.now(),
            status__in=['New', 'Follow-up'],
        ).count(),
        'status_distribution': status_dist,
        'monthly_trend': monthly,
        'employee_stats': employee_stats,
        'project_type_stats': project_type_stats,
        'ivrs_summary': {
            'total_with_ivrs': with_ivrs,
            'coverage_pct': round((with_ivrs / total * 100), 1) if total else 0,
        },
    }
