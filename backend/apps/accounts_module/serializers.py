from rest_framework import serializers
from .models import ChartOfAccount, Transaction


class ChartOfAccountSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.account_name', read_only=True)

    class Meta:
        model = ChartOfAccount
        fields = '__all__'


class TransactionSerializer(serializers.ModelSerializer):
    debit_account_name = serializers.CharField(source='debit_account.account_name', read_only=True)
    credit_account_name = serializers.CharField(source='credit_account.account_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['created_by']
