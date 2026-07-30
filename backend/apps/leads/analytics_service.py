from collections import defaultdict
from datetime import date, datetime, time, timedelta

from django.db.models import Count, Q
from django.utils import timezone
from django.utils.timezone import localtime

from .models import Lead


def _parse_iso_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _day_start(d: date):
    return timezone.make_aware(datetime.combine(d, time.min))


def _apply_created_at_date_bounds(qs, date_from=None, date_to=None):
    """Filter by calendar dates without MySQL CONVERT_TZ (__date lookups)."""
    start_d = _parse_iso_date(date_from)
    end_d = _parse_iso_date(date_to)
    if start_d:
        qs = qs.filter(created_at__gte=_day_start(start_d))
    if end_d:
        qs = qs.filter(created_at__lt=_day_start(end_d) + timedelta(days=1))
    return qs


def lead_analytics(
    date_from=None,
    date_to=None,
    project_type=None,
    status_filter=None,
    assigned_to=None,
):
    qs = Lead.objects.filter(is_deleted=False)
    qs = _apply_created_at_date_bounds(qs, date_from, date_to)
    if project_type and project_type != 'All':
        qs = qs.filter(project_type=project_type)
    if status_filter and status_filter != 'All':
        qs = qs.filter(status=status_filter)
    if assigned_to and assigned_to != 'All':
        qs = qs.filter(assigned_to__name__icontains=assigned_to)

    status_dist = list(qs.values('status').annotate(count=Count('id')).order_by('status'))

    # Bucket in Python with localtime — TruncMonth needs MySQL timezone tables.
    buckets = defaultdict(lambda: {'new': 0, 'follow_up': 0, 'won': 0, 'total': 0, '_sort': None})
    for created_at, status in qs.values_list('created_at', 'status'):
        if not created_at:
            continue
        local = localtime(created_at)
        key = local.strftime('%b %Y')
        bucket = buckets[key]
        if bucket['_sort'] is None:
            bucket['_sort'] = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        bucket['total'] += 1
        if status == 'New':
            bucket['new'] += 1
        elif status == 'Follow-up':
            bucket['follow_up'] += 1
        elif status == 'Won':
            bucket['won'] += 1
    monthly = [
        {
            'month': key,
            'new': data['new'],
            'follow_up': data['follow_up'],
            'won': data['won'],
            'total': data['total'],
        }
        for key, data in sorted(buckets.items(), key=lambda item: item[1]['_sort'] or timezone.now())
    ]

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
