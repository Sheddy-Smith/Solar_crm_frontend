from rest_framework import serializers
from .models import (
    Project, ProjectActivity, ProjectNote, ProjectDocument, ProjectExpense, ProjectPayment, WorkOrder,
    ProjectTeamMember, ProjectSystemConfig, ProjectMilestone, SiteSurvey,
    ProjectChecklistItem, InstallationMaterial,
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


class ProjectExpenseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = ProjectExpense
        fields = ['id', 'project', 'category', 'description', 'amount', 'date', 'created_by', 'created_by_name', 'created_at']
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
        fields = ['id', 'project', 'user', 'user_name', 'user_initials', 'user_email', 'user_mobile', 'role_title', 'access_level', 'access_level_display', 'added_at']
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


class SiteSurveySerializer(serializers.ModelSerializer):
    surveyed_by_name = serializers.CharField(source='surveyed_by.name', read_only=True)

    class Meta:
        model = SiteSurvey
        fields = [
            'id', 'project', 'survey_id', 'survey_date', 'surveyed_by', 'surveyed_by_name',
            'building_type', 'floor_count', 'roof_type', 'site_details', 'roof_details',
            'electrical_details', 'roof_stats', 'feasibility', 'summary_notes', 'status',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['survey_id', 'created_at', 'updated_at']


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


class ProjectListSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.name', read_only=True)
    manager_initials = serializers.CharField(source='manager.initials', read_only=True)
    lead_ivrs_number = serializers.CharField(source='lead.ivrs_number', read_only=True)
    lead_mobile_number = serializers.CharField(source='lead.mobile_number', read_only=True)
    lead_status = serializers.CharField(source='lead.status', read_only=True)

    class Meta:
        model = Project
        fields = ['id', 'lead', 'lead_ivrs_number', 'lead_mobile_number', 'lead_status', 'project_id', 'project_name', 'customer_name', 'site', 'project_type', 'capacity_kwp', 'project_image', 'status', 'priority', 'progress_percent', 'manager', 'manager_name', 'manager_initials', 'start_date', 'target_date', 'total_value', 'created_at']


class ProjectDetailSerializer(serializers.ModelSerializer):
    manager_detail = UserSerializer(source='manager', read_only=True)
    site_engineer_detail = UserSerializer(source='site_engineer', read_only=True)
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
