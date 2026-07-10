import datetime
from django.db import models, transaction, IntegrityError
from django.utils.text import slugify
from apps.accounts.models import User
from apps.leads.models import Lead
from apps.inventory.models import InventoryItem
from malwa_solar.validators import validate_document_extension, validate_image_extension, validate_upload_size


class SequenceCounter(models.Model):
    """Backs atomic, race-free ID generation for Project.project_id,
    WorkOrder.order_id and SiteSurvey.survey_id (BUG-026 / BUG-071) with a
    single locked row per prefix instead of an unlocked `count()+1` read —
    concurrent saves would otherwise race and can both compute the same id.
    Mirrors the `EmployeeIdCounter` pattern used for the same class of bug
    in `apps.workforce.models` (BUG-025)."""
    key = models.CharField(max_length=50, unique=True)
    value = models.IntegerField(default=0)

    @classmethod
    def next_value(cls, key, initial=0):
        """`initial` only takes effect the first time this key's row is
        created — pass the current max of any legacy-generated ids so the
        counter continues from there instead of colliding with ids created
        before this counter existed."""
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


def site_survey_photo_upload_path(instance, filename):
    # Filed by lead + customer, per spec ("Save images using Lead ID and
    # Customer ID"), so photos are traceable back to their record on disk too.
    ext = filename.rsplit('.', 1)[-1] if '.' in filename else 'jpg'
    project = instance.survey.project
    lead_id = project.lead_id or 'na'
    customer_slug = slugify(project.customer_name) or 'customer'
    slot_slug = slugify(instance.slot) or 'photo'
    date_path = datetime.date.today().strftime('%Y/%m')
    return f'site_survey_photos/{date_path}/lead{lead_id}_{customer_slug}/{slot_slug}.{ext}'


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
    project_image = models.ImageField(upload_to='project_images/%Y/%m/', null=True, blank=True, validators=[validate_image_extension, validate_upload_size])

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
            prefix = f'PRJ-{year}-'
            seed = 0
            last = Project.objects.filter(project_id__startswith=prefix).order_by('-project_id').first()
            if last:
                try:
                    seed = int(last.project_id.rsplit('-', 1)[-1])
                except ValueError:
                    seed = 0
            num = SequenceCounter.next_value(prefix, initial=seed)
            self.project_id = f'{prefix}{num:04d}'
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
    file = models.FileField(upload_to='project_documents/%Y/%m/', validators=[validate_document_extension, validate_upload_size])
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
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Paid', 'Paid'),
        ('Partial', 'Partial'),
    ]
    PAYMENT_MODE_CHOICES = [
        ('Cash', 'Cash'),
        ('Bank Transfer', 'Bank Transfer'),
        ('UPI', 'UPI'),
        ('Cheque', 'Cheque'),
        ('NEFT', 'NEFT'),
        ('RTGS', 'RTGS'),
    ]

    # BUG-057: PROTECT instead of CASCADE — deleting a Project must not
    # silently wipe recorded expense history. Block the delete instead
    # (malwa_solar/exceptions.py translates the resulting ProtectedError
    # into a clean 400 response).
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name='expenses')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    description = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    payment_mode = models.CharField(max_length=30, choices=PAYMENT_MODE_CHOICES, blank=True, default='')
    paid_by = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='project_expenses')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.project.project_id} — {self.category} — ₹{self.amount}'

    class Meta:
        ordering = ['-date']


class ProjectExpenseDocument(models.Model):
    DOC_TYPE_CHOICES = [
        ('Bill', 'Bill'),
        ('Invoice', 'Invoice'),
        ('Image', 'Image'),
        ('Other', 'Other'),
    ]

    expense = models.ForeignKey(ProjectExpense, on_delete=models.CASCADE, related_name='expense_documents')
    doc_type = models.CharField(max_length=20, choices=DOC_TYPE_CHOICES, default='Other')
    name = models.CharField(max_length=200)
    file = models.FileField(upload_to='expense_docs/%Y/%m/', validators=[validate_document_extension, validate_upload_size])
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.expense} — {self.name}'


