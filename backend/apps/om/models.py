from django.db import models
from apps.accounts.models import User
from apps.projects.models import Project


class OmAsset(models.Model):
    TYPE_CHOICES = [
        ('Inverter', 'Inverter'),
        ('Solar Module', 'Solar Module'),
        ('Transformer', 'Transformer'),
        ('ACDB', 'ACDB'),
        ('DCDB', 'DCDB'),
        ('Battery Bank', 'Battery Bank'),
        ('Energy Meter', 'Energy Meter'),
        ('SCADA', 'SCADA'),
        ('Structure', 'Structure'),
        ('Other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('Operational', 'Operational'),
        ('Under Maintenance', 'Under Maintenance'),
        ('Inactive', 'Inactive'),
        ('Retired', 'Retired'),
    ]

    name = models.CharField(max_length=200)
    asset_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='Other')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_assets')
    site = models.CharField(max_length=255, blank=True)
    capacity = models.CharField(max_length=100, blank=True)
    manufacturer = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Operational')
    installed_on = models.DateField(null=True, blank=True)
    # Energy performance (moved from the old Energy Performance page)
    energy_generated_kwh = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    energy_consumed_kwh = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    performance_ratio = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    specific_yield = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_assets_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'AST-{self.id:04d} — {self.name}'

    class Meta:
        ordering = ['-created_at']


class OmMaintenanceTask(models.Model):
    TYPE_CHOICES = [
        ('Preventive', 'Preventive'),
        ('Corrective', 'Corrective'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Overdue', 'Overdue'),
    ]
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
    ]

    title = models.CharField(max_length=255)
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_tasks')
    site = models.CharField(max_length=255, blank=True)
    task_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='Preventive')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    engineer = models.CharField(max_length=200, blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    work_details = models.TextField(blank=True)
    checklist = models.JSONField(default=list, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_tasks_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'MT-{self.id:04d} — {self.title}'

    class Meta:
        ordering = ['-created_at']


class OmBreakdownTicket(models.Model):
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('In Progress', 'In Progress'),
        ('On Hold', 'On Hold'),
        ('Resolved', 'Resolved'),
    ]
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
    ]

    subject = models.CharField(max_length=255)
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_tickets')
    site = models.CharField(max_length=255, blank=True)
    asset = models.ForeignKey(OmAsset, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_tickets_assigned')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Open')
    issue_description = models.TextField(blank=True)
    resolution = models.TextField(blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_tickets_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'BD-{self.id:04d} — {self.subject}'

    class Meta:
        ordering = ['-created_at']


class OmSiteVisit(models.Model):
    STATUS_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]

    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_visits')
    site = models.CharField(max_length=255, blank=True)
    purpose = models.CharField(max_length=255, blank=True)
    engineer = models.CharField(max_length=200, blank=True)
    date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Scheduled')
    checklist = models.JSONField(default=list, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_visits_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'SV-{self.id:04d} — {self.site}'

    class Meta:
        ordering = ['-created_at']


class OmSparePart(models.Model):
    CATEGORY_CHOICES = [
        ('Electrical', 'Electrical'),
        ('Mechanical', 'Mechanical'),
        ('Electronics', 'Electronics'),
        ('Civil', 'Civil'),
        ('Safety', 'Safety'),
        ('Other', 'Other'),
    ]

    name = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='Other')
    site = models.CharField(max_length=255, blank=True)
    stock_qty = models.IntegerField(default=0)
    min_stock = models.IntegerField(default=0)
    unit = models.CharField(max_length=50, blank=True, default='Nos')
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    supplier = models.CharField(max_length=200, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_parts_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def stock_status(self):
        if self.stock_qty <= 0:
            return 'Out of Stock'
        if self.stock_qty < self.min_stock:
            return 'Low Stock'
        return 'In Stock'

    def __str__(self):
        return f'SP-{self.id:04d} — {self.name}'

    class Meta:
        ordering = ['-created_at']


class OmReport(models.Model):
    TYPE_CHOICES = [
        ('Performance Report', 'Performance Report'),
        ('Maintenance Report', 'Maintenance Report'),
        ('Breakdown Report', 'Breakdown Report'),
        ('Compliance Report', 'Compliance Report'),
        ('Inventory Report', 'Inventory Report'),
        ('Other', 'Other'),
    ]

    name = models.CharField(max_length=255)
    report_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='Other')
    file = models.FileField(upload_to='om_reports/%Y/%m/', null=True, blank=True)
    remarks = models.TextField(blank=True)
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_reports_created')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'RPT-{self.id:04d} — {self.name}'

    class Meta:
        ordering = ['-created_at']


class OmDocument(models.Model):
    MODULE_CHOICES = [
        ('Maintenance', 'Maintenance'),
        ('Ticket', 'Ticket'),
        ('Visit', 'Visit'),
        ('Asset', 'Asset'),
        ('SparePart', 'SparePart'),
        ('General', 'General'),
    ]

    module = models.CharField(max_length=20, choices=MODULE_CHOICES, default='General')
    related_id = models.IntegerField(null=True, blank=True)
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='om_docs/%Y/%m/')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_documents_uploaded')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} ({self.module})'

    class Meta:
        ordering = ['-uploaded_at']
