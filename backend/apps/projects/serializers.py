from rest_framework import serializers
from .models import (
    Project, ProjectActivity, ProjectNote, ProjectDocument, ProjectPayment, WorkOrder,
    ProjectTeamMember, ProjectSystemConfig, ProjectMilestone, SiteSurvey, SiteSurveyPhoto,
    ProjectChecklistItem, InstallationMaterial, MaterialPlan, SubsidyApplication, SubsidyDocument,
    ProjectApproval, ProjectApprovalDocument, JobSheet,
    PM_STAGES,
)
from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer


def _user_name(user, blank_if_missing=False):
    if user is None and blank_if_missing:
        return ''
    return User.public_display_name(user)


class ProjectActivitySerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectActivity
        fields = ['id', 'project', 'title', 'activity_type', 'status', 'priority', 'assigned_to', 'assigned_to_name', 'start_date', 'due_date', 'completed_date', 'notes', 'created_at']
        read_only_fields = ['created_at']

    def get_assigned_to_name(self, obj):
        return _user_name(obj.assigned_to, blank_if_missing=True)


class ProjectNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectNote
        fields = ['id', 'project', 'title', 'content', 'is_pinned', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)


class ProjectDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectDocument
        fields = ['id', 'project', 'name', 'file', 'category', 'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = ['uploaded_by', 'uploaded_at']

    def get_uploaded_by_name(self, obj):
        return _user_name(obj.uploaded_by)


class ProjectPaymentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPayment
        fields = ['id', 'project', 'amount', 'payment_mode', 'payment_date', 'reference', 'notes', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['created_by', 'created_at']

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)


class WorkOrderSerializer(serializers.ModelSerializer):
    assignee_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrder
        fields = ['id', 'project', 'order_id', 'task', 'category', 'assignee', 'assignee_name', 'status', 'start_date', 'due_date', 'completed_date', 'notes', 'created_at']
        read_only_fields = ['order_id', 'created_at']

    def get_assignee_name(self, obj):
        return _user_name(obj.assignee, blank_if_missing=True)


JOB_SHEET_ROW_KEYS = ('work', 'category', 'cost', 'qty', 'work_order_type', 'assignee_id', 'assignee_name', 'notes', 'work_order_no')


def _clean_job_sheet_rows(value, field_name):
    if value in (None, ''):
        return []
    if not isinstance(value, list):
        raise serializers.ValidationError({field_name: 'Must be a list.'})
    cleaned = []
    for row in value:
        if not isinstance(row, dict):
            continue
        item = {key: row.get(key, '') for key in JOB_SHEET_ROW_KEYS}
        item['work'] = str(item['work'] or '').strip()[:200]
        if not item['work']:
            continue
        item['category'] = str(item['category'] or '').strip()[:100]
        for num_key, default in (('cost', 0), ('qty', 1)):
            try:
                item[num_key] = float(row.get(num_key) if row.get(num_key) not in (None, '') else default)
            except (TypeError, ValueError):
                item[num_key] = default
        if item['work_order_type'] not in ('Vendor', 'Labour'):
            item['work_order_type'] = ''
        if not item['work_order_type']:
            item['assignee_id'] = ''
            item['assignee_name'] = ''
        item['notes'] = str(item['notes'] or '')[:500]
        cleaned.append(item)
    return cleaned


class JobSheetSerializer(serializers.ModelSerializer):
    project_code = serializers.CharField(source='project.project_id', read_only=True)
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    site = serializers.CharField(source='project.site', read_only=True)
    capacity_kwp = serializers.DecimalField(source='project.capacity_kwp', max_digits=8, decimal_places=2, read_only=True)
    manager_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    work_order_count = serializers.SerializerMethodField()

    class Meta:
        model = JobSheet
        fields = [
            'id', 'project', 'project_code', 'project_name', 'customer_name', 'site', 'capacity_kwp',
            'manager_name', 'job_sheet_no', 'status', 'items', 'extra_items', 'discount', 'advance_payment',
            'grand_total', 'round_off', 'final_total', 'balance_due', 'remarks', 'work_orders_generated_at',
            'work_order_count', 'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'job_sheet_no', 'grand_total', 'round_off', 'final_total', 'balance_due',
            'work_orders_generated_at', 'created_by', 'created_at', 'updated_at',
        ]

    def validate_items(self, value):
        return _clean_job_sheet_rows(value, 'items')

    def validate_extra_items(self, value):
        return _clean_job_sheet_rows(value, 'extra_items')

    def get_manager_name(self, obj):
        return _user_name(obj.project.manager, blank_if_missing=True)

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by, blank_if_missing=True)

    def get_work_order_count(self, obj):
        rows = list(obj.items or []) + list(obj.extra_items or [])
        return sum(1 for r in rows if isinstance(r, dict) and r.get('work_order_no'))


class ProjectTeamMemberSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_initials = serializers.CharField(source='user.initials', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_mobile = serializers.CharField(source='user.mobile', read_only=True)
    access_level_display = serializers.CharField(source='get_access_level_display', read_only=True)

    class Meta:
        model = ProjectTeamMember
        fields = ['id', 'project', 'user', 'user_name', 'user_initials', 'user_email', 'user_mobile', 'role_title', 'access_level', 'access_level_display', 'status', 'added_at']
        read_only_fields = ['added_at']


class ProjectSystemConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectSystemConfig
        fields = '__all__'
        read_only_fields = ['updated_at']


class ProjectMilestoneSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.name', read_only=True)
    children = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMilestone
        fields = [
            'id', 'project', 'parent', 'title', 'category', 'status', 'progress_percent',
            'owner', 'owner_name', 'start_date', 'end_date', 'sequence', 'created_at', 'children',
        ]
        read_only_fields = ['created_at']

    def get_children(self, obj):
        children = obj.children.all().order_by('sequence', 'start_date')
        return ProjectMilestoneSerializer(children, many=True).data


class SiteSurveyPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSurveyPhoto
        fields = ['id', 'survey', 'slot', 'image', 'uploaded_by', 'uploaded_at']
        read_only_fields = ['uploaded_by', 'uploaded_at']


class SiteSurveySerializer(serializers.ModelSerializer):
    surveyed_by_name = serializers.CharField(source='surveyed_by.name', read_only=True)
    photos = SiteSurveyPhotoSerializer(many=True, read_only=True)
    # Section 1 "(Auto)" fields — read straight off the linked project/lead so
    # the survey form never asks for data that already exists elsewhere.
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    mobile_number = serializers.SerializerMethodField()
    address = serializers.CharField(source='project.site_address', read_only=True)
    project_name = serializers.CharField(source='project.project_name', read_only=True)

    class Meta:
        model = SiteSurvey
        fields = '__all__'
        read_only_fields = ['survey_id', 'created_at', 'updated_at']

    def get_mobile_number(self, obj):
        lead = obj.project.lead
        return lead.mobile_number if lead else ''

    def to_representation(self, instance):
        data = super().to_representation(instance)
        lead = instance.project.lead
        if lead:
            if not data.get('ivrs_number'):
                data['ivrs_number'] = lead.ivrs_number or ''
            if not data.get('email_id'):
                data['email_id'] = getattr(lead, 'email', '') or ''
            if not data.get('alternate_mobile'):
                data['alternate_mobile'] = getattr(lead, 'alternate_number', '') or ''
            if not data.get('purpose') and lead.project_type:
                data['purpose'] = lead.project_type
            if not data.get('capacity_required_kw') and lead.estimated_capacity:
                data['capacity_required_kw'] = str(lead.estimated_capacity)
        if not data.get('material_checklist'):
            data['material_checklist'] = SiteSurvey.default_material_checklist()
        self._fill_equipment_defaults(instance, data)
        return data

    @staticmethod
    def _fmt(value):
        if value in (None, ''):
            return ''
        text = str(value)
        return text.rstrip('0').rstrip('.') if '.' in text else text

    def _fill_equipment_defaults(self, instance, data):
        """Unsaved panel / inverter / meter fields fall back to the project's
        system config, then the lead's approved (else latest) quotation."""
        project = instance.project
        config = getattr(project, 'system_config', None)
        quotation = None
        if project.lead_id:
            quotes = project.lead.quotations.all()
            quotation = quotes.filter(status='Approved').first() or quotes.first()

        sources = {
            'panel_brand': [getattr(config, 'panel_brand', ''), getattr(quotation, 'panel_brand', '')],
            'panel_type': [getattr(quotation, 'panel_type', '')],
            'panel_wattage_w': [getattr(config, 'panel_wattage_w', None), getattr(quotation, 'panel_wattage', None)],
            'panel_count': [getattr(config, 'panel_count', None), getattr(quotation, 'number_of_panels', None)],
            'inverter_brand': [getattr(config, 'inverter_brand', ''), getattr(quotation, 'inverter_brand', '')],
            'inverter_type': [getattr(quotation, 'inverter_type', '')],
            'inverter_capacity_kw': [getattr(config, 'inverter_capacity_kw', None), getattr(quotation, 'inverter_capacity', '')],
            'inverter_quantity': [getattr(quotation, 'inverter_quantity', None)],
            'meter_number': [project.meter_number, getattr(quotation, 'existing_meter_number', '')],
            # The form's "Types of Meters" select is stored in meter_location.
            'meter_location': [project.meter_type if project.meter_type in dict(SiteSurvey.METER_PHASE_CHOICES) else ''],
        }
        for field, candidates in sources.items():
            if data.get(field):
                continue
            for candidate in candidates:
                value = self._fmt(candidate)
                if value:
                    data[field] = value
                    break


SURVEY_REQUIRED_ROOF_SLOTS = {
    'South Side', 'South-East Side', 'South-West Side', 'Front View',
}


def compute_survey_completion_percent(survey):
    # Mirrors the frontend's progress-bar formula (Section 12 "Survey Summary")
    # so the dashboard list and the edit form always agree on the same number.
    uploaded_slots = {p.slot for p in survey.photos.all()}
    roof_score = len(SURVEY_REQUIRED_ROOF_SLOTS & uploaded_slots) / len(SURVEY_REQUIRED_ROOF_SLOTS) * 40
    roof_type_score = 20 if survey.roof_type else 0
    gps_score = 20 if survey.latitude and survey.longitude else 0
    route_score = 20 if any([survey.ac_cable_length_approx, survey.dc_cable_length_approx, survey.conduit_length_approx]) else 0
    return round(roof_score + roof_type_score + gps_score + route_score)


class SiteSurveyListSerializer(serializers.ModelSerializer):
    surveyed_by_name = serializers.CharField(source='surveyed_by.name', read_only=True)
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    project_id_display = serializers.CharField(source='project.project_id', read_only=True)
    completion_percent = serializers.SerializerMethodField()

    class Meta:
        model = SiteSurvey
        fields = [
            'id', 'project', 'project_id_display', 'project_name', 'customer_name',
            'survey_id', 'survey_date', 'surveyed_by', 'surveyed_by_name',
            'status', 'completion_percent', 'created_at', 'updated_at',
        ]

    def get_completion_percent(self, obj):
        return compute_survey_completion_percent(obj)


class ProjectChecklistItemSerializer(serializers.ModelSerializer):
    checked_by_name = serializers.CharField(source='checked_by.name', read_only=True)

    class Meta:
        model = ProjectChecklistItem
        fields = ['id', 'project', 'phase', 'category', 'label', 'is_checked', 'notes', 'checked_by', 'checked_by_name', 'checked_at']


class InstallationMaterialSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source='inventory_item.name', read_only=True)

    class Meta:
        model = InstallationMaterial
        fields = [
            'id', 'project', 'inventory_item', 'inventory_item_name', 'item_name',
            'category', 'unit', 'required_qty', 'issued_qty', 'consumed_qty', 'status',
        ]


class MaterialPlanSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source='inventory_item.name', read_only=True)
    inventory_unit_cost = serializers.SerializerMethodField()
    planning_unit_price_display = serializers.SerializerMethodField()
    unit_difference = serializers.SerializerMethodField()
    inventory_total_cost = serializers.SerializerMethodField()
    planning_total_value = serializers.SerializerMethodField()
    planning_difference_total = serializers.SerializerMethodField()
    cost_voucher_id = serializers.SerializerMethodField()

    class Meta:
        model = MaterialPlan
        fields = [
            'id', 'project', 'category', 'items', 'uom', 'planned_qty', 'planned_value',
            'planning_unit_price',
            'status',
            'dispatched_qty', 'dispatch_status', 'packed_at', 'dispatch_date', 'vehicle_no', 'challan_no', 'dispatch_notes',
            'inventory_item', 'inventory_item_name', 'stock_movement', 'cost_voucher_id',
            'inventory_unit_cost', 'planning_unit_price_display', 'unit_difference',
            'inventory_total_cost', 'planning_total_value', 'planning_difference_total',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'stock_movement', 'cost_voucher_id', 'packed_at']

    def _normalize_dispatch_status(self, validated_data, instance=None):
        from django.utils import timezone

        def current(field):
            if field in validated_data:
                return validated_data[field]
            return getattr(instance, field, None) if instance is not None else None

        requested = validated_data.get('dispatch_status')
        if requested not in ('Pending', 'Packed'):
            requested = getattr(instance, 'dispatch_status', None)
        status = MaterialPlan.compute_dispatch_status(
            current('planned_qty'), current('dispatched_qty'), requested,
        )
        validated_data['dispatch_status'] = status
        if status == 'Packed':
            if not current('packed_at'):
                validated_data['packed_at'] = timezone.now()
        elif status == 'Pending':
            validated_data['packed_at'] = None
        return validated_data

    def get_cost_voucher_id(self, obj):
        voucher = getattr(obj, 'cost_voucher', None)
        return voucher.id if voucher else None

    def _pricing(self, obj):
        from apps.accounts_module.project_financial_sync import material_plan_pricing
        return material_plan_pricing(obj)

    def get_inventory_unit_cost(self, obj):
        return float(self._pricing(obj)['inventory_unit_cost'])

    def get_planning_unit_price_display(self, obj):
        return float(self._pricing(obj)['planning_unit_price'])

    def get_unit_difference(self, obj):
        return float(self._pricing(obj)['unit_difference'])

    def get_inventory_total_cost(self, obj):
        return float(self._pricing(obj)['inventory_total_cost'])

    def get_planning_total_value(self, obj):
        return float(self._pricing(obj)['planning_total_value'])

    def get_planning_difference_total(self, obj):
        return float(self._pricing(obj)['planning_difference_total'])

    def _sync_dispatch_stock(self, plan):
        from apps.inventory.dispatch_sync import sync_inventory_for_material_dispatch
        from rest_framework.exceptions import ValidationError as DRFValidationError
        from django.core.exceptions import ValidationError as DjangoValidationError

        request = self.context.get('request')
        user = request.user if request and getattr(request.user, 'is_authenticated', False) else None
        try:
            return sync_inventory_for_material_dispatch(plan, user=user)
        except DjangoValidationError as exc:
            if hasattr(exc, 'message_dict'):
                raise DRFValidationError(exc.message_dict) from exc
            raise DRFValidationError({'quantity': list(exc.messages)}) from exc

    def _sync_dispatch_accounts(self, plan):
        from apps.accounts_module.project_financial_sync import sync_accounts_for_material_dispatch
        request = self.context.get('request')
        user = request.user if request and getattr(request.user, 'is_authenticated', False) else None
        return sync_accounts_for_material_dispatch(plan, user=user)

    def _normalize_planning_fields(self, validated_data, instance=None):
        """Keep planned_value = qty × planning_unit_price when planning price is provided.
        Never touch InventoryItem.rate."""
        from decimal import Decimal
        from apps.accounts_module.category_map import decimal_or_zero

        qty = validated_data.get('planned_qty')
        if qty is None and instance is not None:
            qty = instance.planned_qty

        if 'planning_unit_price' in validated_data:
            planning_price = validated_data.get('planning_unit_price')
        elif instance is not None:
            planning_price = instance.planning_unit_price
        else:
            planning_price = None

        if planning_price is not None and planning_price != '':
            q = decimal_or_zero(qty)
            p = decimal_or_zero(planning_price)
            if q > 0:
                validated_data['planned_value'] = str((q * p).quantize(Decimal('0.01')))
        return validated_data

    def create(self, validated_data):
        validated_data = self._normalize_planning_fields(validated_data)
        validated_data = self._normalize_dispatch_status(validated_data)
        plan = super().create(validated_data)
        if _parse_dispatched(plan.dispatched_qty) > 0 or plan.inventory_item_id:
            self._sync_dispatch_stock(plan)
            self._sync_dispatch_accounts(plan)
            plan.refresh_from_db()
        return plan

    def update(self, instance, validated_data):
        validated_data = self._normalize_planning_fields(validated_data, instance)
        validated_data = self._normalize_dispatch_status(validated_data, instance)
        prev_qty = instance.dispatched_qty
        plan = super().update(instance, validated_data)
        qty_changed = str(prev_qty or '') != str(plan.dispatched_qty or '')
        if qty_changed or 'inventory_item' in validated_data or plan.inventory_item_id or plan.stock_movement_id:
            self._sync_dispatch_stock(plan)
            self._sync_dispatch_accounts(plan)
            plan.refresh_from_db()
        return plan


