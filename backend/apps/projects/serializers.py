from rest_framework import serializers
from .models import (
    Project, ProjectActivity, ProjectNote, ProjectDocument, ProjectExpense, ProjectPayment, WorkOrder,
    ProjectTeamMember, ProjectSystemConfig, ProjectMilestone, SiteSurvey, SiteSurveyPhoto,
    ProjectChecklistItem, InstallationMaterial, MaterialPlan, SubsidyApplication, SubsidyDocument,
    ProjectExpenseDocument, ProjectApproval, ProjectApprovalDocument,
)
from apps.accounts.serializers import UserSerializer


class ProjectActivitySerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.name', read_only=True)

    class Meta:
        model = ProjectActivity
        fields = ['id', 'project', 'title', 'activity_type', 'status', 'priority', 'assigned_to', 'assigned_to_name', 'start_date', 'due_date', 'completed_date', 'notes', 'created_at']
        read_only_fields = ['created_at']


class ProjectNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = ProjectNote
        fields = ['id', 'project', 'title', 'content', 'is_pinned', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class ProjectDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)

    class Meta:
        model = ProjectDocument
        fields = ['id', 'project', 'name', 'file', 'category', 'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = ['uploaded_by', 'uploaded_at']


class ProjectExpenseDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectExpenseDocument
        fields = ['id', 'expense', 'doc_type', 'name', 'file', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class ProjectExpenseSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    project_capacity = serializers.CharField(source='project.capacity_kwp', read_only=True)
    project_status = serializers.CharField(source='project.status', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    expense_documents = ProjectExpenseDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectExpense
        fields = [
            'id', 'project', 'project_name', 'customer_name', 'project_capacity', 'project_status',
            'category', 'description', 'amount', 'date',
            'payment_mode', 'paid_by', 'status', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'expense_documents',
        ]
        read_only_fields = ['created_by', 'created_at']


class ProjectPaymentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = ProjectPayment
        fields = ['id', 'project', 'amount', 'payment_mode', 'payment_date', 'reference', 'notes', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['created_by', 'created_at']


class WorkOrderSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source='assignee.name', read_only=True)

    class Meta:
        model = WorkOrder
        fields = ['id', 'project', 'order_id', 'task', 'category', 'assignee', 'assignee_name', 'status', 'start_date', 'due_date', 'completed_date', 'notes', 'created_at']
        read_only_fields = ['order_id', 'created_at']


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


SURVEY_SAFETY_FIELD_NAMES = [
    'safety_roof_safe', 'safety_shadow_checked', 'safety_earthing_finalized', 'safety_meter_verified',
    'safety_inverter_location_final', 'safety_cable_route_final', 'safety_tank_checked',
    'safety_customer_approval_taken', 'safety_gps_captured', 'safety_all_photos_uploaded',
]
SURVEY_REQUIRED_ROOF_SLOTS = {
    'North Side', 'South Side', 'East Side', 'West Side',
    'Overall Roof', 'Roof Close-up', 'Water Tank', 'Obstacle',
}


def compute_survey_completion_percent(survey):
    # Mirrors the frontend's progress-bar formula (Section 12 "Survey Summary")
    # so the dashboard list and the edit form always agree on the same number.
    uploaded_slots = {p.slot for p in survey.photos.all()}
    roof_score = len(SURVEY_REQUIRED_ROOF_SLOTS & uploaded_slots) / len(SURVEY_REQUIRED_ROOF_SLOTS) * 40
    safety_score = sum(1 for f in SURVEY_SAFETY_FIELD_NAMES if getattr(survey, f)) / len(SURVEY_SAFETY_FIELD_NAMES) * 30
    roof_type_score = 15 if survey.roof_type else 0
    gps_score = 15 if survey.latitude and survey.longitude else 0
    return round(roof_score + safety_score + roof_type_score + gps_score)


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
    class Meta:
        model = MaterialPlan
        fields = ['id', 'project', 'category', 'items', 'uom', 'planned_qty', 'planned_value', 'status', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


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

    class Meta:
        model = Project
        fields = ['id', 'lead', 'lead_ivrs_number', 'lead_mobile_number', 'lead_status', 'project_id', 'project_name', 'customer_name', 'site', 'project_type', 'capacity_kwp', 'project_image', 'status', 'priority', 'progress_percent', 'manager', 'manager_name', 'manager_initials', 'start_date', 'target_date', 'total_value', 'created_at', 'survey_date', 'surveyed_by_name', 'survey_feasibility', 'survey_status']

    def get_survey_date(self, obj):
        return getattr(obj.site_survey, 'survey_date', None) if hasattr(obj, 'site_survey') else None

    def get_surveyed_by_name(self, obj):
        survey = getattr(obj, 'site_survey', None)
        return survey.surveyed_by.name if survey and survey.surveyed_by else ''

    def get_survey_feasibility(self, obj):
        return getattr(obj.site_survey, 'feasibility', '') if hasattr(obj, 'site_survey') else ''

    def get_survey_status(self, obj):
        return getattr(obj.site_survey, 'status', '') if hasattr(obj, 'site_survey') else ''


class ProjectDetailSerializer(serializers.ModelSerializer):
    manager_detail = UserSerializer(source='manager', read_only=True)
    site_engineer_detail = UserSerializer(source='site_engineer', read_only=True)
    sales_executive_detail = UserSerializer(source='sales_executive', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    activities = ProjectActivitySerializer(many=True, read_only=True)
    notes = ProjectNoteSerializer(many=True, read_only=True)
    documents = ProjectDocumentSerializer(many=True, read_only=True)
    expenses = ProjectExpenseSerializer(many=True, read_only=True)
    payments = ProjectPaymentSerializer(many=True, read_only=True)
    work_orders = WorkOrderSerializer(many=True, read_only=True)
    team_members = ProjectTeamMemberSerializer(many=True, read_only=True)
    checklist_items = ProjectChecklistItemSerializer(many=True, read_only=True)
    installation_materials = InstallationMaterialSerializer(many=True, read_only=True)
    total_expense = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    system_config = serializers.SerializerMethodField()
    site_survey = serializers.SerializerMethodField()
    milestones = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ['project_id', 'created_by', 'created_at', 'updated_at']

    def get_total_expense(self, obj):
        return sum(e.amount for e in obj.expenses.all())

    def get_total_paid(self, obj):
        return sum(p.amount for p in obj.payments.all())

    def get_system_config(self, obj):
        config = getattr(obj, 'system_config', None)
        return ProjectSystemConfigSerializer(config).data if config else None

    def get_site_survey(self, obj):
        survey = getattr(obj, 'site_survey', None)
        return SiteSurveySerializer(survey).data if survey else None

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
        if obj.assigned_to:
            return obj.assigned_to.name or obj.assigned_to.email
        return ''

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.name or obj.created_by.email
        return ''

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.name or obj.approved_by.email
        return ''

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
