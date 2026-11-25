from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.permissions import HasModulePermission
from .models import (
    PurchaseInvoice, SellInvoice, PaymentVoucher,
    PurchaseChallan, SellChallan, GstOpeningBalance, Transaction,
)
from .services import apply_accounts_project_lead_scope
from .document_serializers import (
    PurchaseInvoiceSerializer, SellInvoiceSerializer, PaymentVoucherSerializer,
    PurchaseChallanSerializer, SellChallanSerializer, GstOpeningBalanceSerializer,
)
from .document_services import (
    gst_ledger_report, month_start,
    sync_inventory_for_purchase_challan, sync_inventory_for_sell_challan,
    sync_inventory_for_purchase_invoice, sync_inventory_for_sell_invoice,
    remove_purchase_challan_stock, remove_sell_challan_stock,
    remove_purchase_invoice_stock, remove_sell_invoice_stock,
)
from .services import recalculate_party_balance, sync_journal_for_invoice
from .views import AccountsBaseViewSet


def _raise_drf(exc: DjangoValidationError):
    if hasattr(exc, 'message_dict'):
        raise ValidationError(exc.message_dict)
    if hasattr(exc, 'messages'):
        raise ValidationError(exc.messages)
    raise ValidationError(str(exc))


class PurchaseInvoiceViewSet(AccountsBaseViewSet):
    serializer_class = PurchaseInvoiceSerializer
    filterset_fields = ['status', 'supplier', 'project', 'gst_type']
    search_fields = ['invoice_no', 'supplier_name', 'category', 'remarks']
    ordering = ['-invoice_date', '-created_at']

    def get_queryset(self):
        qs = PurchaseInvoice.objects.select_related(
            'supplier', 'project', 'created_by',
        ).prefetch_related('lines', 'lines__inventory_item', 'lines__stock_movement', 'extra_charges').all()
        return apply_accounts_project_lead_scope(qs, self.request.user)

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                invoice = serializer.save(created_by=self.request.user)
                sync_inventory_for_purchase_invoice(invoice, self.request.user)
                sync_journal_for_invoice(invoice, 'purchase')
                recalculate_party_balance(invoice.supplier_id)
        except DjangoValidationError as exc:
            _raise_drf(exc)

    def perform_update(self, serializer):
        old_supplier_id = serializer.instance.supplier_id
        try:
            with transaction.atomic():
                invoice = serializer.save()
                sync_inventory_for_purchase_invoice(invoice, self.request.user)
                sync_journal_for_invoice(invoice, 'purchase')
                if old_supplier_id and old_supplier_id != invoice.supplier_id:
                    recalculate_party_balance(old_supplier_id)
                recalculate_party_balance(invoice.supplier_id)
        except DjangoValidationError as exc:
            _raise_drf(exc)

    def perform_destroy(self, instance):
        ref = instance.invoice_no or f'PI-{instance.id:04d}'
        supplier_id = instance.supplier_id
        with transaction.atomic():
            remove_purchase_invoice_stock(instance)
            Transaction.objects.filter(reference_number=ref, transaction_date=instance.invoice_date).delete()
            instance.delete()
        recalculate_party_balance(supplier_id)


class SellInvoiceViewSet(AccountsBaseViewSet):
    serializer_class = SellInvoiceSerializer
    filterset_fields = ['status', 'party', 'project', 'gst_type']
    search_fields = ['invoice_no', 'party_name', 'gst_number', 'branch', 'remarks']
    ordering = ['-invoice_date', '-created_at']

    def get_queryset(self):
        qs = SellInvoice.objects.select_related(
            'party', 'project', 'created_by',
        ).prefetch_related('lines', 'lines__inventory_item', 'lines__stock_movement').all()
        return apply_accounts_project_lead_scope(qs, self.request.user)

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                invoice = serializer.save(created_by=self.request.user)
                sync_inventory_for_sell_invoice(invoice, self.request.user)
                sync_journal_for_invoice(invoice, 'sell')
                recalculate_party_balance(invoice.party_id)
        except DjangoValidationError as exc:
            _raise_drf(exc)

    def perform_update(self, serializer):
        old_party_id = serializer.instance.party_id
        try:
            with transaction.atomic():
                invoice = serializer.save()
                from .invoice_payment_allocation import invoice_has_active_allocations, refresh_invoice_settlement
                if invoice_has_active_allocations(invoice):
                    invoice = refresh_invoice_settlement(invoice, sync_status=True)
                sync_inventory_for_sell_invoice(invoice, self.request.user)
                sync_journal_for_invoice(invoice, 'sell')
                if old_party_id and old_party_id != invoice.party_id:
                    recalculate_party_balance(old_party_id)
                recalculate_party_balance(invoice.party_id)
        except DjangoValidationError as exc:
            _raise_drf(exc)

    def perform_destroy(self, instance):
        from .invoice_payment_allocation import active_allocations_qs
        if active_allocations_qs(invoice_id=instance.id).exists():
            raise ValidationError(
                'Cannot delete Sell Invoice with active payment allocations. Reverse allocations first.'
            )
        ref = instance.invoice_no or f'SI-{instance.id:04d}'
        party_id = instance.party_id
        with transaction.atomic():
            remove_sell_invoice_stock(instance)
            Transaction.objects.filter(reference_number=ref, transaction_date=instance.invoice_date).delete()
            instance.delete()
        recalculate_party_balance(party_id)

    @action(detail=True, methods=['get'], url_path='payment-summary')
    def payment_summary(self, request, pk=None):
        from .invoice_payment_allocation import invoice_settlement_summary
        invoice = self.get_object()
        return Response(invoice_settlement_summary(invoice))