class ProjectPayment(models.Model):
    MODE_CHOICES = [
        ('Cash', 'Cash'),
        ('Bank Transfer', 'Bank Transfer'),
        ('UPI', 'UPI'),
        ('Cheque', 'Cheque'),
        ('NEFT', 'NEFT'),
        ('RTGS', 'RTGS'),
    ]

    # BUG-057: PROTECT instead of CASCADE — deleting a Project must not
    # silently wipe recorded customer payment history.
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name='payments')
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
            prefix = f'WO-{year}-'
            seed = 0
            last = WorkOrder.objects.filter(order_id__startswith=prefix).order_by('-order_id').first()
            if last:
                try:
                    seed = int(last.order_id.rsplit('-', 1)[-1])
                except ValueError:
                    seed = 0
            num = SequenceCounter.next_value(prefix, initial=seed)
            self.order_id = f'{prefix}{num:04d}'
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
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
    ]
    ROOF_TYPE_CHOICES = [
        ('RCC', 'RCC'),
        ('Tin Shed', 'Tin Shed'),
        ('Metal Roof', 'Metal Roof'),
        ('Ground Mount', 'Ground Mount'),
    ]
    INVERTER_PLACEMENT_CHOICES = [('Indoor', 'Indoor'), ('Outdoor', 'Outdoor')]
    INVERTER_MOUNTING_CHOICES = [('Wall Mounted', 'Wall Mounted'), ('Floor Mounted', 'Floor Mounted')]
    METER_PHASE_CHOICES = [('Single Phase', 'Single Phase'), ('Three Phase', 'Three Phase')]
    MODULE_ORIENTATION_CHOICES = [('Portrait', 'Portrait'), ('Landscape', 'Landscape')]

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='site_survey')
    survey_id = models.CharField(max_length=50, unique=True, editable=False)

    # Section 1 — Survey Information
    survey_date = models.DateField(null=True, blank=True)
    surveyed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='site_surveys')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    latitude = models.CharField(max_length=20, blank=True)
    longitude = models.CharField(max_length=20, blank=True)

    # Section 2 — Roof Details
    building_type = models.CharField(max_length=100, blank=True)
    floor_count = models.CharField(max_length=20, blank=True)
    roof_type = models.CharField(max_length=30, choices=ROOF_TYPE_CHOICES, blank=True)
    roof_height_ft = models.CharField(max_length=20, blank=True)
    rooftop_area_sqft = models.CharField(max_length=50, blank=True)
    roof_length_ft = models.CharField(max_length=20, blank=True)
    roof_width_ft = models.CharField(max_length=20, blank=True)
    shadow_free_area_sqft = models.CharField(max_length=50, blank=True)
    available_area_sqft = models.CharField(max_length=50, blank=True)
    shadow_present = models.BooleanField(default=False)
    water_tank_present = models.BooleanField(default=False)
    tree_nearby = models.BooleanField(default=False)
    obstacle_present = models.BooleanField(default=False)
    roof_remarks = models.TextField(blank=True)

    # Section 4 — Earthing Details
    earthing_required = models.BooleanField(default=False)
    earthing_count = models.CharField(max_length=20, blank=True)
    earthing_type = models.CharField(max_length=100, blank=True)
    earthing_location = models.CharField(max_length=200, blank=True)
    earthing_remarks = models.TextField(blank=True)

    # Section 5 — Inverter Location
    inverter_placement = models.CharField(max_length=20, choices=INVERTER_PLACEMENT_CHOICES, blank=True)
    inverter_mounting = models.CharField(max_length=20, choices=INVERTER_MOUNTING_CHOICES, blank=True)
    inverter_location_description = models.CharField(max_length=255, blank=True)
    inverter_distance_from_roof = models.CharField(max_length=50, blank=True)

    # Section 6 — Meter Details
    meter_type = models.CharField(max_length=100, blank=True)
    meter_phase = models.CharField(max_length=20, choices=METER_PHASE_CHOICES, blank=True)
    meter_capacity = models.CharField(max_length=50, blank=True)
    existing_mcb = models.CharField(max_length=100, blank=True)
    connection_point_after_commissioning = models.CharField(max_length=255, blank=True)
    meter_remarks = models.TextField(blank=True)

    # Section 7 — Cable & Conduit Route
    conduit_route_description = models.TextField(blank=True)
    ac_cable_route = models.CharField(max_length=255, blank=True)
    dc_cable_route = models.CharField(max_length=255, blank=True)
    ac_cable_length_approx = models.CharField(max_length=50, blank=True)
    dc_cable_length_approx = models.CharField(max_length=50, blank=True)
    conduit_length_approx = models.CharField(max_length=50, blank=True)

    # Section 8 — Structure Layout
    module_orientation = models.CharField(max_length=20, choices=MODULE_ORIENTATION_CHOICES, blank=True)
    tilt_angle = models.CharField(max_length=20, blank=True)
    structure_rows = models.CharField(max_length=20, blank=True)
    structure_columns = models.CharField(max_length=20, blank=True)
    approx_plant_capacity = models.CharField(max_length=50, blank=True)
    future_expansion = models.BooleanField(default=False)

    # Section 9 — Safety Checklist
    safety_roof_safe = models.BooleanField(default=False)
    safety_shadow_checked = models.BooleanField(default=False)
    safety_earthing_finalized = models.BooleanField(default=False)
    safety_meter_verified = models.BooleanField(default=False)
    safety_inverter_location_final = models.BooleanField(default=False)
    safety_cable_route_final = models.BooleanField(default=False)
    safety_tank_checked = models.BooleanField(default=False)
    safety_customer_approval_taken = models.BooleanField(default=False)
    safety_gps_captured = models.BooleanField(default=False)
    safety_all_photos_uploaded = models.BooleanField(default=False)

    # Legacy/free-form (kept for backward compatibility — no live UI editor)
    site_details = models.JSONField(default=list, blank=True)
    roof_details = models.JSONField(default=list, blank=True)
    electrical_details = models.JSONField(default=list, blank=True)
    roof_stats = models.JSONField(default=list, blank=True)

    feasibility = models.CharField(max_length=30, choices=FEASIBILITY_CHOICES, blank=True)
    summary_notes = models.TextField(blank=True)  # Section 11 — Survey Remarks
    customer_budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    electricity_bill_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    subsidy_applicable = models.BooleanField(default=False)
    financial_remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.survey_id:
            year = datetime.date.today().year
            prefix = f'SS-{year}-'
            seed = 0
            last = SiteSurvey.objects.filter(survey_id__startswith=prefix).order_by('-survey_id').first()
            if last:
                try:
                    seed = int(last.survey_id.rsplit('-', 1)[-1])
                except ValueError:
                    seed = 0
            num = SequenceCounter.next_value(prefix, initial=seed)
            self.survey_id = f'{prefix}{num:04d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.project.project_id} — Site Survey'


