import datetime
import uuid
from decimal import Decimal, InvalidOperation
from django.core.files.base import ContentFile
from django.db import models, transaction, IntegrityError
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.text import slugify
from apps.accounts.models import User
from malwa_solar.validators import validate_image_extension, validate_upload_size


def generate_ivrs():
    return f'IVRS{uuid.uuid4().hex[:8].upper()}'


class LeadSequenceCounter(models.Model):
    """Backs atomic, race-free generation of Quotation.quotation_number
    (BUG-052) with a single locked row per prefix instead of an unlocked
    `count()+1` read — concurrent saves would otherwise race and can both
    compute the same number, tripping the field's `unique=True` constraint.
    Mirrors `apps.workforce.models.EmployeeIdCounter` (BUG-025) and
    `apps.projects.models.SequenceCounter` (BUG-026/071) — kept local to
    this app rather than shared, to avoid a leads<->projects import cycle
    (projects.models already imports apps.leads.models.Lead)."""
    key = models.CharField(max_length=50, unique=True)
    value = models.IntegerField(default=0)

    @classmethod
    def next_value(cls, key, initial=0):
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


def lead_survey_photo_upload_path(instance, filename):
    # Filed by lead + customer, per spec ("Save images using Lead ID and
    # Customer ID"), so photos are traceable back to their record on disk too.
    ext = filename.rsplit('.', 1)[-1] if '.' in filename else 'jpg'
    lead = instance.survey.lead
    customer_slug = slugify(lead.customer_name) or 'customer'
    date_path = datetime.date.today().strftime('%Y/%m')
    return f'lead_survey_photos/{date_path}/lead{lead.id}_{customer_slug}/{uuid.uuid4().hex[:8]}.{ext}'


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

    # Soft delete → CRM Settings Recycle Bin (CRM + Tele deletes)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_leads',
    )

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
    # Tele Executive portal fields: reminder preference for the scheduled
    # follow-up, and the lead status set as a result of this interaction
    # (kept per-record so the follow-up history timeline can show it).
    reminder = models.CharField(max_length=30, blank=True)
    status_after = models.CharField(max_length=20, blank=True)
    # Call/WhatsApp outcome for long-running lead timelines (1.5yr+ history).
    outcome = models.CharField(max_length=40, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='follow_ups')
    created_at = models.DateTimeField(auto_now_add=True)

    # Soft delete → CRM Settings Recycle Bin
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_follow_ups',
    )

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
    # BUG-054: the Lead actually created by approve() from `requested_payload`,
    # once this request is approved. Nothing wrote this back before — approve()
    # only flipped `status` — so an approved request was a dead end and the
    # sales rep's lead never appeared anywhere.
    created_lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_from_approval')
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

    # Client proposal PDF — subject / specs / performance / split GST
    subject = models.CharField(max_length=255, blank=True, default='Comprehensive proposal for grid tied')
    cover_letter = models.TextField(blank=True)
    tilt_angle_range = models.CharField(max_length=50, blank=True)
    net_meter_details = models.TextField(blank=True)
    infra_items = models.TextField(blank=True)
    govt_liasoning_details = models.CharField(max_length=255, blank=True)
    structure_spec_details = models.TextField(blank=True)
    monthly_production_units = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    tariff_rate_per_unit = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, default=Decimal('7.50'))
    annual_saving_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    plant_life_years = models.PositiveIntegerField(null=True, blank=True, default=30)
    use_split_gst = models.BooleanField(default=True)
    project_cost_with_gst = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    taxable_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_5_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_18_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_metering_including = models.BooleanField(default=True)
    lt_panel_including = models.BooleanField(default=True)
    walkway_including = models.BooleanField(default=True)
    cleaning_solution_including = models.BooleanField(default=True)
    payment_terms_text = models.TextField(
        blank=True,
        default='Payment terms 50% advance, 30% after structure deliver & 20% after plant installed',
    )
    validity_text = models.CharField(
        max_length=255,
        blank=True,
        default='Quotation validity is till availability of material/10 days',
    )
    terms_and_conditions = models.TextField(blank=True)

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

    @staticmethod
    def fy_quote_prefix(today=None):
        today = today or datetime.date.today()
        if today.month >= 4:
            start, end = today.year % 100, (today.year + 1) % 100
        else:
            start, end = (today.year - 1) % 100, today.year % 100
        return f'MSE/{start:02d}-{end:02d}/'

    def save(self, *args, **kwargs):
        if not self.quotation_number:
            prefix = self.fy_quote_prefix()
            seed = 0
            last = Quotation.objects.filter(quotation_number__startswith=prefix).order_by('-quotation_number').first()
            if last:
                try:
                    seed = int(str(last.quotation_number).rsplit('/', 1)[-1])
                except ValueError:
                    seed = 0
            num = LeadSequenceCounter.next_value(prefix, initial=seed)
            self.quotation_number = f'{prefix}{num}'
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        items_total = sum(item.amount for item in self.items.all()) if self.pk else Decimal('0')
        cost_subtotal = (
            items_total + self.material_cost + self.structure_cost + self.installation_cost
            + self.transportation_cost + self.liaisoning_charges + self.net_metering_charges + self.other_charges
        )

        if self.number_of_panels and self.panel_wattage:
            self.total_dc_capacity = (Decimal(self.number_of_panels) * self.panel_wattage) / Decimal('1000')
            if not self.plant_capacity_kw:
                self.plant_capacity_kw = self.total_dc_capacity

        # Auto plant performance when capacity is known
        if self.plant_capacity_kw and not self.monthly_production_units:
            self.monthly_production_units = (self.plant_capacity_kw * Decimal('120')).quantize(Decimal('0.01'))
        if self.monthly_production_units and not self.estimated_annual_generation:
            self.estimated_annual_generation = (self.monthly_production_units * Decimal('12')).quantize(Decimal('0.01'))
        if self.estimated_annual_generation and self.tariff_rate_per_unit and not self.annual_saving_amount:
            self.annual_saving_amount = (self.estimated_annual_generation * self.tariff_rate_per_unit).quantize(Decimal('0.01'))

        if self.use_split_gst and self.project_cost_with_gst:
            # Solar plant GST: 5% on 70% + 18% on 30% ⇒ effective 8.9%
            total = Decimal(self.project_cost_with_gst)
            taxable = (total / Decimal('1.089')).quantize(Decimal('0.01'))
            gst5 = (taxable * Decimal('0.70') * Decimal('0.05')).quantize(Decimal('0.01'))
            gst18 = (taxable * Decimal('0.30') * Decimal('0.18')).quantize(Decimal('0.01'))
            gst_total = gst5 + gst18
            # Keep grand total exact to entered project cost
            drift = total - (taxable + gst_total)
            if drift:
                gst18 = (gst18 + drift).quantize(Decimal('0.01'))
                gst_total = gst5 + gst18
            self.taxable_value = taxable
            self.gst_5_amount = gst5
            self.gst_18_amount = gst18
            self.gst_amount = gst_total
            self.gst_percent = Decimal('8.90')
            self.subtotal = taxable
            self.grand_total = total - Decimal(self.discount or 0)
        else:
            self.subtotal = cost_subtotal
            self.gst_amount = (self.subtotal * self.gst_percent / 100).quantize(Decimal('0.01'))
            self.grand_total = self.subtotal + self.gst_amount - self.discount
            self.taxable_value = self.subtotal
            self.gst_5_amount = Decimal('0')
            self.gst_18_amount = Decimal('0')

        self.customer_contribution = self.grand_total - self.subsidy_amount if self.subsidy_applicable else self.grand_total
        self.save(update_fields=[
            'subtotal', 'gst_amount', 'gst_percent', 'grand_total', 'customer_contribution',
            'total_dc_capacity', 'plant_capacity_kw', 'taxable_value', 'gst_5_amount', 'gst_18_amount',
            'monthly_production_units', 'estimated_annual_generation', 'annual_saving_amount',
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


class LeadSiteSurvey(models.Model):
    # Lightweight survey done at the lead stage, when someone visits the site
    # to inspect it before the lead is won. This is distinct from the fuller
    # `SiteSurvey` under Project Management, which happens after conversion —
    # this record's fields get copied onto that one when the lead is won.
    MOUNTING_CHOICES = [
        ('Ground Mount', 'Ground Mount'),
        ('Roof / Terrace Mount', 'Roof / Terrace Mount'),
        ('Tin Shed Mount', 'Tin Shed Mount'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
    ]

    lead = models.OneToOneField(Lead, on_delete=models.CASCADE, related_name='site_survey')
    site_address = models.TextField(blank=True)
    latitude = models.CharField(max_length=20, blank=True)
    longitude = models.CharField(max_length=20, blank=True)
    mounting_type = models.CharField(max_length=30, choices=MOUNTING_CHOICES, blank=True)
    site_size_sqft = models.CharField(max_length=50, blank=True)
    customer_feedback = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='In Progress')
    survey_date = models.DateField(null=True, blank=True)
    surveyed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='lead_site_surveys')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.lead.customer_name} — Site Survey ({self.status})'

    class Meta:
        ordering = ['-created_at']


