from datetime import timedelta

from django.db import models
from apps.accounts.models import User
from .schedule import add_years
from apps.projects.models import Project
from malwa_solar.validators import validate_document_extension, validate_image_extension, validate_upload_size

FREE_SERVICE_YEARS = 5
QUARTERLY_INTERVAL_MONTHS = 3


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


class OmPlant(models.Model):
    """Permanent O&M profile of one commissioned plant (one per project).

    Customer / plant fields are a snapshot copied from the project when the
    plant is activated, so O&M keeps working even if project data is edited
    later; staff can still correct them here.
    """
    CUSTOMER_TYPE_CHOICES = [
        ('Residential', 'Residential'),
        ('Commercial', 'Commercial'),
        ('Industrial', 'Industrial'),
        ('Institutional', 'Institutional'),
        ('Other', 'Other'),
    ]
    SYSTEM_TYPE_CHOICES = [
        ('On Grid', 'On Grid'),
        ('Hybrid', 'Hybrid'),
        ('Off Grid', 'Off Grid'),
    ]
    OM_STATUS_CHOICES = [
        ('Free Service Active', 'Free Service Active'),
        ('Free Service Expiring Soon', 'Free Service Expiring Soon'),
        ('Free Service Expired', 'Free Service Expired'),
        ('Paid O&M', 'Paid O&M'),
        ('AMC Active', 'AMC Active'),
        ('AMC Expired', 'AMC Expired'),
    ]

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='om_plant')
    lead = models.ForeignKey('leads.Lead', on_delete=models.SET_NULL, null=True, blank=True, related_name='om_plants')
    customer = models.ForeignKey(
        'accounts_module.Account', on_delete=models.SET_NULL, null=True, blank=True, related_name='om_plants',
    )

    customer_name = models.CharField(max_length=200)
    mobile_number = models.CharField(max_length=20, blank=True)
    alternate_mobile = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    customer_type = models.CharField(max_length=20, choices=CUSTOMER_TYPE_CHOICES, default='Residential')

    plant_name = models.CharField(max_length=200)
    plant_location = models.CharField(max_length=255, blank=True)
    capacity_kw = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    plant_type = models.CharField(max_length=100, blank=True)
    system_type = models.CharField(max_length=20, choices=SYSTEM_TYPE_CHOICES, default='On Grid')
    installation_date = models.DateField(null=True, blank=True)
    commissioning_date = models.DateField(null=True, blank=True)
    handover_date = models.DateField(null=True, blank=True)

    panel_brand = models.CharField(max_length=100, blank=True)
    panel_model = models.CharField(max_length=100, blank=True)
    panel_wattage_w = models.CharField(max_length=20, blank=True)
    panel_count = models.CharField(max_length=20, blank=True)
    panel_serials = models.TextField(blank=True)
    inverter_brand = models.CharField(max_length=100, blank=True)
    inverter_model = models.CharField(max_length=100, blank=True)
    inverter_capacity_kw = models.CharField(max_length=20, blank=True)
    inverter_serial = models.CharField(max_length=200, blank=True)
    structure_type = models.CharField(max_length=100, blank=True)
    acdb_details = models.CharField(max_length=255, blank=True)
    dcdb_details = models.CharField(max_length=255, blank=True)
    earthing_details = models.TextField(blank=True)
    net_meter_details = models.TextField(blank=True)
    warranty_details = models.TextField(blank=True)

    free_service_start = models.DateField(null=True, blank=True)
    free_service_end = models.DateField(null=True, blank=True)
    om_status = models.CharField(max_length=30, choices=OM_STATUS_CHOICES, default='Free Service Active', db_index=True)
    amc_contract = models.ForeignKey(
        'amc.AmcContract', on_delete=models.SET_NULL, null=True, blank=True, related_name='om_plants',
    )
    is_active = models.BooleanField(default=True, db_index=True)
    remarks = models.TextField(blank=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_plants_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def plant_code(self):
        return f'PLT-{self.id:05d}' if self.id else ''

    def __str__(self):
        return f'{self.plant_code} — {self.plant_name}'

    class Meta:
        ordering = ['-created_at']


class OmBreakdownTicket(models.Model):
    """Customer complaint ticket (was "Breakdown Ticket")."""
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('Assigned', 'Assigned'),
        ('In Progress', 'In Progress'),
        ('Site Visit', 'Site Visit'),
        ('Resolved', 'Resolved'),
        ('Closed', 'Closed'),
    ]
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Critical', 'Critical'),
    ]
    COMPLAINT_TYPE_CHOICES = [
        ('Inverter Error', 'Inverter Error'),
        ('Low Generation', 'Low Generation'),
        ('No Generation', 'No Generation'),
        ('Panel Damage', 'Panel Damage'),
        ('Panel Cleaning', 'Panel Cleaning'),
        ('Wiring / Cable', 'Wiring / Cable'),
        ('Earthing', 'Earthing'),
        ('Meter / Net Meter', 'Meter / Net Meter'),
        ('Structure', 'Structure'),
        ('Monitoring / App', 'Monitoring / App'),
        ('Other', 'Other'),
    ]
    OPEN_STATUSES = ('Open', 'Assigned', 'In Progress', 'Site Visit')

    subject = models.CharField(max_length=255)
    plant = models.ForeignKey(OmPlant, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_tickets')
    site = models.CharField(max_length=255, blank=True)
    asset = models.ForeignKey(OmAsset, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    contact_number = models.CharField(max_length=20, blank=True)
    complaint_at = models.DateTimeField(null=True, blank=True)
    complaint_type = models.CharField(max_length=30, choices=COMPLAINT_TYPE_CHOICES, blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_tickets_assigned')
    expected_visit_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Open')
    issue_description = models.TextField(blank=True)
    resolution = models.TextField(blank=True)
    remarks = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_tickets_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'BD-{self.id:04d} — {self.subject}'

    class Meta:
        ordering = ['-created_at']


class OmMaintenanceTask(models.Model):
    """Quarterly preventive service, ticket task or manual O&M task."""
    TYPE_CHOICES = [
        ('Preventive', 'Preventive'),
        ('Corrective', 'Corrective'),
    ]
    SOURCE_CHOICES = [
        ('Quarterly', 'Quarterly'),
        ('Ticket', 'Ticket'),
        ('Manual', 'Manual'),
    ]
    STATUS_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('Pending', 'Pending'),
        ('Assigned', 'Assigned'),
        ('Accepted', 'Accepted'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Critical', 'Critical'),
    ]
    CLOSED_STATUSES = ('Completed', 'Cancelled')

    title = models.CharField(max_length=255)
    plant = models.ForeignKey(OmPlant, on_delete=models.CASCADE, null=True, blank=True, related_name='tasks')
    ticket = models.ForeignKey(OmBreakdownTicket, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_tasks')
    site = models.CharField(max_length=255, blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='Manual', db_index=True)
    sequence_no = models.PositiveIntegerField(null=True, blank=True)
    task_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='Preventive')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    engineer = models.CharField(max_length=200, blank=True)
    assigned_engineer = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_tasks_assigned',
    )
    due_date = models.DateField(null=True, blank=True)
    visit_date = models.DateField(null=True, blank=True)
    deadline = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    completed_at = models.DateTimeField(null=True, blank=True)
    work_details = models.TextField(blank=True)
    checklist = models.JSONField(default=list, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_tasks_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def effective_deadline(self):
        return self.deadline or self.due_date

    def __str__(self):
        return f'MT-{self.id:04d} — {self.title}'

    class Meta:
        ordering = ['-created_at']


class OmSiteVisit(models.Model):
    """Permanent service visit record — cancelled instead of deleted."""
    STATUS_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]
    SERVICE_TYPE_CHOICES = [
        ('Quarterly', 'Quarterly'),
        ('Complaint', 'Complaint'),
        ('Emergency', 'Emergency'),
        ('Inspection', 'Inspection'),
        ('Other', 'Other'),
    ]
    FINAL_STATUS_CHOICES = [
        ('Resolved', 'Resolved'),
        ('Partially Resolved', 'Partially Resolved'),
        ('Pending Parts', 'Pending Parts'),
        ('Revisit Required', 'Revisit Required'),
    ]
    INSPECTION_KEYS = ('inverter', 'panel', 'structure', 'cable', 'earthing', 'acdb_dcdb', 'cleaning', 'meter')

    plant = models.ForeignKey(OmPlant, on_delete=models.SET_NULL, null=True, blank=True, related_name='visits')
    task = models.ForeignKey(OmMaintenanceTask, on_delete=models.SET_NULL, null=True, blank=True, related_name='visits')
    ticket = models.ForeignKey(OmBreakdownTicket, on_delete=models.SET_NULL, null=True, blank=True, related_name='visits')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_visits')
    site = models.CharField(max_length=255, blank=True)
    purpose = models.CharField(max_length=255, blank=True)
    service_type = models.CharField(max_length=20, choices=SERVICE_TYPE_CHOICES, default='Other')
    engineer = models.CharField(max_length=200, blank=True)
    assigned_engineer = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_visits_assigned',
    )
    date = models.DateField(null=True, blank=True)
    arrival_time = models.TimeField(null=True, blank=True)
    departure_time = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Scheduled')
    plant_generation_kwh = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    inspection = models.JSONField(default=dict, blank=True)
    checklist = models.JSONField(default=list, blank=True)
    complaint = models.TextField(blank=True)
    fault_found = models.TextField(blank=True)
    diagnosis = models.TextField(blank=True)
    work_done = models.TextField(blank=True)
    labour_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    engineer_notes = models.TextField(blank=True)
    customer_remarks = models.TextField(blank=True)
    customer_signature = models.ImageField(
        upload_to='om_signatures/%Y/%m/', null=True, blank=True,
        validators=[validate_image_extension, validate_upload_size],
    )
    final_status = models.CharField(max_length=30, choices=FINAL_STATUS_CHOICES, blank=True)
    next_service_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_visits_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'SV-{self.id:04d} — {self.site}'

    class Meta:
        ordering = ['-created_at']


class OmVisitPart(models.Model):
    MATERIAL_CHOICES = [
        ('MC4 Connector', 'MC4 Connector'),
        ('DC Fuse', 'DC Fuse'),
        ('AC Fuse', 'AC Fuse'),
        ('MCB', 'MCB'),
        ('MCCB', 'MCCB'),
        ('Cable', 'Cable'),
        ('SPD', 'SPD'),
        ('Fan', 'Fan'),
        ('Inverter Card', 'Inverter Card'),
        ('Connector', 'Connector'),
        ('Other', 'Other'),
    ]

    visit = models.ForeignKey(OmSiteVisit, on_delete=models.CASCADE, related_name='parts')
    plant = models.ForeignKey(OmPlant, on_delete=models.SET_NULL, null=True, blank=True, related_name='parts_used')
    ticket = models.ForeignKey(OmBreakdownTicket, on_delete=models.SET_NULL, null=True, blank=True, related_name='parts_used')
    material = models.CharField(max_length=30, choices=MATERIAL_CHOICES, default='Other')
    description = models.CharField(max_length=255, blank=True)
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='om_visit_parts',
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    serial_number = models.CharField(max_length=200, blank=True)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    used_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_parts_used')
    used_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def total_cost(self):
        return (self.unit_cost or 0) * (self.quantity or 0)

    def __str__(self):
        return f'{self.material} x {self.quantity}'

    class Meta:
        ordering = ['-created_at']


class OmInsurance(models.Model):
    STATUS_CHOICES = [
        ('Insured', 'Insured'),
        ('Not Insured', 'Not Insured'),
        ('Expired', 'Expired'),
    ]
    DURATION_CHOICES = [
        ('1 Year', '1 Year'),
        ('2 Year', '2 Year'),
        ('3 Year', '3 Year'),
        ('5 Year', '5 Year'),
        ('Custom', 'Custom'),
    ]
    DURATION_YEARS = {'1 Year': 1, '2 Year': 2, '3 Year': 3, '5 Year': 5}

    plant = models.ForeignKey(OmPlant, on_delete=models.CASCADE, related_name='insurances')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Insured', db_index=True)
    company = models.CharField(max_length=200, blank=True)
    policy_number = models.CharField(max_length=100, blank=True)
    policy_type = models.CharField(max_length=100, blank=True)
    start_date = models.DateField(null=True, blank=True)
    duration = models.CharField(max_length=10, choices=DURATION_CHOICES, default='1 Year')
    expiry_date = models.DateField(null=True, blank=True)
    coverage_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    premium = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    policy_document = models.FileField(
        upload_to='om_insurance/%Y/%m/', null=True, blank=True,
        validators=[validate_document_extension, validate_upload_size],
    )
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='om_insurances_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        years = self.DURATION_YEARS.get(self.duration)
        if years and self.start_date:
            self.expiry_date = add_years(self.start_date, years) - timedelta(days=1)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'INS-{self.id:04d} — {self.policy_number or self.company}'

    class Meta:
        ordering = ['-expiry_date', '-created_at']


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
    linked_inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='om_spare_parts',
    )
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
    file = models.FileField(upload_to='om_reports/%Y/%m/', null=True, blank=True, validators=[validate_document_extension, validate_upload_size])
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
        ('Plant', 'Plant'),
        ('Insurance', 'Insurance'),
        ('General', 'General'),
    ]
    CATEGORY_CHOICES = [
        ('Before', 'Before'),
        ('After', 'After'),
        ('Policy', 'Policy'),
        ('General', 'General'),
    ]

    module = models.CharField(max_length=20, choices=MODULE_CHOICES, default='General')
    related_id = models.IntegerField(null=True, blank=True)
    plant = models.ForeignKey(OmPlant, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='General')
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='om_docs/%Y/%m/', validators=[validate_document_extension, validate_upload_size])
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='om_documents_uploaded')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} ({self.module})'

    class Meta:
        ordering = ['-uploaded_at']