def _parse_dispatched(value):
    try:
        return float(str(value or '0').replace(',', '').strip() or '0')
    except (TypeError, ValueError):
        return 0.0


class ProjectListSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.name', read_only=True)
    manager_initials = serializers.CharField(source='manager.initials', read_only=True)
    lead_ivrs_number = serializers.CharField(source='lead.ivrs_number', read_only=True)
    lead_mobile_number = serializers.CharField(source='lead.mobile_number', read_only=True)
    lead_status = serializers.CharField(source='lead.status', read_only=True)
    survey_date = serializers.SerializerMethodField()
    surveyed_by_name = serializers.SerializerMethodField()
    survey_feasibility = serializers.SerializerMethodField()
    survey_status = serializers.SerializerMethodField()
    installation_team = serializers.SerializerMethodField()
    stage_progress = serializers.SerializerMethodField()
    pm_stage = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'lead', 'lead_ivrs_number', 'lead_mobile_number', 'lead_status', 'project_id',
            'project_name', 'customer_name', 'site', 'project_type', 'capacity_kwp', 'project_image',
            'status', 'priority', 'progress_percent', 'manager', 'manager_name', 'manager_initials',
            'start_date', 'target_date', 'total_value', 'created_at', 'survey_date', 'surveyed_by_name',
            'survey_feasibility', 'survey_status', 'installation_team', 'stage_progress',
            'installation_status', 'installation_done_on', 'pm_stage',
        ]

    def get_pm_stage(self, obj):
        try:
            return obj.pm_stage_tracker.stage
        except Project.pm_stage_tracker.RelatedObjectDoesNotExist:
            return PM_STAGES[0]

    def get_survey_date(self, obj):
        return getattr(obj.site_survey, 'survey_date', None) if hasattr(obj, 'site_survey') else None

    def get_surveyed_by_name(self, obj):
        survey = getattr(obj, 'site_survey', None)
        return survey.surveyed_by.name if survey and survey.surveyed_by else ''

    def get_survey_feasibility(self, obj):
        return getattr(obj.site_survey, 'feasibility', '') if hasattr(obj, 'site_survey') else ''

    def get_survey_status(self, obj):
        return getattr(obj.site_survey, 'status', '') if hasattr(obj, 'site_survey') else ''

    def get_installation_team(self, obj):
        """Single assigned person from the linked Won lead (their install team lead)."""
        lead = getattr(obj, 'lead', None)
        assigned = getattr(lead, 'assigned_to', None) if lead else None
        name = getattr(assigned, 'name', None) if assigned else None
        return name or 'Unassigned'

    def get_stage_progress(self, obj):
        """Project Management subcategory progress for list column."""
        survey = getattr(obj, 'site_survey', None)
        survey_status = (getattr(survey, 'status', None) or '').strip()
        if survey_status == 'Completed':
            survey_pct = 100
        elif survey_status == 'In Progress':
            survey_pct = 55
        elif survey_status in ('Pending', 'Draft', 'Not Started'):
            survey_pct = 15 if survey_status in ('Pending', 'Draft') else 0
        else:
            survey_pct = 0

        plans = list(obj.material_plans.all()) if hasattr(obj, 'material_plans') else []
        if plans:
            done_mat = sum(1 for p in plans if (p.status or '') == 'Completed')
            partial_mat = sum(1 for p in plans if (p.status or '') in ('In Progress', 'Partially Completed'))
            material_pct = int(round(((done_mat + partial_mat * 0.5) / len(plans)) * 100))
            done_disp = sum(1 for p in plans if (p.dispatch_status or '') == 'Dispatched')
            partial_disp = sum(1 for p in plans if (p.dispatch_status or '') == 'Partial')
            dispatch_pct = int(round(((done_disp + partial_disp * 0.5) / len(plans)) * 100))
        else:
            material_pct = 0
            dispatch_pct = 0

        install_items = [c for c in obj.checklist_items.all() if (c.phase or '') == 'Installation']
        if obj.installation_status == 'Done':
            installation_pct = 100
        elif install_items:
            checked = sum(1 for c in install_items if c.is_checked)
            installation_pct = int(round((checked / len(install_items)) * 100))
        else:
            # Fall back to overall project progress when no install checklist exists.
            installation_pct = int(obj.progress_percent or 0)

        overall = int(obj.progress_percent or 0)
        return {
            'survey': survey_pct,
            'material': material_pct,
            'dispatch': dispatch_pct,
            'installation': installation_pct,
            'overall': overall,
        }


