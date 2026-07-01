from django.db import models
from django.utils import timezone


def generate_employee_id():
    year = timezone.now().year
    prefix = f'EMP-{year}-'
    last = Employee.objects.filter(employee_id__startswith=prefix).order_by('-employee_id').first()
    if last:
        try:
            num = int(last.employee_id.split('-')[-1]) + 1
        except ValueError:
            num = 1
    else:
        num = 1
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
    department = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=100, blank=True)
    joining_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Available')
    present_days = models.IntegerField(default=0)
    absent_days = models.IntegerField(default=0)
    leave_balance = models.IntegerField(default=12)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
    file = models.FileField(upload_to='workforce/docs/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.employee.name} — {self.name}'

    class Meta:
        ordering = ['-uploaded_at']