class SiteSurveyPhoto(models.Model):
    SLOT_CHOICES = [
        ('North Side', 'North Side'),
        ('South Side', 'South Side'),
        ('East Side', 'East Side'),
        ('West Side', 'West Side'),
        ('Overall Roof', 'Overall Roof'),
        ('Roof Close-up', 'Roof Close-up'),
        ('Water Tank', 'Water Tank'),
        ('Obstacle', 'Obstacle'),
        ('Drone Photo', 'Drone Photo'),
        ('Earthing Location', 'Earthing Location'),
        ('Inverter Location', 'Inverter Location'),
        ('Meter', 'Meter'),
        ('Cable Route', 'Cable Route'),
    ]
    REQUIRED_SLOTS = [
        'North Side', 'South Side', 'East Side', 'West Side', 'Overall Roof',
        'Roof Close-up', 'Water Tank', 'Obstacle',
    ]

    survey = models.ForeignKey(SiteSurvey, on_delete=models.CASCADE, related_name='photos')
    slot = models.CharField(max_length=30, choices=SLOT_CHOICES)
    image = models.ImageField(upload_to=site_survey_photo_upload_path, validators=[validate_image_extension, validate_upload_size])
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_site_survey_photos')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.survey.project.project_id} — {self.slot}'

    class Meta:
        ordering = ['-uploaded_at']
        unique_together = ['survey', 'slot']


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


class SubsidyApplication(models.Model):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Submitted', 'Submitted'),
        ('Under Process', 'Under Process'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('Completed', 'Completed'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='subsidy_applications')
    application_number = models.CharField(max_length=100, blank=True)
    application_date = models.DateField(null=True, blank=True)
    discom = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    # BUG-041: real FK to the workforce Employee record instead of a
    # free-text name, so the assignment is actually linked to a person
    # instead of a string that can drift/typo out of sync.
    assigned_employee = models.ForeignKey(
        'workforce.Employee', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='subsidy_applications',
    )
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.project.project_id} — {self.application_number or "Draft"}'

    class Meta:
        ordering = ['-created_at']


class SubsidyDocument(models.Model):
    DOC_TYPE_CHOICES = [
        ('Electricity Bill', 'Electricity Bill'),
        ('Aadhaar', 'Aadhaar'),
        ('PAN', 'PAN'),
        ('Approval Letter', 'Approval Letter'),
        ('Other', 'Other'),
    ]

    subsidy = models.ForeignKey(SubsidyApplication, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=50, choices=DOC_TYPE_CHOICES, default='Other')
    name = models.CharField(max_length=200)
    file = models.FileField(upload_to='subsidy_docs/%Y/%m/', validators=[validate_document_extension, validate_upload_size])
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.subsidy} — {self.name}'


class ProjectApproval(models.Model):
    APPROVAL_TYPES = [
        ('Budget Approval', 'Budget Approval'),
        ('Material Purchase', 'Material Purchase'),
        ('Vendor Payment', 'Vendor Payment'),
        ('Technical Clearance', 'Technical Clearance'),
        ('Site Survey', 'Site Survey'),
        ('Installation Plan', 'Installation Plan'),
        ('Subsidy Application', 'Subsidy Application'),
        ('Commission Report', 'Commission Report'),
        ('Other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Urgent', 'Urgent'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='approvals')
    approval_type = models.CharField(max_length=50, choices=APPROVAL_TYPES, default='Other')
    subject = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    requested_by = models.CharField(max_length=200, blank=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_approvals')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_approvals')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='actioned_approvals')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'APR-{self.created_at.year}-{self.id:04d} — {self.subject}'

    class Meta:
        ordering = ['-created_at']


class ProjectApprovalDocument(models.Model):
    approval = models.ForeignKey(ProjectApproval, on_delete=models.CASCADE, related_name='documents')
    name = models.CharField(max_length=200)
    file = models.FileField(upload_to='approval_docs/%Y/%m/', validators=[validate_document_extension, validate_upload_size])
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.approval} — {self.name}'
