from rest_framework import serializers

from .models import (
    PurchaseInvoice, PurchaseInvoiceLine, PurchaseInvoiceExtraCharge,
    SellInvoice, SellInvoiceLine,
    PaymentVoucher, PurchaseChallan, PurchaseChallanLine,
    SellChallan, SellChallanLine, GstOpeningBalance,
)
from .document_services import (
    apply_invoice_totals, apply_challan_totals, compute_line_total, next_document_number,
)
from .serializers import _user_name


class PurchaseInvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseInvoiceLine
        fields = ['id', 'material_name', 'category', 'quantity', 'unit', 'rate', 'line_total', 'sort_order']
        read_only_fields = ['id', 'line_total']


class PurchaseInvoiceExtraChargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseInvoiceExtraCharge
        fields = ['id', 'description', 'amount', 'sort_order']
        read_only_fields = ['id']


class PurchaseInvoiceSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    supplier_display = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    lines = PurchaseInvoiceLineSerializer(many=True, required=False)
    extra_charges = PurchaseInvoiceExtraChargeSerializer(many=True, required=False)

    def get_record_no(self, obj):
        return obj.invoice_no or f'PI-{obj.id:04d}'

    def get_supplier_display(self, obj):
        if obj.supplier_id:
            return obj.supplier.name
        return obj.supplier_name or '—'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def _save_lines(self, invoice, lines_data):
        invoice.lines.all().delete()
        for idx, line in enumerate(lines_data):
            qty = line.get('quantity', 1)
            rate = line.get('rate', 0)
            PurchaseInvoiceLine.objects.create(
                invoice=invoice,
                material_name=line.get('material_name', ''),
                category=line.get('category', ''),
                quantity=qty,
                unit=line.get('unit', 'Nos'),
                rate=rate,
                line_total=compute_line_total(qty, rate),
                sort_order=line.get('sort_order', idx),
            )

    def _save_extra(self, invoice, extra_data):
        invoice.extra_charges.all().delete()
        for idx, row in enumerate(extra_data):
            PurchaseInvoiceExtraCharge.objects.create(
                invoice=invoice,
                description=row.get('description', ''),
                amount=row.get('amount', 0),
                sort_order=row.get('sort_order', idx),
            )

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        extra_data = validated_data.pop('extra_charges', [])
        if not validated_data.get('invoice_no'):
            validated_data['invoice_no'] = next_document_number('PI', PurchaseInvoice, 'invoice_no')
        invoice = PurchaseInvoice.objects.create(**validated_data)
        self._save_lines(invoice, lines_data)
        self._save_extra(invoice, extra_data)
        apply_invoice_totals(invoice, lines_data, extra_data)
        invoice.save()
        return invoice

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        extra_data = validated_data.pop('extra_charges', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if lines_data is not None:
            self._save_lines(instance, lines_data)
        if extra_data is not None:
            self._save_extra(instance, extra_data)
        lines = lines_data if lines_data is not None else list(instance.lines.values('quantity', 'rate', 'line_total'))
        extras = extra_data if extra_data is not None else list(instance.extra_charges.values('amount'))
        apply_invoice_totals(instance, lines, extras)
        instance.save()
        return instance

    class Meta:
        model = PurchaseInvoice
        fields = [
            'id', 'record_no', 'invoice_no', 'invoice_date', 'supplier', 'supplier_name', 'supplier_display',
            'category', 'project', 'project_name', 'payment_mode', 'payment_amount', 'balance_due',
            'gst_type', 'cgst_percent', 'sgst_percent', 'igst_percent',
            'subtotal', 'extra_charges_total', 'gst_amount', 'total_amount',
            'status', 'remarks', 'lines', 'extra_charges',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['subtotal', 'extra_charges_total', 'gst_amount', 'total_amount', 'balance_due', 'created_by', 'created_at', 'updated_at']


class SellInvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellInvoiceLine
        fields = ['id', 'material_name', 'category', 'quantity', 'unit', 'rate', 'line_total', 'sort_order']
        read_only_fields = ['id', 'line_total']


class SellInvoiceSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    party_display = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    lines = SellInvoiceLineSerializer(many=True, required=False)

    def get_record_no(self, obj):
        return obj.invoice_no or f'SI-{obj.id:04d}'

    def get_party_display(self, obj):
        if obj.party_id:
            return obj.party.name
        return obj.party_name or '—'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def _save_lines(self, invoice, lines_data):
        invoice.lines.all().delete()
        for idx, line in enumerate(lines_data):
            qty = line.get('quantity', 1)
            rate = line.get('rate', 0)
            SellInvoiceLine.objects.create(
                invoice=invoice,
                material_name=line.get('material_name', ''),
                category=line.get('category', ''),
                quantity=qty,
                unit=line.get('unit', 'Nos'),
                rate=rate,
                line_total=compute_line_total(qty, rate),
                sort_order=line.get('sort_order', idx),
            )

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        if not validated_data.get('invoice_no'):
            validated_data['invoice_no'] = next_document_number('SI', SellInvoice, 'invoice_no')
        invoice = SellInvoice.objects.create(**validated_data)
        self._save_lines(invoice, lines_data)
        apply_invoice_totals(invoice, lines_data)
        invoice.save()
        return invoice

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if lines_data is not None:
            self._save_lines(instance, lines_data)
        lines = lines_data if lines_data is not None else list(instance.lines.values('quantity', 'rate', 'line_total'))
        apply_invoice_totals(instance, lines)
        instance.save()
        return instance

    class Meta:
        model = SellInvoice
        fields = [
            'id', 'record_no', 'invoice_no', 'invoice_date', 'party', 'party_name', 'party_display',
            'gst_number', 'branch', 'project', 'project_name', 'payment_mode', 'payment_amount', 'balance_due',
            'gst_type', 'cgst_percent', 'sgst_percent', 'igst_percent',
            'subtotal', 'gst_amount', 'total_amount', 'status', 'remarks', 'lines',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['subtotal', 'gst_amount', 'total_amount', 'balance_due', 'created_by', 'created_at', 'updated_at']


class PaymentVoucherSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return obj.voucher_no or f'VCH-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def create(self, validated_data):
        if not validated_data.get('voucher_no'):
            prefix = 'EXP' if validated_data.get('entry_type') == 'Expense' else 'VCH'
            validated_data['voucher_no'] = next_document_number(prefix, PaymentVoucher, 'voucher_no')
        return super().create(validated_data)

    class Meta:
        model = PaymentVoucher
        fields = [
            'id', 'record_no', 'voucher_no', 'voucher_date', 'entry_type', 'payee_type', 'payee_name',
            'category', 'particulars', 'payment_mode', 'amount', 'project', 'project_name', 'status',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class PurchaseChallanLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseChallanLine
        fields = ['id', 'material_name', 'category', 'quantity', 'unit', 'rate', 'line_total', 'sort_order']
        read_only_fields = ['id', 'line_total']


class PurchaseChallanSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    supplier_display = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    lines = PurchaseChallanLineSerializer(many=True, required=False)

    def get_record_no(self, obj):
        return obj.challan_no or f'PC-{obj.id:04d}'

    def get_supplier_display(self, obj):
        if obj.supplier_id:
            return obj.supplier.name
        return obj.supplier_name or '—'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def _save_lines(self, challan, lines_data):
        challan.lines.all().delete()
        for idx, line in enumerate(lines_data):
            qty = line.get('quantity', 1)
            rate = line.get('rate', 0)
            PurchaseChallanLine.objects.create(
                challan=challan,
                material_name=line.get('material_name', ''),
                category=line.get('category', ''),
                quantity=qty,
                unit=line.get('unit', 'Nos'),
                rate=rate,
                line_total=compute_line_total(qty, rate),
                sort_order=line.get('sort_order', idx),
            )

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        if not validated_data.get('challan_no'):
            validated_data['challan_no'] = next_document_number('PC', PurchaseChallan, 'challan_no')
        challan = PurchaseChallan.objects.create(**validated_data)
        self._save_lines(challan, lines_data)
        apply_challan_totals(challan, lines_data)
        challan.save()
        return challan

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if lines_data is not None:
            self._save_lines(instance, lines_data)
        lines = lines_data if lines_data is not None else list(instance.lines.values('quantity', 'rate', 'line_total'))
        apply_challan_totals(instance, lines)
        instance.save()
        return instance

    class Meta:
        model = PurchaseChallan
        fields = [
            'id', 'record_no', 'challan_no', 'challan_date', 'supplier', 'supplier_name', 'supplier_display',
            'project', 'project_name', 'vehicle_no', 'payment_mode', 'payment_amount', 'balance_due',
            'total_amount', 'status', 'remarks', 'lines',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['total_amount', 'balance_due', 'created_by', 'created_at', 'updated_at']


class SellChallanLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellChallanLine
        fields = ['id', 'material_name', 'category', 'quantity', 'unit', 'rate', 'line_total', 'sort_order']
        read_only_fields = ['id', 'line_total']


class SellChallanSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    party_display = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    lines = SellChallanLineSerializer(many=True, required=False)

    def get_record_no(self, obj):
        return obj.challan_no or f'SC-{obj.id:04d}'

    def get_party_display(self, obj):
        if obj.party_id:
            return obj.party.name
        return obj.party_name or '—'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def _save_lines(self, challan, lines_data):
        challan.lines.all().delete()
        for idx, line in enumerate(lines_data):
            qty = line.get('quantity', 1)
            rate = line.get('rate', 0)
            SellChallanLine.objects.create(
                challan=challan,
                material_name=line.get('material_name', ''),
                category=line.get('category', ''),
                quantity=qty,
                unit=line.get('unit', 'Nos'),
                rate=rate,
                line_total=compute_line_total(qty, rate),
                sort_order=line.get('sort_order', idx),
            )

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        if not validated_data.get('challan_no'):
            validated_data['challan_no'] = next_document_number('SC', SellChallan, 'challan_no')
        challan = SellChallan.objects.create(**validated_data)
        self._save_lines(challan, lines_data)
        apply_challan_totals(challan, lines_data)
        challan.save()
        return challan

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if lines_data is not None:
            self._save_lines(instance, lines_data)
        lines = lines_data if lines_data is not None else list(instance.lines.values('quantity', 'rate', 'line_total'))
        apply_challan_totals(instance, lines)
        instance.save()
        return instance

    class Meta:
        model = SellChallan
        fields = [
            'id', 'record_no', 'challan_no', 'challan_date', 'party', 'party_name', 'party_display',
            'project', 'project_name', 'vehicle_no', 'site_address', 'total_amount', 'status', 'remarks', 'lines',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['total_amount', 'created_by', 'created_at', 'updated_at']


class GstOpeningBalanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = GstOpeningBalance
        fields = ['id', 'month', 'igst_opening', 'cgst_opening', 'sgst_opening', 'notes', 'created_at', 'updated_at']
