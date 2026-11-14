from django.db import models
from apps.accounts.models import User


class ChartOfAccount(models.Model):
    TYPE_CHOICES = [
        ('Asset', 'Asset'),
        ('Liability', 'Liability'),
        ('Income', 'Income'),
        ('Expense', 'Expense'),
        ('Equity', 'Equity'),
    ]
    account_code = models.CharField(max_length=20, unique=True)
    account_name = models.CharField(max_length=200)
    account_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.account_code} — {self.account_name}'

    class Meta:
        ordering = ['account_code']


class Account(models.Model):
    """Customer / Vendor / Partner ledger party."""
    TYPE_CHOICES = [
        ('Customer', 'Customer'),
        ('Vendor', 'Vendor'),
        ('Supplier', 'Supplier'),
        ('Partner', 'Partner'),
    ]
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
        ('Pending', 'Pending'),
        ('Merged', 'Merged'),
    ]
    RELATION_CHOICES = [
        ('Good', 'Good'),
        ('Ok', 'Ok'),
        ('Poor', 'Poor'),
        ('Bad', 'Bad'),
    ]

    name = models.CharField(max_length=200)
    account_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='Customer')
    contact_person = models.CharField(max_length=200, blank=True)
    company = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True, db_index=True)
    # Alternate mobile for family/business lines — never used as primary identity key.
    alternate_phone = models.CharField(max_length=20, blank=True, default='')
    # Canonical last-10 digits of primary phone for lookup / duplicate detection.
    normalized_phone = models.CharField(max_length=10, blank=True, default='', db_index=True)
    email = models.EmailField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True, default='')
    address = models.TextField(blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    vehicle_number = models.CharField(max_length=40, blank=True)
    credit_limit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    credit_days = models.PositiveSmallIntegerField(default=30)
    relation = models.CharField(max_length=10, choices=RELATION_CHOICES, blank=True)
    vendor_type = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    remarks = models.TextField(blank=True)
    # Soft merge trail — source Customer stays for audit; survivor is merged_into.
    merged_into = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='merged_sources',
    )
    merged_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='accounts_parties_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        from .services import normalize_phone
        self.normalized_phone = normalize_phone(self.phone) or ''
        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            fields = set(update_fields)
            if 'phone' in fields or 'normalized_phone' not in fields:
                fields.add('normalized_phone')
            kwargs['update_fields'] = list(fields)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['account_type', 'normalized_phone'], name='acct_type_norm_phone_idx'),
            models.Index(fields=['account_type', 'status'], name='acct_type_status_idx'),
        ]


class BankAccount(models.Model):
    TYPE_CHOICES = [
        ('Current Account', 'Current Account'),
        ('Savings Account', 'Savings Account'),
        ('OD Account', 'OD Account'),
        ('Cash Credit', 'Cash Credit'),
    ]
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    ]

    account_name = models.CharField(max_length=200)
    bank_name = models.CharField(max_length=200)
    account_number = models.CharField(max_length=50)
    ifsc = models.CharField(max_length=20, blank=True)
    account_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='Current Account')
    branch = models.CharField(max_length=200, blank=True)
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='bank_accounts_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.account_name} ({self.bank_name})'

    class Meta:
        ordering = ['-created_at']


class Payment(models.Model):
    DIRECTION_CHOICES = [
        ('Received', 'Received'),
        ('Made', 'Made'),
    ]
    MODE_CHOICES = [
        ('Cash', 'Cash'),
        ('Cheque', 'Cheque'),
        ('NEFT', 'NEFT'),
        ('RTGS', 'RTGS'),
        ('UPI', 'UPI'),
        ('IMPS', 'IMPS'),
        ('Transfer', 'Transfer'),
        ('Other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]

    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    reference_no = models.CharField(max_length=100, blank=True)
    payment_date = models.DateField()
    party = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    party_name = models.CharField(max_length=200, blank=True)
    project = models.ForeignKey(
        'projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='account_payments',
    )
    project_payment = models.OneToOneField(
        'projects.ProjectPayment', on_delete=models.SET_NULL, null=True, blank=True, related_name='accounts_payment',
    )
    bank_account = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    payment_mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='NEFT')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    project_ref = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    received_from = models.CharField(max_length=200, blank=True)
    particulars = models.TextField(blank=True)
    receipt_source = models.CharField(
        max_length=30,
        blank=True,
        choices=[
            ('Estimate', 'Estimate'),
            ('Invoice', 'Invoice'),
            ('Advance', 'Advance'),
            ('Project', 'Project'),
            ('Other', 'Other'),
        ],
    )
    related_staff = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='cash_receipts_handled',
    )
    advance_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    settled_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    due_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Completed')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='payments_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        prefix = 'RCPT' if self.direction == 'Received' else 'PMT'
        return f'{prefix}-{self.id:04d}'

    class Meta:
        ordering = ['-payment_date', '-created_at']


