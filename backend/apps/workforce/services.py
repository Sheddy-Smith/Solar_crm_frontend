from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import Coalesce

from .models import Employee, EmployeeAttendance, EmployeeVoucher
from malwa_solar.encryption import display_aadhaar
from apps.accounts.permissions import is_super_admin


WORK_HOURS_PER_DAY = Decimal('9')


def department_for_role_name(role_name):
    name = (role_name or '').strip().lower()
    if not name:
        return 'Other'
    if 'sales' in name or 'tele' in name:
        return 'Sales'
    if 'engineer' in name or 'site' in name:
        return 'Engineering'
    if 'electric' in name:
        return 'Electrical'
    if 'install' in name:
        return 'Installation'
    if 'quality' in name or 'qc' in name:
        return 'Quality'
    if 'logistic' in name or 'store' in name or 'inventory' in name:
        return 'Logistics'
    if 'admin' in name or 'hr' in name or 'account' in name:
        return 'Administration'
    if 'operation' in name or 'ops' in name:
        return 'Operations'
    return 'Other'


def ensure_employee_for_user(user):
    """Keep a workforce Employee row for each Settings user so they appear under Employee."""
    if not user or not getattr(user, 'pk', None):
        return None

    from django.contrib.auth import get_user_model

    User = get_user_model()
    if not isinstance(user, User):
        return None

    role_name = getattr(getattr(user, 'role', None), 'name', '') or ''
    emp = Employee.objects.filter(user_id=user.pk).first()
    if not emp and user.email:
        emp = Employee.objects.filter(user__isnull=True, email__iexact=user.email).first()
    if not emp and user.mobile:
        emp = Employee.objects.filter(user__isnull=True, mobile=user.mobile).first()

    if getattr(user, 'is_deleted', False):
        if emp:
            emp.user = user
            emp.name = 'Deleted User'
            emp.email = user.email or emp.email
            emp.mobile = user.mobile or ''
            emp.status = 'On Leave'
            emp.save()
        return emp

    created = False
    if not emp:
        emp = Employee(user=user)
        created = True

    emp.user = user
    emp.name = (user.name or user.email or 'User').strip()
    emp.mobile = user.mobile or ''
    emp.email = user.email or ''
    if role_name:
        emp.role = role_name
        if not emp.department or created:
            emp.department = department_for_role_name(role_name)
    if not user.is_active:
        emp.status = 'On Leave'
    elif created:
        emp.status = 'Available'
    emp.save()
    return emp


def sync_employees_from_users():
    """Backfill Employee rows for active Settings users (idempotent)."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    created = 0
    for user in User.objects.filter(is_deleted=False).select_related('role'):
        before = Employee.objects.filter(user_id=user.pk).exists()
        ensure_employee_for_user(user)
        if not before and Employee.objects.filter(user_id=user.pk).exists():
            created += 1
    return created


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


def sync_attendance_voucher_amounts(employee, dates, create_missing=True):
    """Denormalizes same-day EmployeeVoucher totals onto EmployeeAttendance.voucher_amount
    for ledger row display (BUG-006). Not summed into ledger totals — see employee_voucher_total.

    `create_missing=False` is used when called from a voucher's post_delete signal: the
    employee (and its attendance rows) may be mid-cascade-delete at that point, so we must
    not try to get_or_create a row referencing an employee_id that no longer exists.
    """
    for d in dates:
        if create_missing:
            record, _ = EmployeeAttendance.objects.get_or_create(
                employee=employee, date=d, defaults={'status': 'Not Marked'},
            )
        else:
            record = EmployeeAttendance.objects.filter(employee=employee, date=d).first()
            if not record:
                continue
        total = EmployeeVoucher.objects.filter(employee=employee, voucher_date=d).aggregate(
            total=Coalesce(Sum('amount'), Decimal('0.00'))
        )['total'] or Decimal('0.00')
        if record.voucher_amount != total:
            record.voucher_amount = total
            record.save(update_fields=['voucher_amount'])


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


def attendance_ledger_payload(employee, start_date, end_date, user=None):
    ensure_attendance_range(employee, start_date, end_date)
    records = employee.attendance_records.filter(date__gte=start_date, date__lte=end_date).order_by('date')

    period_earning = records.filter(status='Present').aggregate(
        total=Coalesce(Sum('payment'), Decimal('0.00'))
    )['total'] or Decimal('0.00')

    # EmployeeVoucher is the single source of truth for payments (BUG-005) — attendance
    # rows' voucher_amount is a same-day display mirror only (see sync_attendance_voucher_amounts),
    # so it must not be summed again here or paid totals would be double-counted.
    period_paid = employee_voucher_total(employee, start_date, end_date)

    previous_balance = employee_net_balance(employee, before_date=start_date)
    net_balance = (previous_balance + period_earning - period_paid).quantize(Decimal('0.01'))
    present_days = records.filter(status='Present').count()

    return {
        'employee': {
            'id': employee.id,
            'name': employee.name,
            'mobile': employee.mobile,
            'aadhaar_number': display_aadhaar(
                employee.aadhaar_number,
                reveal_full=bool(user and is_super_admin(user)),
            ),
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
