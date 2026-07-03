from django.db import models

from apps.accounts.models import User
from apps.projects.models import Project


class AmcContract(models.Model):
    TYPE_CHOICES = [
        ('Comprehensive', 'Comprehensive'),
        ('Non-Comprehensive', 'Non-Comprehensive'),
    ]
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Expiring Soon', 'Expiring Soon'),
        ('Expired', 'Expired'),
        ('Cancelled', 'Cancelled'),
    ]

    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='amc_contracts')
    customer_name = models.CharField(max_length=200)
    site = models.CharField(max_length=255, blank=True)
    contract_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='Comprehensive')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    annual_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    next_renewal_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='amc_contracts_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'AMC-{self.id:04d} — {self.customer_name}'

    class Meta:
        ordering = ['-created_at']


class AmcWarranty(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Expiring Soon', 'Expiring Soon'),
        ('Expired', 'Expired'),
        ('Claimed', 'Claimed'),
    ]

    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='amc_warranties')
    asset_type = models.CharField(max_length=100, blank=True)
    manufacturer = models.CharField(max_length=200, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    warranty_start = models.DateField(null=True, blank=True)
    warranty_end = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    coverage_details = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='amc_warranties_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'WAR-{self.id:04d} — {self.serial_number or self.asset_type}'

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'AMC Warranties'


class AmcServiceRequest(models.Model):
    PRIORITY_CHOICES = [('Low', 'Low'), ('Medium', 'Medium'), ('High', 'High')]
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('In Progress', 'In Progress'),
        ('Resolved', 'Resolved'),
        ('Closed', 'Closed'),
    ]

    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='amc_service_requests')
    contract = models.ForeignKey(AmcContract, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_requests')
    subject = models.CharField(max_length=255)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Open')
    requested_date = models.DateField(null=True, blank=True)
    assigned_engineer = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='amc_service_requests_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'SR-{self.id:04d} — {self.subject}'

    class Meta:
        ordering = ['-created_at']


class AmcVisit(models.Model):
    TYPE_CHOICES = [
        ('Preventive', 'Preventive'),
        ('Corrective', 'Corrective'),
        ('Inspection', 'Inspection'),
    ]
    STATUS_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]

    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='amc_visits')
    service_request = models.ForeignKey(
        AmcServiceRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name='visits',
    )
    visit_date = models.DateField(null=True, blank=True)
    engineer = models.CharField(max_length=200, blank=True)
    visit_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='Preventive')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Scheduled')
    findings = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='amc_visits_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'VIS-{self.id:04d} — {self.visit_type}'

    class Meta:
        ordering = ['-created_at']


class AmcRenewal(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]

    contract = models.ForeignKey(AmcContract, on_delete=models.CASCADE, related_name='renewals')
    renewal_date = models.DateField(null=True, blank=True)
    new_end_date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='amc_renewals_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'RNW-{self.id:04d}'

    class Meta:
        ordering = ['-created_at']


class AmcClaim(models.Model):
    STATUS_CHOICES = [
        ('Submitted', 'Submitted'),
        ('Under Review', 'Under Review'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('Paid', 'Paid'),
    ]

    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='amc_claims')
    warranty = models.ForeignKey(AmcWarranty, on_delete=models.SET_NULL, null=True, blank=True, related_name='claims')
    claim_date = models.DateField(null=True, blank=True)
    claim_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Submitted')
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='amc_claims_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'CLM-{self.id:04d}'

    class Meta:
        ordering = ['-created_at']


class AmcDocument(models.Model):
    TYPE_CHOICES = [
        ('Contract', 'Contract'),
        ('Warranty', 'Warranty'),
        ('Invoice', 'Invoice'),
        ('Service Report', 'Service Report'),
        ('Receipt', 'Receipt'),
        ('Other', 'Other'),
    ]

    name = models.CharField(max_length=255)
    document_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='Other')
    category = models.CharField(max_length=100, blank=True)
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='amc_documents')
    contract = models.ForeignKey(AmcContract, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    file = models.FileField(upload_to='amc/documents/', blank=True)
    remarks = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='amc_documents_uploaded')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-created_at']