class Cheque(models.Model):
    TYPE_CHOICES = [
        ('Issued', 'Issued'),
        ('Received', 'Received'),
    ]
    STATUS_CHOICES = [
        ('Issued', 'Issued'),
        ('Pending', 'Pending'),
        ('Deposited', 'Deposited'),
        ('Cleared', 'Cleared'),
        ('Cancelled', 'Cancelled'),
    ]

    cheque_no = models.CharField(max_length=50)
    cheque_date = models.DateField()
    bank_account = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='cheques')
    payment = models.OneToOneField(
        Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='cheque_record',
    )
    payee_name = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    cheque_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='Issued')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Issued')
    cleared_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='cheques_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'CHQ-{self.cheque_no}'

    class Meta:
        ordering = ['-cheque_date', '-created_at']


class AccountCategoryMap(models.Model):
    """Maps business categories (Panel, Labour, Transport…) to Chart of Account ledgers.

    Used by Employee vouchers, manual expense vouchers, Material dispatch cost postings,
    and Material Planning difference reporting — never hard-code COA codes in sync.
    """
    MODULE_CHOICES = [
        ('Material', 'Material'),
        ('Labour', 'Labour'),
        ('Transport', 'Transport'),
        ('Subcontractor', 'Subcontractor'),
        ('ProjectExpense', 'Project Expense'),
        ('PlanningDifference', 'Material Planning Difference'),
        ('Revenue', 'Revenue'),
        ('Other', 'Other'),
    ]

    business_module = models.CharField(max_length=40, choices=MODULE_CHOICES)
    business_category = models.CharField(max_length=100)
    chart_account = models.ForeignKey(
        ChartOfAccount, on_delete=models.PROTECT, related_name='category_maps',
    )
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['business_module', 'business_category']
        unique_together = ('business_module', 'business_category')
        verbose_name = 'Category → COA Map'
        verbose_name_plural = 'Category → COA Maps'

    def __str__(self):
        return f'{self.business_module} / {self.business_category} → {self.chart_account.account_code}'


class Transaction(models.Model):
    TYPE_CHOICES = [
        ('Payment Received', 'Payment Received'),
        ('Payment Made', 'Payment Made'),
        ('Journal Entry', 'Journal Entry'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Completed', 'Completed'),
    ]
    MODE_CHOICES = Payment.MODE_CHOICES

    transaction_date = models.DateField()
    transaction_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    reference_number = models.CharField(max_length=100, blank=True)
    source_payment = models.OneToOneField(
        Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_entry',
    )
    source_payment_voucher = models.OneToOneField(
        'PaymentVoucher',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='journal_entry',
    )
    debit_account = models.ForeignKey(
        ChartOfAccount, on_delete=models.PROTECT, null=True, blank=True, related_name='debit_transactions',
    )
    credit_account = models.ForeignKey(
        ChartOfAccount, on_delete=models.PROTECT, null=True, blank=True, related_name='credit_transactions',
    )
    party = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    bank_account = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    payment_mode = models.CharField(max_length=20, choices=MODE_CHOICES, blank=True, default='')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Completed')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-transaction_date', '-created_at']
        verbose_name_plural = 'Transactions'
        constraints = [
            models.CheckConstraint(check=models.Q(amount__gt=0), name='positive_amount'),
            models.UniqueConstraint(
                fields=['transaction_date', 'reference_number'],
                name='unique_transaction_reference',
                condition=models.Q(reference_number__isnull=False) & ~models.Q(reference_number=''),
            ),
        ]


class _GstMixin(models.Model):
    GST_TYPE_CHOICES = [
        ('IGST', 'IGST'),
        ('CGST_SGST', 'CGST + SGST'),
    ]
    gst_type = models.CharField(max_length=12, choices=GST_TYPE_CHOICES, default='CGST_SGST')
    cgst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sgst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    igst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        abstract = True


