import datetime
import uuid
from decimal import Decimal, InvalidOperation
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.accounts.models import User


def generate_ivrs():
    return f'IVRS{uuid.uuid4().hex[:8].upper()}'


class Lead(models.Model):
    STATUS_CHOICES = [
        ('New', 'New'),
        ('Follow-up', 'Follow-up'),
        ('Quotation', 'Quotation'),
        ('Won', 'Won'),
        ('Lost', 'Lost'),
    ]
    CATEGORY_CHOICES = [
        ('Hot', 'Hot'),
        ('Warm', 'Warm'),
        ('Cool', 'Cool'),
    ]

    # Mandatory fields
    customer_name = models.CharField(max_length=200)
    mobile_number = models.CharField(max_length=15)
    ivrs_number = models.CharField(max_length=50, unique=True, blank=True, default=generate_ivrs)

    PROJECT_TYPE_CHOICES = [
        ('On-Grid', 'On-Grid'),
        ('Off-Grid', 'Off-Grid'),
        ('Hybrid', 'Hybrid'),
    ]
    PRIORITY_CHOICES = [
        ('High', 'High'),
        ('Medium', 'Medium'),
        ('Low', 'Low'),
    ]

    # Optional fields
    alternate_number = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)
    project_name = models.CharField(max_length=200, blank=True)
    project_type = models.CharField(max_length=20, choices=PROJECT_TYPE_CHOICES, blank=True)
    estimated_capacity = models.CharField(max_length=50, blank=True)
    requirement_details = models.TextField(blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    latitude = models.CharField(max_length=20, blank=True)
    longitude = models.CharField(max_length=20, blank=True)
    source = models.CharField(max_length=100, blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, blank=True)
    remarks = models.TextField(blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='New')
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES, blank=True)

    # Assignments
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_leads')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_leads')

    # Follow-up
    next_follow_up = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.customer_name} — {self.ivrs_number}'

    class Meta:
        ordering = ['-created_at']


class FollowUp(models.Model):
    TYPE_CHOICES = [
        ('Call', 'Call'),
        ('WhatsApp', 'WhatsApp'),
        ('Site Visit', 'Site Visit'),
        ('Email', 'Email'),
        ('Note', 'Note'),
    ]
    STATUS_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('Completed', 'Completed'),
        ('Missed', 'Missed'),
    ]

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='follow_ups')
    follow_up_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    scheduled_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Scheduled')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='follow_ups')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.lead.customer_name} — {self.follow_up_type} — {self.scheduled_at:%d %b %Y}'

    class Meta:
        ordering = ['-created_at']


class AdminApproval(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='approvals')
    ivrs_number = models.CharField(max_length=50)
    duplicate_of = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name='duplicate_approvals')
    requested_customer_name = models.CharField(max_length=255, blank=True)
    requested_mobile_number = models.CharField(max_length=20, blank=True)
    requested_project_name = models.CharField(max_length=255, blank=True)
    requested_project_type = models.CharField(max_length=50, blank=True)
    requested_payload = models.JSONField(default=dict, blank=True)
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='approval_requests')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.ivrs_number} — {self.status}'

    class Meta:
        ordering = ['-created_at']


