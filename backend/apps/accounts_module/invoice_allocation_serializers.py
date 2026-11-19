from rest_framework import serializers

from .invoice_payment_allocation import (
    allocate_payment_bulk,
    allocate_payment_to_invoice,
    reverse_invoice_allocation,
)
from .models import InvoicePaymentAllocation


class InvoicePaymentAllocationSerializer(serializers.ModelSerializer):
    receipt_no = serializers.SerializerMethodField()
    invoice_no = serializers.SerializerMethodField()
    payment_date = serializers.DateField(source='payment.payment_date', read_only=True)
    payment_mode = serializers.CharField(source='payment.payment_mode', read_only=True)
    payment_amount = serializers.DecimalField(
        source='payment.amount', max_digits=14, decimal_places=2, read_only=True,
    )
    party_id = serializers.IntegerField(source='payment.party_id', read_only=True)
    project_id = serializers.SerializerMethodField()
    allocated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = InvoicePaymentAllocation
        fields = [
            'id', 'payment', 'invoice', 'allocated_amount', 'status', 'notes',
            'receipt_no', 'invoice_no', 'payment_date', 'payment_mode', 'payment_amount',
            'party_id', 'project_id',
            'allocated_by', 'allocated_by_name', 'allocated_at',
            'reversed_by', 'reversed_at', 'reversal_reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'status', 'allocated_by', 'allocated_at', 'reversed_by', 'reversed_at',
            'reversal_reason', 'created_at', 'updated_at',
        ]

    def get_receipt_no(self, obj):
        return obj.payment.reference_no or f'RCPT-{obj.payment_id:04d}'

    def get_invoice_no(self, obj):
        return obj.invoice.invoice_no or f'SI-{obj.invoice_id:04d}'

    def get_project_id(self, obj):
        return obj.invoice.project_id or obj.payment.project_id

    def get_allocated_by_name(self, obj):
        if obj.allocated_by_id:
            return getattr(obj.allocated_by, 'name', None) or obj.allocated_by.email
        return None


class InvoiceAllocationCreateSerializer(serializers.Serializer):
    payment_id = serializers.IntegerField()
    invoice_id = serializers.IntegerField()
    allocated_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def create(self, validated_data):
        user = self.context['request'].user
        return allocate_payment_to_invoice(
            payment_id=validated_data['payment_id'],
            invoice_id=validated_data['invoice_id'],
            allocated_amount=validated_data['allocated_amount'],
            user=user,
            notes=validated_data.get('notes') or '',
        )


class InvoiceAllocationBulkCreateSerializer(serializers.Serializer):
    payment_id = serializers.IntegerField()
    lines = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def validate_lines(self, lines):
        cleaned = []
        for line in lines:
            if 'invoice_id' not in line or 'allocated_amount' not in line:
                raise serializers.ValidationError('Each line needs invoice_id and allocated_amount.')
            cleaned.append({
                'invoice_id': int(line['invoice_id']),
                'allocated_amount': line['allocated_amount'],
                'notes': line.get('notes') or '',
            })
        return cleaned

    def create(self, validated_data):
        user = self.context['request'].user
        return allocate_payment_bulk(
            payment_id=validated_data['payment_id'],
            lines=validated_data['lines'],
            user=user,
        )


class InvoiceAllocationReverseSerializer(serializers.Serializer):
    reversal_reason = serializers.CharField(max_length=2000)

    def save(self, **kwargs):
        allocation = self.context['allocation']
        user = self.context['request'].user
        return reverse_invoice_allocation(
            allocation_id=allocation.id,
            user=user,
            reversal_reason=self.validated_data['reversal_reason'],
        )