class PurchaseInvoice(_GstMixin):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Recorded', 'Recorded'),
        ('Paid', 'Paid'),
        ('Cancelled', 'Cancelled'),
    ]
    invoice_no = models.CharField(max_length=100, blank=True, unique=True)
    invoice_date = models.DateField()
    supplier = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_invoices')
    supplier_name = models.CharField(max_length=200, blank=True)
    category = models.CharField(max_length=100, blank=True)
    project = models.ForeignKey(
        'projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_invoices',
    )
    payment_mode = models.CharField(max_length=20, choices=Payment.MODE_CHOICES, default='NEFT')
    payment_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    extra_charges_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Recorded')
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='purchase_invoices_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.invoice_no or f'PI-{self.id:04d}'

    class Meta:
        ordering = ['-invoice_date', '-created_at']


class PurchaseInvoiceLine(models.Model):
    invoice = models.ForeignKey(PurchaseInvoice, on_delete=models.CASCADE, related_name='lines')
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_invoice_lines',
    )
    stock_movement = models.OneToOneField(
        'inventory.StockMovement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_invoice_line',
    )
    material_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit = models.CharField(max_length=30, blank=True, default='Nos')
    rate = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']


class PurchaseInvoiceExtraCharge(models.Model):
    invoice = models.ForeignKey(PurchaseInvoice, on_delete=models.CASCADE, related_name='extra_charges')
    description = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']


DOCUMENT_SOURCE_CHOICES = [
    ('Accounts', 'Accounts'),
    ('Project', 'Project'),
]


class SellInvoice(_GstMixin):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Issued', 'Issued'),
        ('Paid', 'Paid'),
        ('Cancelled', 'Cancelled'),
    ]
    invoice_no = models.CharField(max_length=100, blank=True, unique=True)
    # Project documents never move stock — project material already leaves
    # inventory through Material Dispatch.
    source = models.CharField(max_length=20, choices=DOCUMENT_SOURCE_CHOICES, default='Accounts')
    invoice_date = models.DateField()
    party = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='sell_invoices')
    party_name = models.CharField(max_length=200, blank=True)
    gst_number = models.CharField(max_length=20, blank=True)
    branch = models.CharField(max_length=100, blank=True)
    project = models.ForeignKey(
        'projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='sell_invoices',
    )
    payment_mode = models.CharField(max_length=20, choices=Payment.MODE_CHOICES, blank=True, default='')
    payment_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sell_invoices_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.invoice_no or f'SI-{self.id:04d}'

    class Meta:
        ordering = ['-invoice_date', '-created_at']


class SellInvoiceLine(models.Model):
    invoice = models.ForeignKey(SellInvoice, on_delete=models.CASCADE, related_name='lines')
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sell_invoice_lines',
    )
    stock_movement = models.OneToOneField(
        'inventory.StockMovement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sell_invoice_line',
    )
    material_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit = models.CharField(max_length=30, blank=True, default='Nos')
    rate = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']


class PaymentVoucher(models.Model):
    ENTRY_TYPE_CHOICES = [
        ('Voucher', 'Voucher'),
        ('Expense', 'Expense'),
    ]
    PAYEE_TYPE_CHOICES = [
        ('Supplier', 'Supplier'),
        ('Vendor', 'Vendor'),
        ('Labour', 'Labour'),
        ('Customer', 'Customer'),
        ('Other', 'Other'),
    ]
    voucher_no = models.CharField(max_length=100, blank=True, unique=True)
    voucher_date = models.DateField()
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPE_CHOICES, default='Voucher')
    payee_type = models.CharField(max_length=20, choices=PAYEE_TYPE_CHOICES, default='Other')
    payee_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    particulars = models.TextField(blank=True)
    payment_mode = models.CharField(max_length=20, choices=Payment.MODE_CHOICES, default='Cash')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    project = models.ForeignKey(
        'projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='payment_vouchers',
    )
    status = models.CharField(max_length=20, choices=Payment.STATUS_CHOICES, default='Completed')
    # Worker picked for a Labour voucher; completed ones are mirrored to workforce.EmployeeVoucher
    # so the payment shows in that employee's ledger.
    employee = models.ForeignKey(
        'workforce.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accounts_vouchers',
    )
    employee_voucher = models.OneToOneField(
        'workforce.EmployeeVoucher',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='accounts_payment_voucher',
    )
    material_plan = models.OneToOneField(
        'projects.MaterialPlan',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='cost_voucher',
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='payment_vouchers_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.voucher_no or f'VCH-{self.id:04d}'

    class Meta:
        ordering = ['-voucher_date', '-created_at']


class PurchaseChallan(models.Model):
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('Received', 'Received'),
        ('Cancelled', 'Cancelled'),
    ]
    challan_no = models.CharField(max_length=100, blank=True, unique=True)
    challan_date = models.DateField()
    supplier = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_challans')
    supplier_name = models.CharField(max_length=200, blank=True)
    project = models.ForeignKey(
        'projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_challans',
    )
    vehicle_no = models.CharField(max_length=30, blank=True)
    payment_mode = models.CharField(max_length=20, choices=Payment.MODE_CHOICES, blank=True, default='')
    payment_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Open')
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='purchase_challans_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.challan_no or f'PC-{self.id:04d}'

    class Meta:
        ordering = ['-challan_date', '-created_at']


