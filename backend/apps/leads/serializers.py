from rest_framework import serializers
from .models import Lead, FollowUp, AdminApproval, Quotation, QuotationItem
from apps.accounts.serializers import UserSerializer


class FollowUpSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = FollowUp
        fields = ['id', 'lead', 'follow_up_type', 'scheduled_at', 'completed_at', 'status', 'notes', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['created_by', 'created_at']


class AdminApprovalSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.name', read_only=True)
    lead_customer_name = serializers.CharField(source='lead.customer_name', read_only=True)
    lead_mobile_number = serializers.CharField(source='lead.mobile_number', read_only=True)
    lead_project_type = serializers.CharField(source='lead.project_type', read_only=True)

    class Meta:
        model = AdminApproval
        fields = [
            'id', 'lead', 'lead_customer_name', 'lead_mobile_number', 'lead_project_type',
            'ivrs_number', 'duplicate_of',
            'requested_customer_name', 'requested_mobile_number', 'requested_project_name',
            'requested_project_type', 'requested_payload',
            'requested_by', 'requested_by_name', 'approved_by', 'approved_by_name',
            'status', 'reason', 'created_at', 'updated_at',
        ]
        read_only_fields = ['requested_by', 'approved_by', 'created_at', 'updated_at']


class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = ['id', 'item_name', 'quantity', 'unit', 'rate', 'amount']


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = Quotation
        fields = ['id', 'lead', 'items', 'subtotal', 'gst_percent', 'gst_amount', 'discount', 'grand_total', 'status', 'notes', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'subtotal', 'gst_amount', 'grand_total', 'created_at', 'updated_at']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        quotation = Quotation.objects.create(**validated_data)
        for item_data in items_data:
            QuotationItem.objects.create(quotation=quotation, **item_data)
        quotation.recalculate_totals()
        return quotation

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                QuotationItem.objects.create(quotation=instance, **item_data)
            instance.recalculate_totals()
        return instance


class LeadListSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.name', read_only=True)
    created_at_display = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            'id', 'customer_name', 'mobile_number', 'ivrs_number',
            'project_name', 'project_type', 'estimated_capacity',
            'status', 'priority', 'category',
            'assigned_to', 'assigned_to_name',
            'next_follow_up', 'created_at', 'created_at_display',
        ]

    def get_created_at_display(self, obj):
        return obj.created_at.strftime('%d %b %Y') if obj.created_at else '—'


class LeadDetailSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserSerializer(source='assigned_to', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    follow_ups = FollowUpSerializer(many=True, read_only=True)
    quotations = QuotationSerializer(many=True, read_only=True)
    approvals = AdminApprovalSerializer(many=True, read_only=True)
    created_at_display = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_at_display(self, obj):
        return obj.created_at.strftime('%d %b %Y') if obj.created_at else '—'


class LeadCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = [
            'id', 'customer_name', 'mobile_number', 'ivrs_number',
            'alternate_number', 'email',
            'project_name', 'project_type', 'estimated_capacity', 'requirement_details',
            'address', 'city', 'state', 'latitude', 'longitude',
            'source', 'priority', 'remarks',
            'status', 'next_follow_up', 'assigned_to', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_ivrs_number(self, value):
        if value and Lead.objects.filter(ivrs_number=value).exists():
            raise serializers.ValidationError('IVRS number already exists — Admin approval required.')
        return value
