from decimal import Decimal

from django.db import models, transaction, IntegrityError
from django.db.models import Count, Q
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

from malwa_solar.validators import validate_document_extension, validate_upload_size


class EmployeeIdCounter(models.Model):
    """Backs generate_employee_id() with a single locked row per year instead of a
    `count()+1`/`last()+1` read (BUG-025) — concurrent Employee.save() calls would
    otherwise race and can both compute the same employee_id."""
    key = models.CharField(max_length=50, unique=True)
    value = models.IntegerField(default=0)

    @classmethod
    def next_value(cls, key, initial=0):
        """`initial` only takes effect the first time this key's row is created —
        pass the current max of any legacy-generated ids so the counter continues
        from there instead of colliding with ids created before this counter existed."""
        for _ in range(2):  # one retry to cover the get_or_create race on first-ever creation
            try:
                with transaction.atomic():
                    counter, _ = cls.objects.select_for_update().get_or_create(key=key, defaults={'value': initial})
                    counter.value += 1
                    counter.save(update_fields=['value'])
                    return counter.value
            except IntegrityError:
                continue
        raise RuntimeError(f'Could not allocate id counter for {key!r}')


def generate_employee_id():
    year = timezone.now().year
    prefix = f'EMP-{year}-'
    seed = 0
    last = Employee.objects.filter(employee_id__startswith=prefix).order_by('-employee_id').first()
    if last:
        try:
            seed = int(last.employee_id.split('-')[-1])
        except ValueError:
            seed = 0
    num = EmployeeIdCounter.next_value(prefix, initial=seed)
    return f'{prefix}{str(num).zfill(3)}'


class Employee(models.Model):
    STATUS_CHOICES = [
        ('Available', 'Available'),
        ('Assigned', 'Assigned'),
        ('In Progress', 'In Progress'),
        ('On Leave', 'On Leave'),
        ('Completed', 'Completed'),
    ]
    DEPARTMENT_CHOICES = [
        ('Installation', 'Installation'),
        ('Engineering', 'Engineering'),
        ('Electrical', 'Electrical'),
        ('Sales', 'Sales'),
        ('Quality', 'Quality'),
        ('Logistics', 'Logistics'),
        ('HSE', 'HSE'),
        ('Operations', 'Operations'),
        ('Administration', 'Administration'),
        ('Other', 'Other'),
    ]

    employee_id = models.CharField(max_length=50, unique=True, blank=True)
    name = models.CharField(max_length=200)
    mobile = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    department = models.CharField(max_length=100, choices=DEPARTMENT_CHOICES, blank=True)
    role = models.CharField(max_length=100, blank=True)
    joining_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Available')
    present_days = models.IntegerField(default=0)
    absent_days = models.IntegerField(default=0)
    leave_balance = models.IntegerField(default=12)
    notes = models.TextField(blank=True)
    aadhaar_number = models.CharField(max_length=255, blank=True)
    address = models.TextField(blank=True)
    skill_trade = models.CharField(max_length=100, blank=True)
    daily_rate = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def hourly_rate(self):
        if not self.daily_rate:
            return Decimal('0.00')
        return (self.daily_rate / Decimal('9')).quantize(Decimal('0.01'))

    def save(self, *args, **kwargs):
        if not self.employee_id:
            self.employee_id = generate_employee_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.employee_id} — {self.name}'

    class Meta:
        ordering = ['-created_at']


class EmployeeAssignment(models.Model):
    PRIORITY_CHOICES = [
        ('High', 'High'),
        ('Medium', 'Medium'),
        ('Low', 'Low'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('On Hold', 'On Hold'),
        ('Completed', 'Completed'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='assignments')
    project = models.ForeignKey('projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='workforce_assignments')
    task_name = models.CharField(max_length=200)
    assigned_date = models.DateField(default=timezone.now)
    expected_completion = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium')
    progress_percent = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.employee.name} — {self.task_name}'

    class Meta:
        ordering = ['-created_at']


class EmployeeDocument(models.Model):
    DOC_TYPE_CHOICES = [
        ('ID Proof', 'ID Proof'),
        ('Joining Document', 'Joining Document'),
        ('Certificate', 'Certificate'),
        ('Other', 'Other'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=50, choices=DOC_TYPE_CHOICES, default='Other')
    name = models.CharField(max_length=200)
    file = models.FileField(upload_to='workforce/docs/', validators=[validate_document_extension, validate_upload_size])
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.employee.name} — {self.name}'

    class Meta:
        ordering = ['-uploaded_at']


class EmployeeAttendance(models.Model):
    STATUS_CHOICES = [
        ('Not Marked', 'Not Marked'),
        ('Present', 'Present'),
        ('Absent', 'Absent'),
    ]

    # PROTECT, not CASCADE (BUG-057) — attendance/payment history must not be
    # silently wiped by deleting the employee record; block the delete instead.
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='attendance_records')
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Not Marked')
    hours = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    ot_hours = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    payment = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    voucher_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    payment_mode = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date']
        unique_together = [('employee', 'date')]

    def __str__(self):
        return f'{self.employee.name} — {self.date} ({self.status})'


class EmployeeVoucher(models.Model):
    # PROTECT, not CASCADE (BUG-057) — payment/voucher history must not be
    # silently wiped by deleting the employee record; block the delete instead.
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='vouchers')
    voucher_date = models.DateField(default=timezone.now)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_mode = models.CharField(max_length=50, default='Cash')
    notes = models.TextField(blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-voucher_date', '-created_at']

    def __str__(self):
        return f'{self.employee.name} — ₹{self.amount} ({self.voucher_date})'


@receiver([post_save, post_delete], sender=EmployeeAttendance)
def sync_employee_attendance_counts(sender, instance, **kwargs):
    """Keeps Employee.present_days/absent_days in sync with attendance rows (BUG-002)."""
    counts = EmployeeAttendance.objects.filter(employee_id=instance.employee_id).aggregate(
        present=Count('id', filter=Q(status='Present')),
        absent=Count('id', filter=Q(status='Absent')),
    )
    Employee.objects.filter(pk=instance.employee_id).update(
        present_days=counts['present'] or 0,
        absent_days=counts['absent'] or 0,
    )


@receiver([post_save, post_delete], sender=EmployeeVoucher)
def sync_attendance_voucher_amount(sender, instance, signal, **kwargs):
    """Mirrors same-day voucher totals onto EmployeeAttendance.voucher_amount for display (BUG-006).
    This is informational only — ledger totals are computed live from EmployeeVoucher
    (see services.employee_voucher_total), so it is never double-counted (BUG-005)."""
    if not Employee.objects.filter(pk=instance.employee_id).exists():
        return  # employee (and everything under it) is being removed in a cascade delete
    from .services import sync_attendance_voucher_amounts
    sync_attendance_voucher_amounts(instance.employee, [instance.voucher_date], create_missing=(signal is post_save))

    # Sync labour payment into Accounts PaymentVoucher (BUG-020).
    from apps.accounts_module.services import (
        sync_payment_voucher_for_employee_voucher,
        remove_payment_voucher_for_employee_voucher,
    )
    if signal is post_delete:
        remove_payment_voucher_for_employee_voucher(instance)
    else:
        sync_payment_voucher_for_employee_voucher(instance)