class PurchaseChallanLine(models.Model):
    challan = models.ForeignKey(PurchaseChallan, on_delete=models.CASCADE, related_name='lines')
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_challan_lines',
    )
    stock_movement = models.OneToOneField(
        'inventory.StockMovement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_challan_line',
    )
    material_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit = models.CharField(max_length=30, blank=True, default='Nos')
    rate = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']


class SellChallan(models.Model):
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('Dispatched', 'Dispatched'),
        ('Delivered', 'Delivered'),
        ('Cancelled', 'Cancelled'),
    ]
    challan_no = models.CharField(max_length=100, blank=True, unique=True)
    source = models.CharField(max_length=20, choices=DOCUMENT_SOURCE_CHOICES, default='Accounts')
    challan_date = models.DateField()
    party = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='sell_challans')
    party_name = models.CharField(max_length=200, blank=True)
    project = models.ForeignKey(
        'projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='sell_challans',
    )
    GST_MODE_CHOICES = [
        ('None', 'No GST'),
        ('Split', 'Solar Split (70% @5% + 30% @18%)'),
        ('Flat', 'Flat %'),
    ]
    vehicle_no = models.CharField(max_length=30, blank=True)
    site_address = models.CharField(max_length=300, blank=True)
    quotation_no = models.CharField(max_length=50, blank=True)
    gst_mode = models.CharField(max_length=10, choices=GST_MODE_CHOICES, default='None')
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    round_off = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Open')
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sell_challans_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.challan_no or f'SC-{self.id:04d}'

    class Meta:
        ordering = ['-challan_date', '-created_at']


class SellChallanLine(models.Model):
    challan = models.ForeignKey(SellChallan, on_delete=models.CASCADE, related_name='lines')
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sell_challan_lines',
    )
    stock_movement = models.OneToOneField(
        'inventory.StockMovement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sell_challan_line',
    )
    SECTION_CHOICES = [
        ('Main', 'Main'),
        ('Additional', 'Additional Work'),
    ]
    section = models.CharField(max_length=12, choices=SECTION_CHOICES, default='Main')
    material_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    brand = models.CharField(max_length=100, blank=True)
    specification = models.CharField(max_length=300, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit = models.CharField(max_length=30, blank=True, default='Nos')
    rate = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']


class CustomerLedgerManualEntry(models.Model):
    """Manual Customer Ledger rows from the Add New Ledger modal (sale / payment / discount)."""
    TYPE_CHOICES = [
        ('sale', 'Sale'),
        ('payment', 'Payment Received'),
        ('discount', 'Discount'),
    ]
    # Payment channel — separate from entry_type (debit/credit accounting classification).
    # Shown as mandatory only when entry_type is Payment Received.
    PAYMENT_MODE_CHOICES = [
        ('UPI', 'UPI'),
        ('PhonePe', 'PhonePe'),
        ('Google Pay', 'Google Pay'),
        ('Cash', 'Cash'),
        ('Online Transfer', 'Online Transfer'),
        ('NEFT', 'NEFT'),
        ('RTGS', 'RTGS'),
        ('Cheque', 'Cheque'),
        ('Other', 'Other'),
    ]
    # Older Client Ledger values kept valid so existing rows still load/save.
    LEGACY_PAYMENT_MODE_CHOICES = [
        ('Bank Transfer / NEFT / RTGS / IMPS', 'Bank Transfer / NEFT / RTGS / IMPS'),
        ('Loan / Finance', 'Loan / Finance'),
        ('Credit Card', 'Credit Card'),
        ('Debit Card', 'Debit Card'),
        ('IMPS', 'IMPS'),
        ('Transfer', 'Transfer'),
    ]

    party = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='manual_ledger_entries')
    # Optional project link — when set, ledger table shows Project Name / Project ID.
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manual_ledger_entries',
    )
    entry_date = models.DateField()
    entry_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='sale')
    payment_mode = models.CharField(max_length=60, blank=True, default='')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    vehicle_no = models.CharField(max_length=40, blank=True)
    reference_no = models.CharField(max_length=100, blank=True)
    work = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='manual_ledger_entries_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.get_entry_type_display()} {self.amount} — {self.party_id}'

    class Meta:
        ordering = ['-entry_date', '-created_at']
        verbose_name = 'Customer ledger manual entry'
        verbose_name_plural = 'Customer ledger manual entries'


