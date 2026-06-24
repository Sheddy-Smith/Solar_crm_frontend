from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, Q
from .models import ChartOfAccount, Transaction
from .serializers import ChartOfAccountSerializer, TransactionSerializer
from apps.accounts.permissions import HasModulePermission


class ChartOfAccountViewSet(viewsets.ModelViewSet):
    queryset = ChartOfAccount.objects.all()
    serializer_class = ChartOfAccountSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Accounts'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['account_type', 'is_active']
    search_fields = ['account_code', 'account_name']


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.select_related('debit_account', 'credit_account', 'created_by').all()
    serializer_class = TransactionSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Accounts'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['transaction_type']
    ordering = ['-transaction_date']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = self.get_queryset()
        received = qs.filter(transaction_type='Payment Received').aggregate(total=Sum('amount'))['total'] or 0
        made = qs.filter(transaction_type='Payment Made').aggregate(total=Sum('amount'))['total'] or 0
        return Response({
            'total_received': received,
            'total_made': made,
            'net_balance': received - made,
            'total_transactions': qs.count(),
        })
