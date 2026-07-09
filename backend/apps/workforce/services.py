from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import Coalesce

from .models import Employee, EmployeeAttendance, EmployeeVoucher


WORK_HOURS_PER_DAY = Decimal('9')


def hourly_rate_for(employee):
    daily = employee.daily_rate or Decimal('0.00')
    if not daily:
        return Decimal('0.00')
    return (daily / WORK_HOURS_PER_DAY).quantize(Decimal('0.0001'))


def payment_for_attendance(employee, hours, ot_hours=Decimal('0.00')):
    hourly = hourly_rate_for(employee)
    total_hours = (hours or Decimal('0.00')) + (ot_hours or Decimal('0.00'))
    if total_hours <= 0:
        return Decimal('0.00')
    return (hourly * total_hours).quantize(Decimal('0.01'))


def employee_earnings_total(employee, before_date=None):
    qs = employee.attendance_records.filter(status='Present')
    if before_date:
        qs = qs.filter(date__lt=before_date)
    total = qs.aggregate(total=Coalesce(Sum('payment'), Decimal('0.00')))['total']
    return total or Decimal('0.00')


def employee_voucher_total(employee, start_date=None, end_date=None, before_date=None):
    qs = employee.vouchers.all()
    if start_date and end_date:
        qs = qs.filter(voucher_date__gte=start_date, voucher_date__lte=end_date)
    elif before_date:
        qs = qs.filter(voucher_date__lt=before_date)
    total = qs.aggregate(total=Coalesce(Sum('amount'), Decimal('0.00')))['total']
    return total or Decimal('0.00')


def employee_net_balance(employee, before_date=None):
    opening = employee.opening_balance or Decimal('0.00')
    earnings = employee_earnings_total(employee, before_date=before_date)
    paid = employee_voucher_total(employee, before_date=before_date)
    return (opening + earnings - paid).quantize(Decimal('0.01'))


def week_start_for(day):
    return day - timedelta(days=day.weekday())


def ensure_attendance_range(employee, start_date, end_date):
    records = []
    current = start_date
    while current <= end_date:
        record, _ = EmployeeAttendance.objects.get_or_create(
            employee=employee,
            date=current,
            defaults={'status': 'Not Marked'},
        )
        records.append(record)
        current += timedelta(days=1)
    return records


def attendance_ledger_payload(employee, start_date, end_date):
    ensure_attendance_range(employee, start_date, end_date)
    records = employee.attendance_records.filter(date__gte=start_date, date__lte=end_date).order_by('date')

    period_earning = records.filter(status='Present').aggregate(
        total=Coalesce(Sum('payment'), Decimal('0.00'))
    )['total'] or Decimal('0.00')

    period_voucher_rows = records.aggregate(total=Coalesce(Sum('voucher_amount'), Decimal('0.00')))
    period_voucher_from_rows = period_voucher_rows['total'] or Decimal('0.00')
    period_paid = employee_voucher_total(employee, start_date, end_date) + period_voucher_from_rows

    previous_balance = employee_net_balance(employee, before_date=start_date)
    net_balance = (previous_balance + period_earning - period_paid).quantize(Decimal('0.01'))
    present_days = records.filter(status='Present').count()

    return {
        'employee': {
            'id': employee.id,
            'name': employee.name,
            'mobile': employee.mobile,
            'aadhaar_number': employee.aadhaar_number,
            'skill_trade': employee.skill_trade or employee.role,
            'daily_rate': str(employee.daily_rate or Decimal('0.00')),
            'hourly_rate': str(hourly_rate_for(employee)),
            'opening_balance': str(employee.opening_balance or Decimal('0.00')),
        },
        'period': {
            'start_date': str(start_date),
            'end_date': str(end_date),
        },
        'summary': {
            'present_days': present_days,
            'net_previous_balance': str(previous_balance),
            'period_earning': str(period_earning.quantize(Decimal('0.01'))),
            'period_paid': str(period_paid.quantize(Decimal('0.01'))),
            'net_balance': str(net_balance),
        },
        'records': [
            {
                'id': row.id,
                'date': str(row.date),
                'day': row.date.strftime('%a'),
                'status': row.status,
                'hours': str(row.hours or Decimal('0.00')),
                'ot_hours': str(row.ot_hours or Decimal('0.00')),
                'payment': str(row.payment or Decimal('0.00')),
                'voucher_amount': str(row.voucher_amount or Decimal('0.00')),
                'payment_mode': row.payment_mode or '',
                'notes': row.notes or '',
            }
            for row in records
        ],
    }
