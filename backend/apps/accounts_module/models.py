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


class Transaction(models.Model):
    TYPE_CHOICES = [
        ('Payment Received', 'Payment Received'),
        ('Payment Made', 'Payment Made'),
        ('Journal Entry', 'Journal Entry'),
    ]
    transaction_date = models.DateField()
    transaction_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    reference_number = models.CharField(max_length=100, blank=True)
    debit_account = models.ForeignKey(ChartOfAccount, on_delete=models.PROTECT, related_name='debit_transactions')
    credit_account = models.ForeignKey(ChartOfAccount, on_delete=models.PROTECT, related_name='credit_transactions')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-transaction_date', '-created_at']
        verbose_name_plural = 'Transactions'
        constraints = [
            models.CheckConstraint(
                check=models.Q(amount__gt=0),
                name='positive_amount'
            )
        ]
        constraints += [
            models.UniqueConstraint(
                fields=['transaction_date', 'reference_number'],
                name='unique_transaction_reference',
                condition=models.Q(reference_number__isnull=False)
            )
        ]