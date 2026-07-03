from django.conf import settings
from django.db import models


class CompanyProfile(models.Model):
    """Singleton company profile stored as JSON matching the frontend form."""

    data = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Company Profile'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class AppSetting(models.Model):
    """Key-value settings grouped by category (system, payment, email, etc.)."""

    category = models.CharField(max_length=50, db_index=True)
    key = models.CharField(max_length=100)
    value = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('category', 'key')
        ordering = ['category', 'key']

    def __str__(self):
        return f'{self.category}.{self.key}'


class PaymentMode(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=30, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class MasterRecord(models.Model):
    MASTER_TYPES = [
        ('product_category', 'Product Category'),
        ('unit', 'Unit of Measurement'),
        ('tax', 'Tax Setting'),
        ('stock_rule', 'Stock Rule'),
        ('project_status', 'Project Status'),
        ('project_type', 'Project Type'),
        ('task_priority', 'Task Priority'),
        ('milestone', 'Milestone'),
        ('document', 'Document Setting'),
        ('approval_workflow', 'Approval Workflow'),
    ]

    master_type = models.CharField(max_length=40, choices=MASTER_TYPES, db_index=True)
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['master_type', 'sort_order', 'name']
        unique_together = ('master_type', 'code')

    def __str__(self):
        return f'{self.master_type}: {self.name}'


class FinancialYear(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Closed', 'Closed'),
    ]

    label = models.CharField(max_length=20)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return self.label

    def save(self, *args, **kwargs):
        if self.is_current:
            FinancialYear.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)


class UserActivityLog(models.Model):
    STATUS_CHOICES = [
        ('Success', 'Success'),
        ('Failed', 'Failed'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs',
    )
    user_name = models.CharField(max_length=200, blank=True)
    action = models.CharField(max_length=100)
    module = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Success')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user_name or "System"} — {self.action}'


class IpAccessRule(models.Model):
    RULE_TYPES = [
        ('Allow', 'Allow'),
        ('Block', 'Block'),
    ]

    name = models.CharField(max_length=200)
    ip_range = models.CharField(max_length=100)
    rule_type = models.CharField(max_length=10, choices=RULE_TYPES, default='Allow')
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.rule_type}: {self.ip_range}'


class IpBlockedAttempt(models.Model):
    ip_address = models.GenericIPAddressField()
    username = models.CharField(max_length=200, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-attempted_at']

    def __str__(self):
        return f'{self.ip_address} @ {self.attempted_at}'


class DocumentNumberSeries(models.Model):
    document_type = models.CharField(max_length=100)
    prefix = models.CharField(max_length=30)
    next_number = models.PositiveIntegerField(default=1)
    padding = models.PositiveSmallIntegerField(default=4)
    suffix = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['document_type']
        unique_together = ('document_type', 'prefix')

    def __str__(self):
        return f'{self.document_type} ({self.prefix})'

    @property
    def preview(self):
        num = str(self.next_number).zfill(self.padding)
        return f'{self.prefix}{num}{self.suffix}'


class SystemBackupLog(models.Model):
    STATUS_CHOICES = [
        ('Completed', 'Completed'),
        ('Failed', 'Failed'),
        ('In Progress', 'In Progress'),
    ]

    filename = models.CharField(max_length=255)
    file_size = models.CharField(max_length=50, blank=True)
    backup_type = models.CharField(max_length=50, default='Full')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Completed')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='backups_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.filename
