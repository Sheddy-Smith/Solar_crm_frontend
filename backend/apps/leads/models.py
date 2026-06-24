import uuid
from django.db import models
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

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='quotations')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=12)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='quotations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def recalculate_totals(self):
        self.subtotal = sum(item.amount for item in self.items.all())
        self.gst_amount = self.subtotal * self.gst_percent / 100
        self.grand_total = self.subtotal + self.gst_amount - self.discount
        self.save(update_fields=['subtotal', 'gst_amount', 'grand_total'])

    def __str__(self):
        return f'Quotation #{self.pk} — {self.lead.customer_name}'

    class Meta:
        ordering = ['-created_at']


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='items')
    item_name = models.CharField(max_length=200)
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
