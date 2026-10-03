import calendar
from datetime import date, timedelta


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def add_years(value: date, years: int) -> date:
    return add_months(value, years * 12)


def free_service_end(commissioning_date: date, years: int) -> date:
    """15-10-2026 + 5 years → 14-10-2031 (inclusive end date)."""
    return add_years(commissioning_date, years) - timedelta(days=1)


def quarterly_due_dates(commissioning_date: date, years: int, interval_months: int):
    count = (years * 12) // interval_months
    return [add_months(commissioning_date, interval_months * n) for n in range(1, count + 1)]
