from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.permissions import HasModulePermission
from .models import (
    PurchaseInvoice, SellInvoice, PaymentVoucher,
    PurchaseChallan, SellChallan, GstOpeningBalance, Transaction,
)
from .document_serializers import (
    PurchaseInvoiceSerializer, SellInvoiceSerializer, PaymentVoucherSerializer,
    PurchaseChallanSerializer, SellChallanSerializer, GstOpeningBalanceSerializer,
)
from .document_services import gst_ledger_report, month_start, sync_inventory_for_purchase_challan
from .services import recalculate_party_balance, sync_journal_for_invoice
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

    def perform_create(self, serializer):
        invoice = serializer.save(created_by=self.request.user)
        sync_journal_for_invoice(invoice, 'purchase')
        recalculate_party_balance(invoice.supplier_id)

    def perform_update(self, serializer):
        old_supplier_id = serializer.instance.supplier_id
        invoice = serializer.save()
        sync_journal_for_invoice(invoice, 'purchase')
        if old_supplier_id and old_supplier_id != invoice.supplier_id:
            recalculate_party_balance(old_supplier_id)
        recalculate_party_balance(invoice.supplier_id)

    def perform_destroy(self, instance):
        ref = instance.invoice_no or f'PI-{instance.id:04d}'
        Transaction.objects.filter(reference_number=ref, transaction_date=instance.invoice_date).delete()
        supplier_id = instance.supplier_id
        instance.delete()
        recalculate_party_balance(supplier_id)


class SellInvoiceViewSet(AccountsBaseViewSet):
    serializer_class = SellInvoiceSerializer
    filterset_fields = ['status', 'party', 'project', 'gst_type']
    search_fields = ['invoice_no', 'party_name', 'gst_number', 'branch', 'remarks']
    ordering = ['-invoice_date', '-created_at']

    def get_queryset(self):
        return SellInvoice.objects.select_related(
            'party', 'project', 'created_by',
        ).prefetch_related('lines').all()

    def perform_create(self, serializer):
        invoice = serializer.save(created_by=self.request.user)
        sync_journal_for_invoice(invoice, 'sell')
        recalculate_party_balance(invoice.party_id)

    def perform_update(self, serializer):
        old_party_id = serializer.instance.party_id
        invoice = serializer.save()
        sync_journal_for_invoice(invoice, 'sell')
        if old_party_id and old_party_id != invoice.party_id:
            recalculate_party_balance(old_party_id)
        recalculate_party_balance(invoice.party_id)

    def perform_destroy(self, instance):
        ref = instance.invoice_no or f'SI-{instance.id:04d}'
        Transaction.objects.filter(reference_number=ref, transaction_date=instance.invoice_date).delete()
        party_id = instance.party_id
        instance.delete()
        recalculate_party_balance(party_id)


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
        ).prefetch_related('lines', 'lines__inventory_item', 'lines__stock_movement').all()

    def perform_create(self, serializer):
        challan = serializer.save(created_by=self.request.user)
        sync_inventory_for_purchase_challan(challan, self.request.user)

    def perform_update(self, serializer):
        challan = serializer.save()
        sync_inventory_for_purchase_challan(challan, self.request.user)


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
