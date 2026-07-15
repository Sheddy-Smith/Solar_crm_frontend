from rest_framework import serializers
from .models import Lead, FollowUp, AdminApproval, Quotation, QuotationItem, LeadSiteSurvey, LeadSurveyPhoto
from apps.accounts.serializers import UserSerializer


class LeadSurveyPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadSurveyPhoto
        fields = ['id', 'survey', 'image', 'caption', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class LeadSiteSurveySerializer(serializers.ModelSerializer):
    surveyed_by_name = serializers.CharField(source='surveyed_by.name', read_only=True)
    photos = LeadSurveyPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = LeadSiteSurvey
        fields = [
            'id', 'lead', 'site_address', 'latitude', 'longitude', 'mounting_type',
            'site_size_sqft', 'customer_feedback', 'status', 'survey_date',
            'surveyed_by', 'surveyed_by_name', 'photos', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class FollowUpSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    lead_customer_name = serializers.CharField(source='lead.customer_name', read_only=True)
    lead_mobile_number = serializers.CharField(source='lead.mobile_number', read_only=True)
    lead_project_name = serializers.CharField(source='lead.project_name', read_only=True)

    class Meta:
        model = FollowUp
        fields = [
            'id', 'lead', 'follow_up_type', 'scheduled_at', 'completed_at', 'status', 'notes',
            'reminder', 'status_after', 'created_by', 'created_by_name', 'created_at',
            'lead_customer_name', 'lead_mobile_number', 'lead_project_name',
        ]
        read_only_fields = ['created_by', 'created_at']


class AdminApprovalSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.name', read_only=True)
    lead_customer_name = serializers.CharField(source='lead.customer_name', read_only=True)
    lead_mobile_number = serializers.CharField(source='lead.mobile_number', read_only=True)
    lead_project_type = serializers.CharField(source='lead.project_type', read_only=True)
    created_lead_ivrs_number = serializers.CharField(source='created_lead.ivrs_number', read_only=True)

    class Meta:
        model = AdminApproval
        fields = [
            'id', 'lead', 'lead_customer_name', 'lead_mobile_number', 'lead_project_type',
            'ivrs_number', 'duplicate_of', 'created_lead', 'created_lead_ivrs_number',
            'requested_customer_name', 'requested_mobile_number', 'requested_project_name',
            'requested_project_type', 'requested_payload',
            'requested_by', 'requested_by_name', 'approved_by', 'approved_by_name',
            'status', 'reason', 'created_at', 'updated_at',
        ]
        read_only_fields = ['requested_by', 'approved_by', 'created_lead', 'created_at', 'updated_at']


class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = ['id', 'item_name', 'brand', 'specification', 'quantity', 'unit', 'rate', 'amount']


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, required=False)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    sales_executive_name = serializers.CharField(source='sales_executive.name', read_only=True)
    lead_customer_name = serializers.CharField(source='lead.customer_name', read_only=True)
    lead_ivrs_number = serializers.CharField(source='lead.ivrs_number', read_only=True)
    cost_per_watt = serializers.ReadOnlyField()
    estimated_annual_savings = serializers.ReadOnlyField()
    roi_percent = serializers.ReadOnlyField()
    payback_period_years = serializers.ReadOnlyField()

    class Meta:
        model = Quotation
        fields = [
            'id', 'lead', 'lead_customer_name', 'lead_ivrs_number', 'items',
            'quotation_number', 'template', 'quotation_date', 'valid_till',
            'sales_executive', 'sales_executive_name',
            'company_name', 'alternate_number', 'email', 'gst_number', 'aadhaar_number', 'address', 'city', 'state', 'pincode',
            'project_type', 'installation_type', 'sanctioned_load_kw', 'monthly_electricity_bill', 'discom_name',
            'existing_meter_number', 'connection_type', 'consumer_number', 'execution_timeline',
            'plant_capacity_kw', 'estimated_annual_generation', 'shadow_free_area', 'module_orientation',
            'panel_brand', 'panel_model', 'panel_type', 'panel_wattage', 'number_of_panels', 'total_dc_capacity',
            'inverter_brand', 'inverter_model', 'inverter_type', 'inverter_capacity', 'inverter_quantity',
            'structure_type', 'structure_material', 'coating_details', 'foundation_type', 'wind_speed_rating',
            'dc_cable', 'ac_cable', 'earthing_kit', 'lightning_arrester', 'acdb', 'dcdb', 'connectors',
            'mc4_connector', 'cable_tray', 'fasteners', 'pvc_pipe',
            'material_cost', 'structure_cost', 'installation_cost', 'transportation_cost',
            'liaisoning_charges', 'net_metering_charges', 'other_charges',
            'subsidy_applicable', 'subsidy_amount', 'customer_contribution',
            'subtotal', 'gst_percent', 'gst_amount', 'discount', 'grand_total',
            'advance_percent', 'material_dispatch_percent', 'installation_percent', 'commissioning_percent',
            'panel_warranty', 'inverter_warranty', 'structure_warranty', 'workmanship_warranty',
            'special_instructions', 'scope_of_work', 'exclusions', 'notes',
            'cost_per_watt', 'estimated_annual_savings', 'roi_percent', 'payback_period_years',
            'status', 'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'created_by', 'quotation_number', 'subtotal', 'gst_amount', 'grand_total',
            'customer_contribution', 'total_dc_capacity', 'created_at', 'updated_at',
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
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
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    created_at_display = serializers.SerializerMethodField()
    survey_status = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            'id', 'customer_name', 'mobile_number', 'ivrs_number',
            'project_name', 'project_type', 'estimated_capacity',
            'status', 'priority', 'category', 'remarks',
            'assigned_to', 'assigned_to_name', 'created_by', 'created_by_name',
            'next_follow_up', 'created_at', 'created_at_display', 'survey_status',
        ]

    def get_created_at_display(self, obj):
        return obj.created_at.strftime('%d %b %Y') if obj.created_at else '—'

    def get_survey_status(self, obj):
        survey = getattr(obj, 'site_survey', None)
        return survey.status if survey else 'Pending'


class LeadDetailSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserSerializer(source='assigned_to', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    follow_ups = FollowUpSerializer(many=True, read_only=True)
    quotations = QuotationSerializer(many=True, read_only=True)
    approvals = AdminApprovalSerializer(many=True, read_only=True)
    site_survey = LeadSiteSurveySerializer(read_only=True)
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
        extra_kwargs = {'status': {'required': True}}

    def validate_ivrs_number(self, value):
        if value and Lead.objects.filter(ivrs_number=value).exists():
            raise serializers.ValidationError('IVRS number already exists — Admin approval required.')
        return value