class LeadSurveyPhoto(models.Model):
    survey = models.ForeignKey(LeadSiteSurvey, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to=lead_survey_photo_upload_path, validators=[validate_image_extension, validate_upload_size])
    caption = models.CharField(max_length=200, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_survey_photos')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.survey.lead.customer_name} — Survey Photo #{self.pk}'

    class Meta:
        ordering = ['-uploaded_at']


@receiver(post_save, sender=Lead)
def create_project_for_won_lead(sender, instance, **kwargs):
    if instance.status != 'Won':
        return

    from apps.projects.models import Project, SiteSurvey, ProjectDocument

    if Project.objects.filter(lead=instance).exists():
        return

    try:
        capacity_kwp = Decimal(instance.estimated_capacity) if instance.estimated_capacity else Decimal('0')
    except (InvalidOperation, ValueError):
        capacity_kwp = Decimal('0')

    lead_survey = getattr(instance, 'site_survey', None)

    project = Project.objects.create(
        project_name=instance.project_name or f'{instance.customer_name} Solar Project',
        lead=instance,
        customer_name=instance.customer_name,
        site_address=(lead_survey.site_address if lead_survey and lead_survey.site_address else instance.address),
        city=instance.city,
        state=instance.state,
        site_size=(lead_survey.site_size_sqft if lead_survey else ''),
        project_type=instance.project_type or 'On-Grid',
        capacity_kwp=capacity_kwp,
        manager=instance.assigned_to,
        status='Planning',
        created_by=instance.created_by,
    )

    if lead_survey:
        SiteSurvey.objects.create(
            project=project,
            survey_date=lead_survey.survey_date,
            surveyed_by=lead_survey.surveyed_by,
            roof_type=lead_survey.mounting_type,
            rooftop_area_sqft=lead_survey.site_size_sqft,
            available_area_sqft=lead_survey.site_size_sqft,
            latitude=lead_survey.latitude,
            longitude=lead_survey.longitude,
            summary_notes=(f'From lead site visit: {lead_survey.customer_feedback}' if lead_survey.customer_feedback else ''),
        )
        for photo in lead_survey.photos.all():
            try:
                photo.image.open('rb')
                content = photo.image.read()
            except (OSError, ValueError):
                continue
            finally:
                photo.image.close()
            doc = ProjectDocument(
                project=project,
                name=photo.caption or f'Site Photo {photo.pk}',
                category='Site Photos',
                uploaded_by=lead_survey.surveyed_by,
            )
            doc.file.save(photo.image.name.rsplit('/', 1)[-1], ContentFile(content), save=True)
