"""Date/datetime queryset helpers that avoid MySQL CONVERT_TZ.

Hostinger (and many managed MySQL hosts) ship without usable timezone tables.
Django's `__date` / `__year` / `__month` / TruncMonth lookups then call
CONVERT_TZ, which returns NULL — so filters match nothing and dashboards show 0.

Comparing against timezone-aware datetime bounds works: Django converts the
Python value to UTC and compares the stored UTC column directly.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

from django.utils import timezone


def day_start(d: date):
    return timezone.make_aware(datetime.combine(d, time.min))


def filter_field_on_local_date(qs, field: str, d: date):
    start = day_start(d)
    return qs.filter(**{f'{field}__gte': start, f'{field}__lt': start + timedelta(days=1)})


def filter_field_on_local_date_range(qs, field: str, start_d: date, end_d_inclusive: date):
    start = day_start(start_d)
    end = day_start(end_d_inclusive) + timedelta(days=1)
    return qs.filter(**{f'{field}__gte': start, f'{field}__lt': end})


def period_created_at_queryset(qs, period: str | None, anchor: date):
    """Scope a lead queryset to the dashboard day/week/month/year toggle."""
    if period == 'day':
        range_start = range_end = anchor
        return filter_field_on_local_date(qs, 'created_at', anchor), range_start, range_end
    if period == 'week':
        range_start = anchor - timedelta(days=anchor.weekday())
        range_end = range_start + timedelta(days=6)
        return filter_field_on_local_date_range(qs, 'created_at', range_start, range_end), range_start, range_end
    if period == 'month':
        range_start = anchor.replace(day=1)
        next_month = (range_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        range_end = next_month - timedelta(days=1)
        return filter_field_on_local_date_range(qs, 'created_at', range_start, range_end), range_start, range_end
    if period == 'year':
        range_start = anchor.replace(month=1, day=1)
        range_end = anchor.replace(month=12, day=31)
        return filter_field_on_local_date_range(qs, 'created_at', range_start, range_end), range_start, range_end
    return qs, None, None