class VendorLedgerManualEntry(models.Model):
    """Manual Vendor Ledger rows (work credit / payment debit) from Add Manual Entry.

    Vehicle fields are legacy (solar install workflow no longer uses them).
    Prefer project / installation_assignment linkage for install work.
    """

    party = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='vendor_manual_ledger_entries')
    entry_date = models.DateField()
    # Legacy transport fields — kept for historical rows; UI no longer collects them.
    vehicle_no = models.CharField(max_length=40, blank=True)
    wheeler = models.CharField(max_length=40, blank=True)
    owner_name = models.CharField(max_length=200, blank=True)
    work = models.TextField(blank=True)
    debit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    project = models.ForeignKey(
        'projects.Project', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='vendor_manual_ledger_entries',
    )
    installation_assignment = models.ForeignKey(
        'accounts_module.VendorInstallationAssignment', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='ledger_entries',
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='vendor_manual_ledger_entries_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Vendor manual {self.entry_date} — {self.party_id}'

    class Meta:
        ordering = ['-entry_date', '-created_at']
        verbose_name = 'Vendor ledger manual entry'
        verbose_name_plural = 'Vendor ledger manual entries'


class VendorInstallStageTemplate(models.Model):
    """Editable Super-Admin stage weights for new installation assignments (must total 100%)."""

    name = models.CharField(max_length=120)
    percentage = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.name} ({self.percentage}%)'


class VendorInstallationAssignment(models.Model):
    """Project-wise solar installation work assigned to a Vendor (rate snapshot frozen)."""

    RATE_PER_KW = 'per_kw'
    RATE_PER_WATT = 'per_watt'
    RATE_UNIT_CHOICES = [
        (RATE_PER_KW, '₹/kW'),
        (RATE_PER_WATT, '₹/Watt'),
    ]
    STATUS_ASSIGNED = 'Assigned'
    STATUS_NOT_STARTED = 'Not Started'
    STATUS_IN_PROGRESS = 'In Progress'
    STATUS_PARTIAL = 'Partially Completed'
    STATUS_COMPLETED = 'Completed'
    STATUS_ON_HOLD = 'On Hold'
    STATUS_CANCELLED = 'Cancelled'
    STATUS_CHOICES = [
        (STATUS_ASSIGNED, 'Assigned'),
        (STATUS_NOT_STARTED, 'Not Started'),
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_PARTIAL, 'Partially Completed'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_ON_HOLD, 'On Hold'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    project = models.ForeignKey(
        'projects.Project', on_delete=models.CASCADE, related_name='vendor_install_assignments',
    )
    vendor = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name='installation_assignments',
        limit_choices_to={'account_type': 'Vendor'},
    )
    capacity_kw = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    capacity_watt = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rate = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    rate_unit = models.CharField(max_length=16, choices=RATE_UNIT_CHOICES, default=RATE_PER_WATT)
    contract_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    work_description = models.TextField(blank=True)
    start_date = models.DateField(null=True, blank=True)
    expected_completion_date = models.DateField(null=True, blank=True)
    advance_payment = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    payment_terms = models.CharField(max_length=255, blank=True)
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_ASSIGNED, db_index=True)
    approved_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    earned_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    daily_task = models.ForeignKey(
        'daily_tasks.DailyTask', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='vendor_install_assignments',
    )
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='vendor_install_assignments_created',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_cancelled = models.BooleanField(default=False)

    class Meta:
        ordering = ['-assigned_at']
        indexes = [
            models.Index(fields=['vendor', 'is_cancelled'], name='vend_inst_vendor_active_idx'),
            models.Index(fields=['project', 'is_cancelled'], name='vend_inst_project_active_idx'),
        ]

    def __str__(self):
        return f'Install {self.project_id} → vendor {self.vendor_id}'

    @property
    def remaining_earned_payable(self):
        from decimal import Decimal
        return max(Decimal(self.earned_amount or 0) - Decimal(self.total_paid or 0), Decimal('0'))

    @property
    def pending_work_amount(self):
        from decimal import Decimal
        return max(Decimal(self.contract_amount or 0) - Decimal(self.earned_amount or 0), Decimal('0'))