class Quotation(models.Model):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Sent', 'Sent'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]
    TEMPLATE_CHOICES = [
        ('Residential Subsidy', 'Residential Subsidy Solar Quotation'),
        ('Residential Non-Subsidy', 'Residential Non-Subsidy Quotation'),
        ('Commercial', 'Commercial Solar Quotation'),
        ('Industrial', 'Industrial Solar Quotation'),
        ('Structure', 'Solar Structure Quotation'),
        ('BOS Kit', 'BOS Kit Quotation'),
    ]
    PROJECT_TYPE_CHOICES = [
        ('Residential Subsidy', 'Residential Subsidy'),
        ('Residential Non Subsidy', 'Residential Non Subsidy'),
        ('Commercial', 'Commercial'),
        ('Industrial', 'Industrial'),
        ('Agriculture', 'Agriculture'),
    ]
    INSTALLATION_TYPE_CHOICES = [
        ('Rooftop', 'Rooftop'),
        ('Ground Mounted', 'Ground Mounted'),
        ('Elevated Structure', 'Elevated Structure'),
    ]
    STRUCTURE_MATERIAL_CHOICES = [
        ('GI', 'GI'),
        ('HDGI', 'HDGI'),
        ('Aluminium', 'Aluminium'),
    ]

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='quotations')

    # A. Basic Details
    quotation_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    template = models.CharField(max_length=30, choices=TEMPLATE_CHOICES, default='Residential Subsidy')
    quotation_date = models.DateField(null=True, blank=True)
    valid_till = models.DateField(null=True, blank=True)
    sales_executive = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales_quotations')

    # B. Customer Details
    company_name = models.CharField(max_length=200, blank=True)
    alternate_number = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)
    gst_number = models.CharField(max_length=20, blank=True)
    aadhaar_number = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=10, blank=True)

    # C. Project Details
    project_type = models.CharField(max_length=30, choices=PROJECT_TYPE_CHOICES, blank=True)
    installation_type = models.CharField(max_length=30, choices=INSTALLATION_TYPE_CHOICES, blank=True)
    sanctioned_load_kw = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    monthly_electricity_bill = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    discom_name = models.CharField(max_length=100, blank=True)
    existing_meter_number = models.CharField(max_length=50, blank=True)
    connection_type = models.CharField(max_length=50, blank=True)
    consumer_number = models.CharField(max_length=50, blank=True)
    execution_timeline = models.CharField(max_length=100, blank=True)

    # D. Plant Details
    plant_capacity_kw = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    estimated_annual_generation = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    shadow_free_area = models.CharField(max_length=100, blank=True)
    module_orientation = models.CharField(max_length=50, blank=True)

    # E. Panel Details
    panel_brand = models.CharField(max_length=100, blank=True)
    panel_model = models.CharField(max_length=100, blank=True)
    panel_type = models.CharField(max_length=30, blank=True)
    panel_wattage = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    number_of_panels = models.PositiveIntegerField(null=True, blank=True)
    total_dc_capacity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    # F. Inverter Details
    inverter_brand = models.CharField(max_length=100, blank=True)
    inverter_model = models.CharField(max_length=100, blank=True)
    inverter_type = models.CharField(max_length=30, blank=True)
    inverter_capacity = models.CharField(max_length=50, blank=True)
    inverter_quantity = models.PositiveIntegerField(null=True, blank=True)

    # G. Structure Details
    structure_type = models.CharField(max_length=100, blank=True)
    structure_material = models.CharField(max_length=20, choices=STRUCTURE_MATERIAL_CHOICES, blank=True)
    coating_details = models.CharField(max_length=100, blank=True)
    foundation_type = models.CharField(max_length=100, blank=True)
    wind_speed_rating = models.CharField(max_length=50, blank=True)

    # H. BOS Material
    dc_cable = models.CharField(max_length=200, blank=True)
    ac_cable = models.CharField(max_length=200, blank=True)
    earthing_kit = models.CharField(max_length=200, blank=True)
    lightning_arrester = models.CharField(max_length=200, blank=True)
    acdb = models.CharField(max_length=200, blank=True)
    dcdb = models.CharField(max_length=200, blank=True)
    connectors = models.CharField(max_length=200, blank=True)
    mc4_connector = models.CharField(max_length=200, blank=True)
    cable_tray = models.CharField(max_length=200, blank=True)
    fasteners = models.CharField(max_length=200, blank=True)
    pvc_pipe = models.CharField(max_length=200, blank=True)

    # I. Costing Section
    material_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    structure_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    installation_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transportation_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    liaisoning_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_metering_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # J. Subsidy Section
    subsidy_applicable = models.BooleanField(default=False)
    subsidy_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    customer_contribution = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # K. Tax Section + totals
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=12)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # L. Payment Terms
    advance_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    material_dispatch_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    installation_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    commissioning_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # M. Warranty
    panel_warranty = models.CharField(max_length=100, blank=True)
    inverter_warranty = models.CharField(max_length=100, blank=True)
    structure_warranty = models.CharField(max_length=100, blank=True)
    workmanship_warranty = models.CharField(max_length=100, blank=True)

    # N. Additional Notes
    special_instructions = models.TextField(blank=True)
    scope_of_work = models.TextField(blank=True)
    exclusions = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='quotations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.quotation_number:
            year = datetime.date.today().year
            count = Quotation.objects.filter(created_at__year=year).count() + 1
            self.quotation_number = f'QUO-{year}-{count:04d}'
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        items_total = sum(item.amount for item in self.items.all())
        self.subtotal = (
            items_total + self.material_cost + self.structure_cost + self.installation_cost
            + self.transportation_cost + self.liaisoning_charges + self.net_metering_charges + self.other_charges
        )
        self.gst_amount = self.subtotal * self.gst_percent / 100
        self.grand_total = self.subtotal + self.gst_amount - self.discount
        self.customer_contribution = self.grand_total - self.subsidy_amount if self.subsidy_applicable else self.grand_total
        if self.number_of_panels and self.panel_wattage:
            self.total_dc_capacity = (Decimal(self.number_of_panels) * self.panel_wattage) / Decimal('1000')
            if not self.plant_capacity_kw:
                self.plant_capacity_kw = self.total_dc_capacity
        self.save(update_fields=[
            'subtotal', 'gst_amount', 'grand_total', 'customer_contribution',
            'total_dc_capacity', 'plant_capacity_kw',
        ])

    @property
    def cost_per_watt(self):
        if not self.total_dc_capacity:
            return None
        watts = float(self.total_dc_capacity) * 1000
        if watts <= 0:
            return None
        return round(float(self.customer_contribution) / watts, 2)

    @property
    def estimated_annual_savings(self):
        if not self.monthly_electricity_bill:
            return None
        return round(float(self.monthly_electricity_bill) * 12, 2)

    @property
    def roi_percent(self):
        savings = self.estimated_annual_savings
        if not savings or not self.customer_contribution:
            return None
        return round((savings / float(self.customer_contribution)) * 100, 2)

    @property
    def payback_period_years(self):
        savings = self.estimated_annual_savings
        if not savings or not self.customer_contribution:
            return None
        return round(float(self.customer_contribution) / savings, 2)

    def __str__(self):
        return f'{self.quotation_number or f"Quotation #{self.pk}"} — {self.lead.customer_name}'

    class Meta:
        ordering = ['-created_at']


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='items')
    item_name = models.CharField(max_length=200)
    brand = models.CharField(max_length=100, blank=True)
    specification = models.CharField(max_length=200, blank=True)
    quantity = models.CharField(max_length=50)
    unit = models.CharField(max_length=20, default='Nos')
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f'{self.item_name} — {self.quantity}'



    class Meta:
        ordering = ['id']
        verbose_name_plural = 'Quotation Items'
        unique_together = ['quotation', 'item_name']
        constraints = [
            models.CheckConstraint(check=models.Q(quantity__regex=r'^\d+(\.\d+)?$'), name='quantity_numeric'),
            models.CheckConstraint(check=models.Q(rate__gte=0), name='rate_non_negative'),
            models.CheckConstraint(check=models.Q(amount__gte=0), name='amount_non_negative'),
        ]


@receiver(post_save, sender=Lead)
def create_project_for_won_lead(sender, instance, **kwargs):
    if instance.status != 'Won':
        return

    from apps.projects.models import Project

    if Project.objects.filter(lead=instance).exists():
        return

    try:
        capacity_kwp = Decimal(instance.estimated_capacity) if instance.estimated_capacity else Decimal('0')
    except (InvalidOperation, ValueError):
        capacity_kwp = Decimal('0')

    Project.objects.create(
        project_name=instance.project_name or f'{instance.customer_name} Solar Project',
        lead=instance,
        customer_name=instance.customer_name,
        site_address=instance.address,
        city=instance.city,
        state=instance.state,
        project_type=instance.project_type or 'On-Grid',
        capacity_kwp=capacity_kwp,
        manager=instance.assigned_to,
        status='Planning',
        created_by=instance.created_by,
    )
