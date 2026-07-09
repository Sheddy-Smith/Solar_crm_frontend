from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.permissions import HasModulePermission
from .models import (
    PurchaseInvoice, SellInvoice, PaymentVoucher,
    PurchaseChallan, SellChallan, GstOpeningBalance,
)
from .document_serializers import (
    PurchaseInvoiceSerializer, SellInvoiceSerializer, PaymentVoucherSerializer,
    PurchaseChallanSerializer, SellChallanSerializer, GstOpeningBalanceSerializer,
)
from .document_services import gst_ledger_report, month_start
from .views import AccountsBaseViewSet


class PurchaseInvoiceViewSet(AccountsBaseViewSet):
    serializer_class = PurchaseInvoiceSerializer
    filterset_fields = ['status', 'supplier', 'project', 'gst_type']
    search_fields = ['invoice_no', 'supplier_name', 'category', 'remarks']
    ordering = ['-invoice_date', '-created_at']

    def get_queryset(self):
        return PurchaseInvoice.objects.select_related(
            'supplier', 'project', 'created_by',
        ).prefetch_related('lines', 'extra_charges').all()


class SellInvoiceViewSet(AccountsBaseViewSet):
    serializer_class = SellInvoiceSerializer
    filterset_fields = ['status', 'party', 'project', 'gst_type']
    search_fields = ['invoice_no', 'party_name', 'gst_number', 'branch', 'remarks']
    ordering = ['-invoice_date', '-created_at']

    def get_queryset(self):
        return SellInvoice.objects.select_related(
            'party', 'project', 'created_by',
        ).prefetch_related('lines').all()


class PaymentVoucherViewSet(AccountsBaseViewSet):
    serializer_class = PaymentVoucherSerializer
    filterset_fields = ['entry_type', 'payee_type', 'status', 'payment_mode', 'project']
    search_fields = ['voucher_no', 'payee_name', 'category', 'particulars']
    ordering = ['-voucher_date', '-created_at']

    def get_queryset(self):
        return PaymentVoucher.objects.select_related('project', 'created_by').all()


class PurchaseChallanViewSet(AccountsBaseViewSet):
    serializer_class = PurchaseChallanSerializer
    filterset_fields = ['status', 'supplier', 'project']
    search_fields = ['challan_no', 'supplier_name', 'vehicle_no', 'remarks']
    ordering = ['-challan_date', '-created_at']

    def get_queryset(self):
        return PurchaseChallan.objects.select_related(
            'supplier', 'project', 'created_by',
        ).prefetch_related('lines').all()


class SellChallanViewSet(AccountsBaseViewSet):
    serializer_class = SellChallanSerializer
    filterset_fields = ['status', 'party', 'project']
    search_fields = ['challan_no', 'party_name', 'vehicle_no', 'site_address', 'remarks']
    ordering = ['-challan_date', '-created_at']

    def get_queryset(self):
        return SellChallan.objects.select_related(
            'party', 'project', 'created_by',
        ).prefetch_related('lines').all()


class GstOpeningBalanceViewSet(viewsets.ModelViewSet):
    queryset = GstOpeningBalance.objects.all()
    serializer_class = GstOpeningBalanceSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Accounts'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    ordering = ['-month']

    @action(detail=False, methods=['get'], url_path='ledger')
    def ledger(self, request):
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        if not year or not month:
            return Response({'detail': 'year and month are required.'}, status=400)
        return Response(gst_ledger_report(year, month))

    @action(detail=False, methods=['post'], url_path='save-opening')
    def save_opening(self, request):
        year = request.data.get('year')
        month = request.data.get('month')
        if not year or not month:
            return Response({'detail': 'year and month are required.'}, status=400)
        month_date = month_start(year, month)
        obj, _ = GstOpeningBalance.objects.update_or_create(
            month=month_date,
            defaults={
                'igst_opening': request.data.get('igst_opening', 0),
                'cgst_opening': request.data.get('cgst_opening', 0),
                'sgst_opening': request.data.get('sgst_opening', 0),
                'notes': request.data.get('notes', ''),
            },
        )
        return Response(GstOpeningBalanceSerializer(obj).data)
