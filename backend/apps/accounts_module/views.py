from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import ChartOfAccount, Account, BankAccount, Payment, Cheque, Transaction
from .serializers import (
    ChartOfAccountSerializer, AccountSerializer, BankAccountSerializer,
    PaymentSerializer, ChequeSerializer, TransactionSerializer,
)
from .services import after_payment_saved, before_payment_delete, after_payment_deleted, accounts_dashboard_summary
from apps.accounts.permissions import HasModulePermission


class AccountsBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Accounts'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ChartOfAccountViewSet(viewsets.ModelViewSet):
    queryset = ChartOfAccount.objects.select_related('parent').all()
    serializer_class = ChartOfAccountSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Accounts'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['account_type', 'is_active']
    search_fields = ['account_code', 'account_name']


class AccountViewSet(AccountsBaseViewSet):
    serializer_class = AccountSerializer
    filterset_fields = ['account_type', 'status']
    search_fields = ['name', 'contact_person', 'phone', 'email', 'city']

    def get_queryset(self):
        return Account.objects.select_related('created_by').all()

    def perform_create(self, serializer):
        opening = serializer.validated_data.get('opening_balance', 0)
        serializer.save(created_by=self.request.user, balance=opening)


class BankAccountViewSet(AccountsBaseViewSet):
    serializer_class = BankAccountSerializer
    filterset_fields = ['status', 'account_type']
    search_fields = ['account_name', 'bank_name', 'account_number', 'ifsc', 'branch']

    def get_queryset(self):
        return BankAccount.objects.select_related('created_by').all()

    def perform_create(self, serializer):
        opening = serializer.validated_data.get('opening_balance', 0)
        serializer.save(created_by=self.request.user, balance=opening)


class PaymentViewSet(AccountsBaseViewSet):
    serializer_class = PaymentSerializer
    filterset_fields = ['direction', 'status', 'payment_mode', 'project']
    search_fields = ['reference_no', 'party_name', 'project_ref', 'description']
    ordering = ['-payment_date', '-created_at']

    def get_queryset(self):
        return Payment.objects.select_related(
            'party', 'bank_account', 'project', 'created_by',
        ).all()

    def perform_create(self, serializer):
        payment = serializer.save(created_by=self.request.user)
        after_payment_saved(payment)

    def perform_update(self, serializer):
        old_party = serializer.instance.party_id
        old_bank = serializer.instance.bank_account_id
        payment = serializer.save()
        after_payment_saved(payment, old_party_id=old_party, old_bank_id=old_bank)

    def perform_destroy(self, instance):
        party_id = instance.party_id
        bank_id = instance.bank_account_id
        before_payment_delete(instance)
        instance.delete()
        after_payment_deleted(party_id, bank_id)


class ChequeViewSet(AccountsBaseViewSet):
    serializer_class = ChequeSerializer
    filterset_fields = ['status', 'cheque_type']
    search_fields = ['cheque_no', 'payee_name']
    ordering = ['-cheque_date', '-created_at']

    def get_queryset(self):
        return Cheque.objects.select_related('bank_account', 'created_by').all()

    def perform_update(self, serializer):
        cheque = serializer.save()
        if cheque.payment_id and cheque.status == 'Cleared':
            payment = cheque.payment
            if payment and payment.status != 'Completed':
                payment.status = 'Completed'
                payment.save(update_fields=['status'])
                after_payment_saved(payment)


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.select_related(
        'debit_account', 'credit_account', 'party', 'bank_account', 'created_by', 'source_payment',
    ).all()
    serializer_class = TransactionSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Accounts'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['transaction_type', 'status']
    search_fields = ['reference_number', 'description']
    ordering = ['-transaction_date', '-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.source_payment_id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Auto journal entries cannot be deleted. Delete the payment instead.')
        instance.delete()

    @action(detail=False, methods=['get'])
    def summary(self, request):
        return Response(accounts_dashboard_summary())

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        return Response(accounts_dashboard_summary())
