import datetime
from django.db import models
from apps.accounts.models import User
from apps.leads.models import Lead
from apps.inventory.models import InventoryItem


class Project(models.Model):
    TYPE_CHOICES = [
        ('On-Grid', 'On-Grid'),
        ('Off-Grid', 'Off-Grid'),
        ('Hybrid', 'Hybrid'),
    ]
    STATUS_CHOICES = [
        ('Planning', 'Planning'),
        ('Active', 'Active'),
        ('On Hold', 'On Hold'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
    ]

    project_id = models.CharField(max_length=50, unique=True, editable=False)
    project_name = models.CharField(max_length=200)
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    customer_name = models.CharField(max_length=200)
    site = models.CharField(max_length=200, blank=True)
    site_address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    meter_number = models.CharField(max_length=50, blank=True)
    site_size = models.CharField(max_length=100, blank=True)

    project_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='On-Grid')
    capacity_kwp = models.DecimalField(max_digits=8, decimal_places=2)
    system_type = models.CharField(max_length=100, blank=True, default='Rooftop Solar')
    project_image = models.ImageField(upload_to='project_images/%Y/%m/', null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Planning')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    progress_percent = models.IntegerField(default=0)

    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_projects')
    site_engineer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='engineer_projects')
    sales_executive = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales_executive_projects')

    meter_type = models.CharField(max_length=50, blank=True)
    sanction_load = models.CharField(max_length=50, blank=True)
    consumer_number = models.CharField(max_length=50, blank=True)
    discom_name = models.CharField(max_length=100, blank=True)

    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    contract_date = models.DateField(null=True, blank=True)
    actual_completion = models.DateField(null=True, blank=True)

    po_number = models.CharField(max_length=100, blank=True)
    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_projects')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.project_id:
            year = datetime.date.today().year
            count = Project.objects.filter(created_at__year=year).count() + 1
            self.project_id = f'PRJ-{year}-{count:04d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.project_id} — {self.project_name}'

    class Meta:
        ordering = ['-created_at']


class ProjectActivity(models.Model):
    TYPE_CHOICES = [
        ('Site Survey', 'Site Survey'),
        ('Material Delivery', 'Material Delivery'),
        ('Installation', 'Installation'),
        ('Testing', 'Testing'),
        ('Commissioning', 'Commissioning'),
        ('Safety', 'Safety'),
        ('Other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
    ]
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='activities')
    title = models.CharField(max_length=200)
    activity_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='Other')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='activities')
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    completed_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_activities')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.project.project_id} — {self.title}'

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Project Activities'


class ProjectNote(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='notes')
    title = models.CharField(max_length=200, blank=True)
    content = models.TextField()
    is_pinned = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='project_notes')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.project.project_id} — Note #{self.pk}'

    class Meta:
        ordering = ['-is_pinned', '-created_at']


class ProjectDocument(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='documents')
    name = models.CharField(max_length=200)
    file = models.FileField(upload_to='project_documents/%Y/%m/')
    category = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_documents')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.project.project_id} — {self.name}'

    class Meta:
        ordering = ['-uploaded_at']


class ProjectExpense(models.Model):
    CATEGORY_CHOICES = [
        ('Materials', 'Materials'),
        ('Labor', 'Labor'),
        ('Transport', 'Transport'),
        ('Equipment', 'Equipment'),
        ('Miscellaneous', 'Miscellaneous'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='expenses')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    description = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='project_expenses')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.project.project_id} — {self.category} — ₹{self.amount}'

    class Meta:
        ordering = ['-date']


class ProjectPayment(models.Model):
    MODE_CHOICES = [
        ('Cash', 'Cash'),
        ('Bank Transfer', 'Bank Transfer'),
        ('UPI', 'UPI'),
        ('Cheque', 'Cheque'),
        ('NEFT', 'NEFT'),
        ('RTGS', 'RTGS'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_mode = models.CharField(max_length=30, choices=MODE_CHOICES, default='Bank Transfer')
    payment_date = models.DateField()
    reference = models.CharField(max_length=100, blank=True)
    notes = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='project_payments')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.project.project_id} — ₹{self.amount} ({self.payment_mode})'

    class Meta:
        ordering = ['-payment_date']


class WorkOrder(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Overdue', 'Overdue'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='work_orders')
    order_id = models.CharField(max_length=50, unique=True, editable=False)
    task = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='work_orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    completed_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_work_orders')
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.order_id:
            year = datetime.date.today().year
            count = WorkOrder.objects.filter(created_at__year=year).count() + 1
            self.order_id = f'WO-{year}-{count:04d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.order_id} — {self.task}'

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Work Orders'
        constraints = [
            models.UniqueConstraint(fields=['project', 'task'], name='unique_task_per_project'),
        ]


