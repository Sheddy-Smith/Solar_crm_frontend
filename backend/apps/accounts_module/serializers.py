from rest_framework import serializers
from .models import ChartOfAccount, Account, BankAccount, Payment, Cheque, Transaction


def _user_name(user):
    if not user:
        return ''
    return user.name or user.email


def _default_accounts():
    """Return default chart-of-account rows, creating them if missing."""
    defaults = [
        ('1110', 'Cash in Hand', 'Asset'),
        ('1120', 'Cash at Bank', 'Asset'),
        ('1130', 'Accounts Receivable', 'Asset'),
        ('2110', 'Accounts Payable', 'Liability'),
        ('4100', 'Sales Revenue', 'Income'),
        ('5100', 'General Expenses', 'Expense'),
    ]
    accounts = {}
    for code, name, acct_type in defaults:
        obj, _ = ChartOfAccount.objects.get_or_create(
            account_code=code,
            defaults={'account_name': name, 'account_type': acct_type, 'is_active': True},
        )
        accounts[code] = obj
    return accounts


class ChartOfAccountSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent.account_name', read_only=True)
    status = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return obj.account_code

    def get_status(self, obj):
        return 'Active' if obj.is_active else 'Inactive'

    class Meta:
        model = ChartOfAccount
        fields = [
            'id', 'record_no', 'account_code', 'account_name', 'account_type',
            'parent', 'parent_name', 'opening_balance', 'is_active', 'status', 'created_at',
        ]


class AccountSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'ACC-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = Account
        fields = [
            'id', 'record_no', 'name', 'account_type', 'contact_person', 'phone', 'email',
            'city', 'status', 'opening_balance', 'balance', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['balance', 'created_by', 'created_at', 'updated_at']


class BankAccountSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'BNK-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = BankAccount
        fields = [
            'id', 'record_no', 'account_name', 'bank_name', 'account_number', 'ifsc',
            'account_type', 'branch', 'opening_balance', 'balance', 'status', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['balance', 'created_by', 'created_at', 'updated_at']


class PaymentSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    party_display = serializers.SerializerMethodField()
    bank_account_name = serializers.CharField(source='bank_account.account_name', read_only=True)
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        prefix = 'RCPT' if obj.direction == 'Received' else 'PMT'
        return obj.reference_no or f'{prefix}-{obj.id:04d}'

    def get_party_display(self, obj):
        if obj.party_id:
            return obj.party.name
        return obj.party_name or '—'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = Payment
        fields = [
            'id', 'record_no', 'direction', 'reference_no', 'payment_date',
            'party', 'party_name', 'party_display', 'project', 'project_name', 'project_ref',
            'bank_account', 'bank_account_name',
            'payment_mode', 'amount', 'description', 'status',
            'received_from', 'particulars', 'receipt_source', 'related_staff',
            'advance_amount', 'settled_amount', 'due_amount',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'project_payment']


class ChequeSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    bank_account_name = serializers.CharField(source='bank_account.account_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'CHQ-{obj.cheque_no}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = Cheque
        fields = [
            'id', 'record_no', 'cheque_no', 'cheque_date', 'bank_account', 'bank_account_name',
            'payee_name', 'amount', 'cheque_type', 'status', 'cleared_date', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'payment']


class TransactionSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    debit_account_name = serializers.CharField(source='debit_account.account_name', read_only=True)
    credit_account_name = serializers.CharField(source='credit_account.account_name', read_only=True)
    party_name = serializers.CharField(source='party.name', read_only=True)
    bank_account_name = serializers.CharField(source='bank_account.account_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return obj.reference_number or f'TRX-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def create(self, validated_data):
        defaults = _default_accounts()
        txn_type = validated_data.get('transaction_type')
        if not validated_data.get('debit_account'):
            if txn_type == 'Payment Received':
                validated_data['debit_account'] = defaults['1120']
            elif txn_type == 'Payment Made':
                validated_data['debit_account'] = defaults['5100']
            else:
                validated_data['debit_account'] = defaults['1110']
        if not validated_data.get('credit_account'):
            if txn_type == 'Payment Received':
                validated_data['credit_account'] = defaults['4100']
            elif txn_type == 'Payment Made':
                validated_data['credit_account'] = defaults['1120']
            else:
                validated_data['credit_account'] = defaults['2110']
        return super().create(validated_data)

    class Meta:
        model = Transaction
        fields = [
            'id', 'record_no', 'transaction_date', 'transaction_type', 'reference_number',
            'debit_account', 'debit_account_name', 'credit_account', 'credit_account_name',
            'party', 'party_name', 'bank_account', 'bank_account_name',
            'payment_mode', 'amount', 'description', 'status',
            'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'source_payment']
