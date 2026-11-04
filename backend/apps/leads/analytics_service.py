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
    # Bound unbounded analytics — default last 24 months when no range given.
    if not date_from and not date_to:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=730))
    qs = _apply_created_at_date_bounds(qs, date_from, date_to)
    if project_type and project_type != 'All':
        qs = qs.filter(project_type=project_type)
    if status_filter and status_filter != 'All':
        qs = qs.filter(status=status_filter)
    if assigned_to and assigned_to != 'All':
        # Prefer numeric user id from dropdowns; fall back to name contains.
        if str(assigned_to).isdigit():
            qs = qs.filter(assigned_to_id=int(assigned_to))
        else:
            qs = qs.filter(assigned_to__name__icontains=assigned_to)

    status_dist = list(qs.values('status').annotate(count=Count('id')).order_by('status'))

    # Monthly buckets: only (created_at, status) — still Python localtime for TZ-safe labels,
    # but no full ORM instances and bounded by date window above.
    buckets = defaultdict(lambda: {'new': 0, 'follow_up': 0, 'won': 0, 'total': 0, '_sort': None})
    for created_at, status in qs.values_list('created_at', 'status').iterator(chunk_size=2000):
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

    totals = qs.aggregate(
        total=Count('id'),
        won=Count('id', filter=Q(status='Won')),
        lost=Count('id', filter=Q(status='Lost')),
        with_ivrs=Count('id', filter=~Q(ivrs_number='')),
        overdue=Count(
            'id',
            filter=Q(next_follow_up__lt=timezone.now(), status__in=['New', 'Follow-up']),
        ),
    )
    total = totals['total'] or 0
    won = totals['won'] or 0
    with_ivrs = totals['with_ivrs'] or 0

    return {
        'total': total,
        'won': won,
        'lost': totals['lost'] or 0,
        'conversion_rate': round((won / total * 100), 1) if total else 0,
        'overdue': totals['overdue'] or 0,
        'status_distribution': status_dist,
        'monthly_trend': monthly,
        'employee_stats': employee_stats,
        'project_type_stats': project_type_stats,
        'ivrs_summary': {
            'total_with_ivrs': with_ivrs,
            'coverage_pct': round((with_ivrs / total * 100), 1) if total else 0,
        },
    }