class ProjectTeamMember(models.Model):
    ACCESS_CHOICES = [
        ('full_access', 'Full Access'),
        ('edit_access', 'Edit Access'),
        ('view_only', 'View Only'),
    ]
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('On Site', 'On Site'),
        ('Off Site', 'Off Site'),
        ('On Leave', 'On Leave'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='team_members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='project_memberships')
    role_title = models.CharField(max_length=100, blank=True)
    access_level = models.CharField(max_length=20, choices=ACCESS_CHOICES, default='view_only')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.project.project_id} — {self.user.name} ({self.role_title or "Member"})'

    class Meta:
        ordering = ['added_at']
        constraints = [
            models.UniqueConstraint(fields=['project', 'user'], name='unique_member_per_project'),
        ]


class ProjectSystemConfig(models.Model):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='system_config')
    inverter_brand = models.CharField(max_length=100, blank=True)
    inverter_model = models.CharField(max_length=100, blank=True)
    inverter_capacity_kw = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    panel_brand = models.CharField(max_length=100, blank=True)
    panel_model = models.CharField(max_length=100, blank=True)
    panel_wattage_w = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    panel_count = models.IntegerField(null=True, blank=True)
    string_count = models.IntegerField(null=True, blank=True)
    protection_devices = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.project.project_id} — System Config'


class ProjectMilestone(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Delayed', 'Delayed'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='milestones')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    progress_percent = models.IntegerField(default=0)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_milestones')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    sequence = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.project.project_id} — {self.title}'

    class Meta:
        ordering = ['sequence', 'start_date']


class SiteSurvey(models.Model):
    FEASIBILITY_CHOICES = [
        ('Feasible', 'Feasible'),
        ('Feasible with Conditions', 'Feasible with Conditions'),
        ('Not Feasible', 'Not Feasible'),
    ]
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Completed', 'Completed'),
    ]

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='site_survey')
    survey_id = models.CharField(max_length=50, unique=True, editable=False)
    survey_date = models.DateField(null=True, blank=True)
    surveyed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='site_surveys')
    building_type = models.CharField(max_length=100, blank=True)
    floor_count = models.CharField(max_length=20, blank=True)
    roof_type = models.CharField(max_length=100, blank=True)
    rooftop_area_sqft = models.CharField(max_length=50, blank=True)
    shadow_free_area_sqft = models.CharField(max_length=50, blank=True)
    available_area_sqft = models.CharField(max_length=50, blank=True)
    site_details = models.JSONField(default=list, blank=True)
    roof_details = models.JSONField(default=list, blank=True)
    electrical_details = models.JSONField(default=list, blank=True)
    roof_stats = models.JSONField(default=list, blank=True)
    feasibility = models.CharField(max_length=30, choices=FEASIBILITY_CHOICES, blank=True)
    summary_notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    customer_budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    electricity_bill_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    subsidy_applicable = models.BooleanField(default=False)
    financial_remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.survey_id:
            year = datetime.date.today().year
            count = SiteSurvey.objects.filter(created_at__year=year).count() + 1
            self.survey_id = f'SS-{year}-{count:04d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.project.project_id} — Site Survey'


class ProjectChecklistItem(models.Model):
    PHASE_CHOICES = [
        ('Site Survey', 'Site Survey'),
        ('Installation', 'Installation'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='checklist_items')
    phase = models.CharField(max_length=20, choices=PHASE_CHOICES)
    category = models.CharField(max_length=100, blank=True)
    label = models.CharField(max_length=200)
    is_checked = models.BooleanField(default=False)
    notes = models.CharField(max_length=300, blank=True)
    checked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='checked_items')
    checked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.project.project_id} — {self.phase} — {self.label}'

    class Meta:
        ordering = ['phase', 'category', 'id']


class InstallationMaterial(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='installation_materials')
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='installation_uses')
    item_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=20, blank=True, default='Nos')
    required_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    issued_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    consumed_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')

    def __str__(self):
        return f'{self.project.project_id} — {self.item_name}'

    class Meta:
        ordering = ['id']


class MaterialPlan(models.Model):
    STATUS_CHOICES = [
        ('Not Started', 'Not Started'),
        ('In Progress', 'In Progress'),
        ('Partially Completed', 'Partially Completed'),
        ('Completed', 'Completed'),
        ('Delayed', 'Delayed'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='material_plans')
    category = models.CharField(max_length=100)
    items = models.CharField(max_length=50, blank=True, default='')
    uom = models.CharField(max_length=20, default='Nos')
    planned_qty = models.CharField(max_length=50, blank=True, default='')
    planned_value = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Not Started')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.project.project_id} — {self.category}'

    class Meta:
        ordering = ['id']