class VendorInstallationStage(models.Model):
    """Frozen stage snapshot on an assignment (historical % preserved)."""

    STATUS_NOT_STARTED = 'Not Started'
    STATUS_IN_PROGRESS = 'In Progress'
    STATUS_SUBMITTED = 'Submitted for Approval'
    STATUS_APPROVED = 'Approved'
    STATUS_ON_HOLD = 'On Hold'
    STATUS_CHOICES = [
        (STATUS_NOT_STARTED, 'Not Started'),
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_SUBMITTED, 'Submitted for Approval'),
        (STATUS_APPROVED, 'Approved / Completed'),
        (STATUS_ON_HOLD, 'On Hold'),
    ]

    assignment = models.ForeignKey(
        VendorInstallationAssignment, on_delete=models.CASCADE, related_name='stages',
    )
    stage_name = models.CharField(max_length=120)
    allocated_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    sort_order = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_NOT_STARTED)
    start_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    work_remarks = models.TextField(blank=True)
    proof_url = models.CharField(max_length=500, blank=True)
    submitted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='vendor_stages_submitted',
    )
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='vendor_stages_approved',
    )
    approval_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.stage_name} ({self.allocated_percent}%)'


class VendorInstallationPayment(models.Model):
    """Individual vendor payment against an installation assignment (never overwrites history)."""

    assignment = models.ForeignKey(
        VendorInstallationAssignment, on_delete=models.CASCADE, related_name='payments',
    )
    vendor = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='installation_payments')
    project = models.ForeignKey(
        'projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='vendor_install_payments',
    )
    payment_date = models.DateField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_mode = models.CharField(max_length=20, blank=True, default='Cash')
    reference_no = models.CharField(max_length=100, blank=True)
    remarks = models.TextField(blank=True)
    proof_url = models.CharField(max_length=500, blank=True)
    is_advance = models.BooleanField(default=False)
    accounts_payment = models.ForeignKey(
        'accounts_module.Payment', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='vendor_install_payments',
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='vendor_install_payments_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date', '-id']

    def __str__(self):
        return f'Pay {self.amount} → assignment {self.assignment_id}'


class GstOpeningBalance(models.Model):
    month = models.DateField(unique=True)
    igst_opening = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cgst_opening = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sgst_opening = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-month']


class PaymentAllocation(models.Model):
    """Explicit allocation of an unallocated (project=null) customer payment to a Project.

    Prevents silent assignment and keeps a reversible audit of advance distribution.
    """
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name='allocations')
    project = models.ForeignKey(
        'projects.Project', on_delete=models.PROTECT, related_name='payment_allocations',
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='payment_allocations_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['payment', 'project'], name='pay_alloc_payment_project_idx'),
        ]

    def __str__(self):
        return f'Alloc {self.amount} → project {self.project_id} (payment {self.payment_id})'


class CustomerMergeAudit(models.Model):
    """Immutable record of an authorized Customer (Account) merge."""
    source = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name='merge_audits_as_source',
    )
    target = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name='merge_audits_as_target',
    )
    merged_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='customer_merges_performed',
    )
    confirmation_token = models.CharField(max_length=64, blank=True, default='')
    affected_counts = models.JSONField(default=dict, blank=True)
    financial_snapshot = models.JSONField(default=dict, blank=True)
    reassignment_details = models.JSONField(default=dict, blank=True)
    result = models.CharField(max_length=40, default='completed')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Merge {self.source_id} → {self.target_id} ({self.created_at})'


class ProjectCustomerLinkAudit(models.Model):
    """Audit trail for orphan Project → Customer reconciliation actions."""
    ACTION_CHOICES = [
        ('link_existing', 'Link existing Customer'),
        ('create_and_link', 'Create Customer and link'),
        ('skip_review', 'Skipped for manual review'),
        ('reassign', 'Reassigned Customer'),
    ]
    project = models.ForeignKey(
        'projects.Project', on_delete=models.CASCADE, related_name='customer_link_audits',
    )
    customer = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='project_link_audits',
    )
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    match_reason = models.CharField(max_length=200, blank=True, default='')
    evidence = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='project_customer_links',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} project={self.project_id} customer={self.customer_id}'
