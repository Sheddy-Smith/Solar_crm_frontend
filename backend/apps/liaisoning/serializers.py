from rest_framework import serializers
from django.utils import timezone
from apps.projects.models import Project
from .models import (
    LiaisonApplication, LiaisonApproval, LiaisonInspection,
    LiaisonCommissioning, LiaisonCompliance, LiaisonDocument,
    LiaisonAgreement, LiaisonNetMeter, LiaisonLoanProcess, LiaisonInspectionPlaced,
    LiaisonDivision, LiaisonZone, LiaisonProjectStage, LIAISON_STAGES,
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
            'division', 'zone',
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
    has_site_credentials = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'LC-COM-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def get_has_site_credentials(self, obj):
        return bool(obj.wifi_password_encrypted or obj.solar_app_password_encrypted)

    def validate_assigned_employee(self, value):
        if value is None:
            raise serializers.ValidationError('Please select an engineer from the employee list.')
        if getattr(value, 'status', '') == 'On Leave':
            raise serializers.ValidationError('Selected employee is On Leave.')
        return value

    def validate(self, attrs):
        new_status = attrs.get('status')
        if new_status == 'Completed':
            instance = self.instance
            has_form = bool(
                instance
                and instance.inverter_warranty_years
                and instance.panel_warranty_years
                and instance.service_warranty_years
                and instance.wifi_ssid
                and instance.wifi_password_encrypted
                and instance.solar_app_platform
                and instance.solar_app_username
                and instance.solar_app_password_encrypted
            )
            if not has_form:
                raise serializers.ValidationError({
                    'status': 'Use Complete Commissioning form (warranty + Wi-Fi / Solar App credentials) before marking Completed.',
                })
        return attrs

    def create(self, validated_data):
        from .commissioning_tasks import sync_commissioning_tasks
        request = self.context.get('request')
        actor = getattr(request, 'user', None) if request else None
        employee = validated_data.get('assigned_employee')
        if employee and not validated_data.get('engineer'):
            validated_data['engineer'] = employee.name
        if validated_data.get('status') == 'Completed':
            validated_data['status'] = 'In Progress'
        obj = super().create(validated_data)
        sync_commissioning_tasks(obj, actor=actor)
        if obj.assigned_employee_id and obj.status != 'Completed':
            try:
                from apps.om.services import stage_plant_pending
                stage_plant_pending(obj.project, user=actor)
            except Exception:
                pass
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
        if obj.assigned_employee_id and obj.status != 'Completed':
            try:
                from apps.om.services import stage_plant_pending
                stage_plant_pending(obj.project, user=actor)
            except Exception:
                pass
        return obj

    class Meta:
        model = LiaisonCommissioning
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'engineer', 'assigned_employee', 'assigned_employee_name',
            'date', 'status', 'checklist', 'remarks',
            'inverter_warranty_years', 'panel_warranty_years', 'service_warranty_years',
            'next_service_due', 'wifi_ssid', 'solar_app_platform', 'solar_app_username',
            'has_site_credentials', 'completed_at',
            'daily_task', 'staff_task',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'created_by', 'created_at', 'updated_at', 'daily_task', 'staff_task', 'engineer',
            'inverter_warranty_years', 'panel_warranty_years', 'service_warranty_years',
            'next_service_due', 'wifi_ssid', 'solar_app_platform', 'solar_app_username',
            'has_site_credentials', 'completed_at',
        ]


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
            'loan_type', 'financier_name', 'loan_account_number',
            'quotation_amount', 'loan_amount', 'loan_percent', 'sanctioned_amount',
            'applied_date', 'sanctioned_date', 'status', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        quote = attrs.get('quotation_amount', getattr(self.instance, 'quotation_amount', None) if self.instance else None)
        applied = attrs.get('loan_amount', getattr(self.instance, 'loan_amount', None) if self.instance else None)
        if quote not in (None, '') and applied not in (None, '') and float(quote) > 0:
            attrs['loan_percent'] = round((float(applied) / float(quote)) * 100, 2)
        return attrs


class LiaisonDivisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LiaisonDivision
        fields = ['id', 'name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class LiaisonZoneSerializer(serializers.ModelSerializer):
    division_name = serializers.CharField(source='division.name', read_only=True)

    class Meta:
        model = LiaisonZone
        fields = ['id', 'name', 'division', 'division_name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


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
    document_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'LC-AGR-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def get_document_name(self, obj):
        if not obj.document:
            return ''
        name = getattr(obj.document, 'name', '') or ''
        return name.rsplit('/', 1)[-1] if name else ''

    class Meta:
        model = LiaisonAgreement
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name',
            'agreement_type', 'agreement_number', 'agreement_date', 'signed_by',
            'status', 'remarks', 'document', 'document_name',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'document_name']
        extra_kwargs = {
            'document': {'required': False, 'allow_null': True},
        }


class LiaisonNetMeterSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    record_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    ready_for_commissioning = serializers.SerializerMethodField()
    project_id_display = serializers.CharField(source='project.project_id', read_only=True)

    def get_record_no(self, obj):
        return f'LC-NMT-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def get_ready_for_commissioning(self, obj):
        return obj.is_ready_for_commissioning()

    def validate(self, attrs):
        meter_number = attrs.get('meter_number')
        if meter_number is None and self.instance:
            meter_number = self.instance.meter_number
        meter_number = (meter_number or '').strip()
        project = attrs.get('project') or (self.instance.project if self.instance else None)
        if meter_number and project:
            qs = LiaisonNetMeter.objects.filter(project=project, meter_number=meter_number)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({
                    'meter_number': 'A meter with this number already exists for this project.',
                })
        return attrs

    def _append_history(self, instance, old_status, request):
        if old_status == instance.status:
            return
        entry = {
            'from': old_status or '',
            'to': instance.status,
            'by': _user_name(request.user) if request and getattr(request, 'user', None) else '',
            'at': timezone.now().isoformat(),
            'note': '',
        }
        history = list(instance.status_history or [])
        history.append(entry)
        instance.status_history = history

    def _ready_commissioning_stage(self, instance, request):
        """When Net Metering is fully completed, move project to Commissioning stage
        (Ready for Commissioning). Does NOT create/complete a Commissioning record."""
        if not instance.is_ready_for_commissioning():
            return
        tracker, _ = LiaisonProjectStage.objects.get_or_create(project=instance.project)
        if tracker.stage != 'Net Meter':
            return
        tracker.history = [*(tracker.history or []), {
            'from': tracker.stage,
            'to': 'Commissioning',
            'action': 'net_meter_completed',
            'by': _user_name(request.user) if request and getattr(request, 'user', None) else '',
            'at': timezone.now().isoformat(),
        }]
        tracker.stage = 'Commissioning'
        if request and getattr(request, 'user', None) and request.user.is_authenticated:
            tracker.updated_by = request.user
        tracker.save(update_fields=['history', 'stage', 'updated_by', 'updated_at'])

    def create(self, validated_data):
        request = self.context.get('request')
        meter_type = validated_data.get('meter_type') or LiaisonNetMeter.METER_TYPE_SMART_1P
        validated_data['phase'] = LiaisonNetMeter.PHASE_BY_TYPE.get(
            meter_type, validated_data.get('phase') or 'Single Phase',
        )
        source = validated_data.get('meter_source') or LiaisonNetMeter.SOURCE_NEW
        if source == LiaisonNetMeter.SOURCE_EXISTING:
            validated_data.setdefault('status', LiaisonNetMeter.STATUS_EXISTING_VERIFIED)
            validated_data.setdefault('existing_verified', True)
        else:
            validated_data.setdefault('status', LiaisonNetMeter.STATUS_PURCHASE)
        instance = super().create(validated_data)
        self._append_history(instance, '', request)
        if instance.status_history:
            instance.save(update_fields=['status_history'])
        self._ready_commissioning_stage(instance, request)
        return instance

    def update(self, instance, validated_data):
        request = self.context.get('request')
        old_status = instance.status
        if 'meter_type' in validated_data:
            validated_data['phase'] = LiaisonNetMeter.PHASE_BY_TYPE.get(
                validated_data['meter_type'], instance.phase or 'Single Phase',
            )
        if validated_data.get('meter_source') == LiaisonNetMeter.SOURCE_EXISTING:
            if validated_data.get('status') == LiaisonNetMeter.STATUS_EXISTING_VERIFIED:
                validated_data['existing_verified'] = True
        instance = super().update(instance, validated_data)
        self._append_history(instance, old_status, request)
        if instance.status_history is not None:
            instance.save(update_fields=['status_history', 'updated_at'])
        self._ready_commissioning_stage(instance, request)
        return instance

    class Meta:
        model = LiaisonNetMeter
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name', 'project_id_display',
            'meter_type', 'meter_number', 'meter_make', 'phase', 'meter_source',
            'division', 'zone',
            'application_date', 'status_date',
            'purchase_date', 'purchase_vendor',
            'testing_date', 'testing_details',
            'installation_date', 'assigned_to',
            'existing_verified',
            'email_sent_date', 'email_reference', 'email_recipient', 'email_notes',
            'division_response', 'division_response_date',
            'status', 'remarks', 'status_history',
            'ready_for_commissioning',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'created_by', 'created_at', 'updated_at', 'phase',
            'status_history', 'ready_for_commissioning', 'project_id_display',
        ]


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
