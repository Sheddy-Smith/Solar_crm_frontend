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
        ('Partner', 'Partner'),
    ]
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
        ('Pending', 'Pending'),
    ]

    name = models.CharField(max_length=200)
    account_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='Customer')
    contact_person = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='accounts_parties_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-created_at']


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
  invoice_no = models.CharField(max_length=100, blank=True)
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


class SellInvoice(_GstMixin):
  STATUS_CHOICES = [
      ('Pending', 'Pending'),
      ('Issued', 'Issued'),
      ('Paid', 'Paid'),
      ('Cancelled', 'Cancelled'),
  ]
  invoice_no = models.CharField(max_length=100, blank=True)
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
      ('Labour', 'Labour'),
      ('Customer', 'Customer'),
      ('Other', 'Other'),
  ]
  voucher_no = models.CharField(max_length=100, blank=True)
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
  challan_no = models.CharField(max_length=100, blank=True)
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
  challan_no = models.CharField(max_length=100, blank=True)
  challan_date = models.DateField()
  party = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='sell_challans')
  party_name = models.CharField(max_length=200, blank=True)
  project = models.ForeignKey(
      'projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='sell_challans',
  )
  vehicle_no = models.CharField(max_length=30, blank=True)
  site_address = models.CharField(max_length=300, blank=True)
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
  material_name = models.CharField(max_length=200)
  category = models.CharField(max_length=100, blank=True)
  quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
  unit = models.CharField(max_length=30, blank=True, default='Nos')
  rate = models.DecimalField(max_digits=14, decimal_places=2, default=0)
  line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
  sort_order = models.PositiveSmallIntegerField(default=0)

  class Meta:
      ordering = ['sort_order', 'id']


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