class PaymentVoucherViewSet(AccountsBaseViewSet):
    serializer_class = PaymentVoucherSerializer
    filterset_fields = ['entry_type', 'payee_type', 'status', 'payment_mode', 'project', 'category']
    search_fields = ['voucher_no', 'payee_name', 'category', 'particulars']
    ordering = ['-voucher_date', '-created_at']

    SOURCE_FILTERS = {
        'material_dispatch': {'material_plan__isnull': False},
        'workforce': {'employee_voucher__isnull': False},
        'manual': {'material_plan__isnull': True, 'employee_voucher__isnull': True},
    }

    def get_queryset(self):
        qs = PaymentVoucher.objects.select_related(
            'project', 'created_by', 'employee', 'employee_voucher', 'material_plan',
        ).all()
        qs = apply_accounts_project_lead_scope(qs, self.request.user)
        params = self.request.query_params
        source = self.SOURCE_FILTERS.get(params.get('source', ''))
        if source:
            qs = qs.filter(**source)
        for key in filter(None, params.get('exclude_source', '').split(',')):
            if key in self.SOURCE_FILTERS:
                qs = qs.exclude(**self.SOURCE_FILTERS[key])
        return qs

    @staticmethod
    def _reject_if_auto_synced(voucher, verb):
        # These vouchers are re-written from their source record on every save,
        # so changes made here would be silently overwritten or orphan the source.
        from rest_framework.exceptions import PermissionDenied
        if voucher.material_plan_id:
            raise PermissionDenied(f'This cost comes from Material Dispatch. {verb} it from the project material plan.')

    def perform_update(self, serializer):
        self._reject_if_auto_synced(serializer.instance, 'Edit')
        serializer.save()

    def perform_destroy(self, instance):
        self._reject_if_auto_synced(instance, 'Delete')
        from apps.accounts_module.services import delete_payment_voucher_with_employee_voucher
        delete_payment_voucher_with_employee_voucher(instance)


class PurchaseChallanViewSet(AccountsBaseViewSet):
    serializer_class = PurchaseChallanSerializer
    filterset_fields = ['status', 'supplier', 'project']
    search_fields = ['challan_no', 'supplier_name', 'vehicle_no', 'remarks']
    ordering = ['-challan_date', '-created_at']

    def get_queryset(self):
        qs = PurchaseChallan.objects.select_related(
            'supplier', 'project', 'created_by',
        ).prefetch_related('lines', 'lines__inventory_item', 'lines__stock_movement').all()
        return apply_accounts_project_lead_scope(qs, self.request.user)

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                challan = serializer.save(created_by=self.request.user)
                sync_inventory_for_purchase_challan(challan, self.request.user)
                recalculate_party_balance(challan.supplier_id)
        except DjangoValidationError as exc:
            _raise_drf(exc)

    def perform_update(self, serializer):
        old_supplier_id = serializer.instance.supplier_id
        try:
            with transaction.atomic():
                challan = serializer.save()
                sync_inventory_for_purchase_challan(challan, self.request.user)
                if old_supplier_id and old_supplier_id != challan.supplier_id:
                    recalculate_party_balance(old_supplier_id)
                recalculate_party_balance(challan.supplier_id)
        except DjangoValidationError as exc:
            _raise_drf(exc)

    def perform_destroy(self, instance):
        with transaction.atomic():
            remove_purchase_challan_stock(instance)
            instance.delete()


class SellChallanViewSet(AccountsBaseViewSet):
    serializer_class = SellChallanSerializer
    filterset_fields = ['status', 'party', 'project']
    search_fields = ['challan_no', 'party_name', 'vehicle_no', 'site_address', 'remarks']
    ordering = ['-challan_date', '-created_at']

    def get_queryset(self):
        qs = SellChallan.objects.select_related(
            'party', 'project', 'created_by',
        ).prefetch_related('lines', 'lines__inventory_item', 'lines__stock_movement').all()
        return apply_accounts_project_lead_scope(qs, self.request.user)

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                challan = serializer.save(created_by=self.request.user)
                sync_inventory_for_sell_challan(challan, self.request.user)
        except DjangoValidationError as exc:
            _raise_drf(exc)

    def perform_update(self, serializer):
        try:
            with transaction.atomic():
                challan = serializer.save()
                sync_inventory_for_sell_challan(challan, self.request.user)
        except DjangoValidationError as exc:
            _raise_drf(exc)

    def perform_destroy(self, instance):
        with transaction.atomic():
            remove_sell_challan_stock(instance)
            instance.delete()


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
