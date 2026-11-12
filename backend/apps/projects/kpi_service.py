from collections import defaultdict
from datetime import datetime

from django.db.models import Avg, Count, Sum
from django.utils import timezone

from .models import Project


def project_kpi_analytics(date_from=None, date_to=None):
    """Project KPI bundle using DB aggregates (no full-table Python materialization)."""
    qs = Project.objects.filter(is_deleted=False)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    status_rows = list(qs.values('status').annotate(c=Count('id')))
    status_counts = { (r['status'] or 'Planning'): r['c'] for r in status_rows }

    type_rows = list(qs.values('project_type').annotate(c=Count('id')))
    type_counts = { (r['project_type'] or 'On-Grid'): r['c'] for r in type_rows }

    site_rows = list(
        qs.values('site', 'customer_name')
        .annotate(c=Count('id'))
        .order_by('-c')[:50]
    )
    site_counts = defaultdict(int)
    for r in site_rows:
        key = (r.get('site') or r.get('customer_name') or 'Unspecified')
        site_counts[key] += r['c']

    sums = qs.aggregate(
        total=Count('id'),
        total_value_sum=Sum('total_value'),
        total_capacity=Sum('capacity_kwp'),
        progress_avg=Avg('progress_percent'),
    )
    total = sums['total'] or 0
    total_value_sum = float(sums['total_value_sum'] or 0)
    total_capacity = float(sums['total_capacity'] or 0)
    avg_progress = round(float(sums['progress_avg'] or 0))

    now = timezone.localtime()
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    trend_months = []
    for i in range(12):
        d = datetime(now.year, now.month, 1)
        month = d.month - (11 - i)
        year = d.year
        while month <= 0:
            month += 12
            year -= 1
        trend_months.append(datetime(year, month, 1))

    # Lightweight trend: only created_at / status / target_date for last ~13 months.
    since = timezone.make_aware(datetime(trend_months[0].year, trend_months[0].month, 1))
    new_by_month = defaultdict(int)
    completed_by_month = defaultdict(int)
    for created_at, status, target_date in (
        qs.filter(created_at__gte=since)
        .values_list('created_at', 'status', 'target_date')
        .iterator(chunk_size=2000)
    ):
        if created_at:
            local = timezone.localtime(created_at) if timezone.is_aware(created_at) else created_at
            new_by_month[f'{local.year}-{local.month}'] += 1
        if status == 'Completed' and target_date:
            completed_by_month[f'{target_date.year}-{target_date.month}'] += 1

    trend_labels = [f'{month_names[d.month - 1]}\n{d.year}' for d in trend_months]
    trend_series = [
        {
            'label': 'New Projects',
            'color': '#2f80ff',
            'values': [new_by_month[f'{d.year}-{d.month}'] for d in trend_months],
        },
        {
            'label': 'Completed Projects',
            'color': '#29b36a',
            'values': [completed_by_month[f'{d.year}-{d.month}'] for d in trend_months],
        },
    ]

    status_palette = {
        'Planning': '#f59e0b', 'Active': '#2f80ff', 'On Hold': '#8b5cf6',
        'Completed': '#14b84c', 'Cancelled': '#ef4444',
    }
    status_data = [
        {'label': s, 'value': status_counts.get(s, 0), 'color': status_palette[s]}
        for s in status_palette
        if status_counts.get(s, 0) > 0
    ]

    site_palette = ['#2f80ff', '#14b84c', '#f59e0b', '#8b5cf6', '#ef4444']
    city_entries = sorted(site_counts.items(), key=lambda x: -x[1])
    other_count = sum(v for _, v in city_entries[4:])
    site_data = [
        {'label': label, 'value': value, 'color': site_palette[i]}
        for i, (label, value) in enumerate(city_entries[:4])
    ]
    if other_count > 0:
        site_data.append({'label': 'Others', 'value': other_count, 'color': site_palette[4]})

    type_palette = {'On-Grid': '#2f80ff', 'Hybrid': '#8b5cf6', 'Off-Grid': '#14b84c'}
    type_data = [
        {'label': t, 'value': type_counts.get(t, 0), 'color': type_palette[t]}
        for t in type_palette
        if type_counts.get(t, 0) > 0
    ]

    avg_value = total_value_sum / total if total else 0

    summary_counts = {
        'total': total,
        'planning': status_counts.get('Planning', 0),
        'active': status_counts.get('Active', 0),
        'on_hold': status_counts.get('On Hold', 0),
        'completed': status_counts.get('Completed', 0),
        'cancelled': status_counts.get('Cancelled', 0),
    }

    # No dummy performance KPIs — empty until real telemetry exists.
    performance_stats = []

    return {
        'summary': summary_counts,
        'trend_labels': trend_labels,
        'trend_series': trend_series,
        'status_data': status_data,
        'site_data': site_data,
        'type_data': type_data,
        'avg_progress': avg_progress,
        'financial': {
            'total_value': total_value_sum,
            'avg_value': avg_value,
            'total_capacity_kwp': total_capacity,
        },
        'performance_stats': performance_stats,
    }