class ProjectDetailSerializer(serializers.ModelSerializer):
    manager_detail = UserSerializer(source='manager', read_only=True)
    site_engineer_detail = UserSerializer(source='site_engineer', read_only=True)
    sales_executive_detail = UserSerializer(source='sales_executive', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    activities = ProjectActivitySerializer(many=True, read_only=True)
    notes = ProjectNoteSerializer(many=True, read_only=True)
    documents = ProjectDocumentSerializer(many=True, read_only=True)
    payments = ProjectPaymentSerializer(many=True, read_only=True)
    work_orders = WorkOrderSerializer(many=True, read_only=True)
    team_members = ProjectTeamMemberSerializer(many=True, read_only=True)
    checklist_items = ProjectChecklistItemSerializer(many=True, read_only=True)
    installation_materials = InstallationMaterialSerializer(many=True, read_only=True)
    total_paid = serializers.SerializerMethodField()
    system_config = serializers.SerializerMethodField()
    site_survey = serializers.SerializerMethodField()
    milestones = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ['project_id', 'created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if 'installation_status' in attrs:
            if attrs['installation_status'] == 'Done':
                if not attrs.get('installation_done_on') and not getattr(self.instance, 'installation_done_on', None):
                    from django.utils import timezone
                    attrs['installation_done_on'] = timezone.localdate()
            else:
                attrs['installation_done_on'] = None
        return attrs

    def get_total_paid(self, obj):
        return sum(p.amount for p in obj.payments.all())

    def get_system_config(self, obj):
        config = getattr(obj, 'system_config', None)
        return ProjectSystemConfigSerializer(config).data if config else None

    def get_site_survey(self, obj):
        survey = getattr(obj, 'site_survey', None)
        return SiteSurveySerializer(survey, context=self.context).data if survey else None

    def get_milestones(self, obj):
        top_level = obj.milestones.filter(parent__isnull=True).order_by('sequence', 'start_date')
        return ProjectMilestoneSerializer(top_level, many=True).data


class SubsidyDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubsidyDocument
        fields = ['id', 'subsidy', 'doc_type', 'name', 'file', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class SubsidyApplicationSerializer(serializers.ModelSerializer):
    documents = SubsidyDocumentSerializer(many=True, read_only=True)
    assigned_employee_name = serializers.CharField(source='assigned_employee.name', read_only=True)

    class Meta:
        model = SubsidyApplication
        fields = [
            'id', 'project', 'application_number', 'application_date',
            'discom', 'status', 'assigned_employee', 'assigned_employee_name', 'remarks',
            'documents', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class ProjectApprovalDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectApprovalDocument
        fields = ['id', 'approval', 'name', 'file', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class ProjectApprovalSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    documents = ProjectApprovalDocumentSerializer(many=True, read_only=True)
    approval_id = serializers.SerializerMethodField()

    def get_approval_id(self, obj):
        return f"APR-{obj.created_at.year}-{obj.id:04d}"

    def get_assigned_to_name(self, obj):
        return _user_name(obj.assigned_to, blank_if_missing=True)

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def get_approved_by_name(self, obj):
        return _user_name(obj.approved_by, blank_if_missing=True)

    class Meta:
        model = ProjectApproval
        fields = [
            'id', 'approval_id', 'project', 'project_name', 'approval_type', 'subject',
            'description', 'requested_by', 'assigned_to', 'assigned_to_name', 'priority',
            'remarks', 'status', 'created_by', 'created_by_name', 'approved_by',
            'approved_by_name', 'approved_at', 'rejection_reason', 'documents',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'approved_by', 'approved_at', 'created_at', 'updated_at']


class PmPipelineProjectSerializer(serializers.ModelSerializer):
    """Won-lead project as seen by the Project Management pipeline. `pm_stage`
    and the step aggregates are queryset annotations (see PmPipelineViewSet)."""

    pm_stage = serializers.CharField(read_only=True)
    stage_index = serializers.SerializerMethodField()
    stage_history = serializers.SerializerMethodField()
    mobile_number = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()
    step_info = serializers.SerializerMethodField()

    def get_stage_index(self, obj):
        stage = getattr(obj, 'pm_stage', PM_STAGES[0])
        return PM_STAGES.index(stage) if stage in PM_STAGES else len(PM_STAGES)

    def get_stage_history(self, obj):
        try:
            return obj.pm_stage_tracker.history
        except Project.pm_stage_tracker.RelatedObjectDoesNotExist:
            return []

    def get_mobile_number(self, obj):
        return obj.lead.mobile_number if obj.lead else ''

    def get_manager_name(self, obj):
        return _user_name(obj.manager, blank_if_missing=True)

    def get_step_info(self, obj):
        def n(value, word):
            value = value or 0
            return f'{value} {word}{"" if value == 1 else "s"}'

        materials = getattr(obj, 'material_count', 0) or 0
        dispatched = getattr(obj, 'dispatched_count', 0) or 0
        return {
            'Site Survey': getattr(obj, 'survey_state', None) or 'Not started',
            'Quotation': n(getattr(obj, 'quotations_count', 0), 'quotation'),
            'Material Planning': n(materials, 'BOM item'),
            'Job Sheet': getattr(obj, 'job_sheet_state', None) or 'Not created',
            'Dispatch': f'{dispatched}/{materials} dispatched' if materials else 'No BOM yet',
            'Installation': obj.installation_status or 'Not Done',
            'Sales Challan': n(getattr(obj, 'challans_count', 0), 'challan'),
            'Invoice': n(getattr(obj, 'invoices_count', 0), 'invoice'),
        }

    class Meta:
        model = Project
        fields = [
            'id', 'project_id', 'project_name', 'customer_name', 'city', 'state', 'site',
            'site_address', 'capacity_kwp', 'project_type', 'status', 'lead', 'mobile_number',
            'manager_name', 'total_value', 'created_at', 'installation_status',
            'pm_stage', 'stage_index', 'stage_history', 'step_info',
        ]
