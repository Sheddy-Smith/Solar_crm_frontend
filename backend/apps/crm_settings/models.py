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


class AuditEvent(models.Model):
    """Developer Mode audit trail (add/update/delete/clear with JSON payload)."""

    ACTION_CHOICES = [
        ('ADD', 'ADD'),
        ('UPDATE', 'UPDATE'),
        ('DELETE', 'DELETE'),
        ('CLEAR', 'CLEAR'),
        ('SYNC', 'SYNC'),
        ('OTHER', 'OTHER'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_events',
    )
    user_name = models.CharField(max_length=200, blank=True)
    branch = models.CharField(max_length=200, blank=True, default='—')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default='OTHER', db_index=True)
    entity = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} {self.entity}'


class BugReport(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('resolved', 'Resolved'),
    ]
    SOURCE_CHOICES = [
        ('user', 'User'),
        ('auto', 'Auto pick'),
    ]

    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    path = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open', db_index=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='user', db_index=True)
    fingerprint = models.CharField(max_length=80, blank=True, db_index=True)
    occurrence_count = models.PositiveIntegerField(default=1)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bug_reports',
    )
    reporter_name = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class BugReportAttachment(models.Model):
    KIND_CHOICES = [
        ('image', 'Image'),
        ('video', 'Video'),
    ]

    report = models.ForeignKey(BugReport, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='bug_reports/%Y/%m/')
    original_name = models.CharField(max_length=255, blank=True)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default='image')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.original_name or self.file.name


class WhatsAppExtensionMessage(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Processed', 'Processed'),
        ('Rejected', 'Rejected'),
    ]

    occurred_at = models.DateTimeField(db_index=True)
    from_number = models.CharField(max_length=120, blank=True)
    sender_name = models.CharField(max_length=200, blank=True)
    group_module = models.CharField(max_length=120, blank=True, db_index=True)
    vehicle_no = models.CharField(max_length=60, blank=True)
    message = models.TextField(blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending', db_index=True)
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-occurred_at', '-id']

    def __str__(self):
        return f'{self.from_number}: {self.message[:40]}'


class AttendanceMachineConfig(models.Model):
    """Singleton eTimeOffice / biometric connection settings."""

    corporate_id = models.CharField(max_length=100, blank=True)
    username = models.CharField(max_length=100, blank=True)
    api_endpoint = models.URLField(default='https://api.etimeoffice.com/api')
    auto_sync = models.BooleanField(default=False)
    late_after = models.CharField(max_length=10, default='10:00')
    default_lookback_days = models.PositiveSmallIntegerField(default=7)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_status = models.CharField(max_length=40, blank=True)
    last_sync_detail = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Attendance Machine Config'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def is_configured(self):
        return bool(self.corporate_id and self.username)


class AttendanceMachineSyncRun(models.Model):
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('done', 'Done'),
        ('error', 'Error'),
    ]

    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attendance_sync_runs',
    )
    from_date = models.DateField()
    to_date = models.DateField()
    emp_code = models.CharField(max_length=40, default='ALL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    punches_imported = models.PositiveIntegerField(default=0)
    detail = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']


class DeveloperMemoryNote(models.Model):
    """Per-user developer scratch notes (Settings → Memory)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='developer_memory',
    )
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Memory<{self.user_id}>'
