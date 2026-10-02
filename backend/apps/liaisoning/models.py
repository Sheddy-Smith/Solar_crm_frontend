from django.db import models
from apps.accounts.models import User
from apps.projects.models import Project
from malwa_solar.validators import validate_document_extension, validate_upload_size


class LiaisonApplication(models.Model):
    TYPE_CHOICES = [
        ('Net Metering', 'Net Metering'),
        ('Captive Consumption', 'Captive Consumption'),
        ('Rooftop Solar', 'Rooftop Solar'),
        ('Grid Connection', 'Grid Connection'),
        ('Other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Submitted', 'Submitted'),
        ('Under Review', 'Under Review'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('Completed', 'Completed'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='lc_applications')
    application_number = models.CharField(max_length=100, blank=True)
    application_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='Net Metering')
    capacity_kw = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    discom = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Submitted')
    submitted_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='lc_applications_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'LC-APP-{self.id:04d} — {self.project.project_name}'

    class Meta:
        ordering = ['-created_at']


class LiaisonApproval(models.Model):
    TYPE_CHOICES = [
        ('Net Metering Approval', 'Net Metering Approval'),
        ('DISCOM Approval', 'DISCOM Approval'),
        ('Electrical Inspector', 'Electrical Inspector'),
        ('Subsidy Approval', 'Subsidy Approval'),
        ('Grid Synchronization', 'Grid Synchronization'),
        ('Other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='lc_approvals')
    approval_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='Other')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='lc_approvals_assigned')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    due_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    remarks = models.TextField(blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='lc_approvals_actioned')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='lc_approvals_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'LC-APR-{self.id:04d} — {self.approval_type}'

    class Meta:
        ordering = ['-created_at']


class LiaisonInspection(models.Model):
    STATUS_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='lc_inspections')
    inspector = models.CharField(max_length=200, blank=True)
    date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Scheduled')
    checklist = models.JSONField(default=list, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='lc_inspections_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'LC-INS-{self.id:04d} — {self.project.project_name}'

    class Meta:
        ordering = ['-created_at']


class LiaisonCommissioning(models.Model):
    STATUS_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='lc_commissionings')
    engineer = models.CharField(max_length=200, blank=True)
    date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Scheduled')
    checklist = models.JSONField(default=list, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='lc_commissionings_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'LC-COM-{self.id:04d} — {self.project.project_name}'

    class Meta:
        ordering = ['-created_at']


class LiaisonCompliance(models.Model):
    TYPE_CHOICES = [
        ('Safety Certificate', 'Safety Certificate'),
        ('CEIG Approval', 'CEIG Approval'),
        ('Pollution Clearance', 'Pollution Clearance'),
        ('Fire Safety', 'Fire Safety'),
        ('Annual Compliance', 'Annual Compliance'),
        ('Other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Submitted', 'Submitted'),
        ('Completed', 'Completed'),
        ('Overdue', 'Overdue'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='lc_compliances')
    compliance_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='Other')
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='lc_compliances_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'LC-CMP-{self.id:04d} — {self.compliance_type}'

    class Meta:
        ordering = ['-created_at']


class LiaisonDocument(models.Model):
    MODULE_CHOICES = [
        ('General', 'General'),
        ('Application', 'Application'),
        ('Approval', 'Approval'),
        ('Agreement', 'Agreement'),
        ('Inspection', 'Inspection'),
        ('Net Meter', 'Net Meter'),
        ('Commissioning', 'Commissioning'),
        ('Compliance', 'Compliance'),
    ]
    TYPE_CHOICES = [
        ('Aadhaar Card', 'Aadhaar Card'),
        ('PAN Card', 'PAN Card'),
        ('Electricity Bill', 'Electricity Bill'),
        ('Property Document', 'Property Document'),
        ('Bank Passbook', 'Bank Passbook'),
        ('Site Photo', 'Site Photo'),
        ('Application Form', 'Application Form'),
        ('Approval Letter', 'Approval Letter'),
        ('Agreement', 'Agreement'),
        ('Inspection Report', 'Inspection Report'),
        ('Net Meter Certificate', 'Net Meter Certificate'),
        ('Commissioning Report', 'Commissioning Report'),
        ('Compliance Certificate', 'Compliance Certificate'),
        ('Other', 'Other'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='lc_documents', null=True, blank=True)
    module = models.CharField(max_length=20, choices=MODULE_CHOICES, default='General')
    related_id = models.IntegerField(null=True, blank=True)
    doc_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='Other')
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='liaison_docs/%Y/%m/', validators=[validate_document_extension, validate_upload_size])
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='lc_documents_uploaded')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} ({self.module})'

    class Meta:
        ordering = ['-uploaded_at']


class LiaisonAgreement(models.Model):
    TYPE_CHOICES = [
        ('Net Metering Agreement', 'Net Metering Agreement'),
        ('Power Purchase Agreement', 'Power Purchase Agreement'),
        ('DISCOM Connection Agreement', 'DISCOM Connection Agreement'),
        ('Customer Agreement', 'Customer Agreement'),
        ('Other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Signed', 'Signed'),
        ('Submitted', 'Submitted'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='lc_agreements')
    agreement_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='Net Metering Agreement')
    agreement_number = models.CharField(max_length=100, blank=True)
    agreement_date = models.DateField(null=True, blank=True)
    signed_by = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='lc_agreements_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'LC-AGR-{self.id:04d} — {self.project.project_name}'

    class Meta:
        ordering = ['-created_at']


class LiaisonNetMeter(models.Model):
    METER_TYPE_CHOICES = [
        ('Bi-directional Meter', 'Bi-directional Meter'),
        ('Net Meter', 'Net Meter'),
        ('Solar Generation Meter', 'Solar Generation Meter'),
        ('Other', 'Other'),
    ]
    PHASE_CHOICES = [
        ('Single Phase', 'Single Phase'),
        ('Three Phase', 'Three Phase'),
    ]
    STATUS_CHOICES = [
        ('Applied', 'Applied'),
        ('Testing', 'Testing'),
        ('Installed', 'Installed'),
        ('Rejected', 'Rejected'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='lc_net_meters')
    meter_type = models.CharField(max_length=30, choices=METER_TYPE_CHOICES, default='Bi-directional Meter')
    meter_number = models.CharField(max_length=100, blank=True)
    meter_make = models.CharField(max_length=100, blank=True)
    phase = models.CharField(max_length=20, choices=PHASE_CHOICES, blank=True)
    application_date = models.DateField(null=True, blank=True)
    installation_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Applied')
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='lc_net_meters_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'LC-NMT-{self.id:04d} — {self.project.project_name}'

    class Meta:
        ordering = ['-created_at']


# Order matters: "Mark Done" advances a project to the next entry.
LIAISON_STAGES = ['Documents', 'Application', 'Agreement', 'Inspection', 'Net Meter', 'Commissioning', 'Subsidy']
LIAISON_STAGE_COMPLETED = 'Completed'


class LiaisonProjectStage(models.Model):
    STAGE_CHOICES = [(s, s) for s in LIAISON_STAGES] + [(LIAISON_STAGE_COMPLETED, LIAISON_STAGE_COMPLETED)]

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='liaison_stage')
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default=LIAISON_STAGES[0])
    history = models.JSONField(default=list, blank=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='lc_stage_updates')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.project.project_name} — {self.stage}'
