from rest_framework import serializers
from apps.projects.models import Project
from .models import (
    LiaisonApplication, LiaisonApproval, LiaisonInspection,
    LiaisonCommissioning, LiaisonCompliance, LiaisonDocument,
    LiaisonAgreement, LiaisonNetMeter, LiaisonLoanProcess, LiaisonInspectionPlaced,
    LIAISON_STAGES,
)


def _user_name(user):
    if not user:
        return ''
    return user.name or user.email


class LiaisonApplicationSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'LC-APP-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = LiaisonApplication
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'application_number', 'application_type', 'capacity_kw', 'discom',
            'status', 'submitted_date', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class LiaisonApprovalSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    record_no = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'LC-APR-{obj.id:04d}'

    def get_assigned_to_name(self, obj):
        return _user_name(obj.assigned_to)

    def get_approved_by_name(self, obj):
        return _user_name(obj.approved_by)

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = LiaisonApproval
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'approval_type', 'assigned_to', 'assigned_to_name', 'status',
            'due_date', 'description', 'remarks',
            'approved_by', 'approved_by_name', 'approved_at', 'rejection_reason',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'approved_by', 'approved_at', 'created_at', 'updated_at']


class LiaisonInspectionSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'LC-INS-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = LiaisonInspection
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'inspector', 'date', 'status', 'checklist', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class LiaisonCommissioningSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    assigned_employee_name = serializers.CharField(source='assigned_employee.name', read_only=True)

    def get_record_no(self, obj):
        return f'LC-COM-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def validate_assigned_employee(self, value):
        if value is None:
            raise serializers.ValidationError('Please select an engineer from the employee list.')
        if getattr(value, 'status', '') == 'On Leave':
            raise serializers.ValidationError('Selected employee is On Leave.')
        return value

    def create(self, validated_data):
        from .commissioning_tasks import sync_commissioning_tasks
        request = self.context.get('request')
        actor = getattr(request, 'user', None) if request else None
        employee = validated_data.get('assigned_employee')
        if employee and not validated_data.get('engineer'):
            validated_data['engineer'] = employee.name
        obj = super().create(validated_data)
        sync_commissioning_tasks(obj, actor=actor)
        return obj

    def update(self, instance, validated_data):
        from .commissioning_tasks import sync_commissioning_tasks
        request = self.context.get('request')
        actor = getattr(request, 'user', None) if request else None
        employee = validated_data.get('assigned_employee', instance.assigned_employee)
        if employee and 'engineer' not in validated_data:
            validated_data['engineer'] = employee.name
        obj = super().update(instance, validated_data)
        sync_commissioning_tasks(obj, actor=actor)
        return obj

    class Meta:
        model = LiaisonCommissioning
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'engineer', 'assigned_employee', 'assigned_employee_name',
            'date', 'status', 'checklist', 'remarks',
            'daily_task', 'staff_task',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'daily_task', 'staff_task', 'engineer']


class LiaisonComplianceSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'LC-CMP-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = LiaisonCompliance
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'compliance_type', 'due_date', 'status', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class LiaisonDocumentSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()

    def get_uploaded_by_name(self, obj):
        return _user_name(obj.uploaded_by)

    class Meta:
        model = LiaisonDocument
        fields = [
            'id', 'project', 'project_name', 'module', 'related_id',
            'doc_type', 'name', 'file',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
        ]
        read_only_fields = ['uploaded_by', 'uploaded_at']


class LiaisonLoanProcessSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'LC-LOAN-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = LiaisonLoanProcess
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'loan_type', 'financier_name', 'loan_account_number', 'loan_amount',
            'applied_date', 'sanctioned_date', 'status', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class LiaisonInspectionPlacedSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'LC-IPL-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = LiaisonInspectionPlaced
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'authority', 'reference_number', 'placed_date', 'scheduled_date',
            'inspector_name', 'status', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class LiaisonAgreementSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'LC-AGR-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = LiaisonAgreement
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'agreement_type', 'agreement_number', 'agreement_date', 'signed_by',
            'status', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class LiaisonNetMeterSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'LC-NMT-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = LiaisonNetMeter
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'meter_type', 'meter_number', 'meter_make', 'phase',
            'application_date', 'installation_date', 'status', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class LiaisonProjectSerializer(serializers.ModelSerializer):
    """Won-lead project as seen by the Liaisoning pipeline. `lc_stage` and the
    `*_count` fields are queryset annotations (see LiaisonProjectViewSet)."""

    lc_stage = serializers.CharField(read_only=True)
    stage_index = serializers.SerializerMethodField()
    stage_history = serializers.SerializerMethodField()
    mobile_number = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()
    step_counts = serializers.SerializerMethodField()

    def get_stage_index(self, obj):
        stage = getattr(obj, 'lc_stage', LIAISON_STAGES[0])
        if stage == 'Inspection Placed':
            stage = 'Inspection'
        return LIAISON_STAGES.index(stage) if stage in LIAISON_STAGES else len(LIAISON_STAGES)

    def get_stage_history(self, obj):
        try:
            return obj.liaison_stage.history
        except Project.liaison_stage.RelatedObjectDoesNotExist:
            return []

    def get_mobile_number(self, obj):
        return obj.lead.mobile_number if obj.lead else ''

    def get_manager_name(self, obj):
        return _user_name(obj.manager)

    def get_step_counts(self, obj):
        return {
            'Documents': getattr(obj, 'documents_count', 0),
            'Application': getattr(obj, 'applications_count', 0),
            'Loan Process': getattr(obj, 'loan_processes_count', 0),
            'Agreement': getattr(obj, 'agreements_count', 0),
            'Inspection': getattr(obj, 'inspections_count', 0),
            'Net Meter': getattr(obj, 'net_meters_count', 0),
            'Commissioning': getattr(obj, 'commissionings_count', 0),
            'Inspection Placed': getattr(obj, 'inspections_placed_count', 0),
            'Subsidy': getattr(obj, 'subsidies_count', 0),
        }

    class Meta:
        model = Project
        fields = [
            'id', 'project_id', 'project_name', 'customer_name', 'city', 'state',
            'site_address', 'capacity_kwp', 'project_type', 'status', 'lead', 'mobile_number',
            'discom_name', 'consumer_number', 'manager_name', 'created_at',
            'lc_stage', 'stage_index', 'stage_history', 'step_counts',
        ]
