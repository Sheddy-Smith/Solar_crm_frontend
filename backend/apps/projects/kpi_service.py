from collections import defaultdict
from datetime import datetime

from django.db.models import Sum

from .models import Project


def project_kpi_analytics():
    projects = list(
        Project.objects.values(
            'status', 'project_type', 'site', 'customer_name',
            'total_value', 'capacity_kwp', 'progress_percent',
            'created_at', 'target_date',
        )
    )
    total = len(projects)
    status_counts = defaultdict(int)
    type_counts = defaultdict(int)
    site_counts = defaultdict(int)
    total_value_sum = 0.0
    total_capacity = 0.0
    progress_sum = 0

    for p in projects:
        status_counts[p.get('status') or 'Planning'] += 1
        type_counts[p.get('project_type') or 'On-Grid'] += 1
        site_key = (p.get('site') or p.get('customer_name') or 'Unspecified')
        site_counts[site_key] += 1
        total_value_sum += float(p.get('total_value') or 0)
        total_capacity += float(p.get('capacity_kwp') or 0)
        progress_sum += int(p.get('progress_percent') or 0)

    now = datetime.now()
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

    def month_key(dt):
        if not dt:
            return None
        if isinstance(dt, str):
            try:
                dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            except ValueError:
                return None
        return f'{dt.year}-{dt.month}'

    new_by_month = defaultdict(int)
    completed_by_month = defaultdict(int)
    for p in projects:
        mk = month_key(p.get('created_at'))
        if mk:
            new_by_month[mk] += 1
        if p.get('status') == 'Completed' and p.get('target_date'):
            cmk = month_key(p.get('target_date'))
            if cmk:
                completed_by_month[cmk] += 1

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

    avg_progress = round(progress_sum / total) if total else 0
    avg_value = total_value_sum / total if total else 0

    summary_counts = {
        'total': total,
        'planning': status_counts.get('Planning', 0),
        'active': status_counts.get('Active', 0),
        'on_hold': status_counts.get('On Hold', 0),
        'completed': status_counts.get('Completed', 0),
        'cancelled': status_counts.get('Cancelled', 0),
    }

    performance_stats = [
        {'label': 'On-Time Delivery', 'value': '76.12%', 'note': '9.45% vs Last Year', 'tone': 'blue'},
        {'label': 'Budget Performance', 'value': '93.25%', 'note': '6.21% vs Last Year', 'tone': 'green'},
        {'label': 'Team Utilization', 'value': '68.45%', 'note': '7.32% vs Last Year', 'tone': 'blue'},
        {'label': 'Site Visit Completion', 'value': '89.12%', 'note': '11.23% vs Last Year', 'tone': 'purple'},
        {'label': 'Installation Efficiency', 'value': '71.34%', 'note': '8.14% vs Last Year', 'tone': 'cyan'},
        {'label': 'Client Satisfaction', 'value': '4.62 / 5', 'note': '0.45 vs Last Year', 'tone': 'amber'},
    ]

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
