from django.contrib import admin
from .models import (
    Project, ProjectActivity, ProjectNote, ProjectDocument, ProjectExpense, WorkOrder,
    ProjectTeamMember, ProjectSystemConfig, ProjectMilestone, SiteSurvey,
    ProjectChecklistItem, InstallationMaterial,
)


class ProjectActivityInline(admin.TabularInline):
    model = ProjectActivity
    extra = 0
    fields = ['title', 'activity_type', 'status', 'assigned_to', 'due_date']


class WorkOrderInline(admin.TabularInline):
    model = WorkOrder
    extra = 0
    fields = ['order_id', 'task', 'assignee', 'status', 'due_date']
    readonly_fields = ['order_id']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['project_id', 'project_name', 'customer_name', 'project_type', 'status', 'progress_percent', 'manager', 'target_date']
    list_filter = ['status', 'project_type', 'priority', 'manager']
    search_fields = ['project_name', 'customer_name', 'project_id', 'site']
    readonly_fields = ['project_id', 'created_at', 'updated_at']
    inlines = [ProjectActivityInline, WorkOrderInline]
    date_hierarchy = 'created_at'
    raw_id_fields = ['manager', 'site_engineer', 'lead', 'created_by']


@admin.register(ProjectActivity)
class ProjectActivityAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'activity_type', 'status', 'assigned_to', 'due_date']
    list_filter = ['status', 'activity_type']
    search_fields = ['title', 'project__project_name']


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = ['order_id', 'task', 'project', 'assignee', 'status', 'due_date']
    list_filter = ['status']
    search_fields = ['order_id', 'task', 'project__project_name']
    readonly_fields = ['order_id', 'created_at']


@admin.register(ProjectExpense)
class ProjectExpenseAdmin(admin.ModelAdmin):
    list_display = ['project', 'category', 'description', 'amount', 'date']
    list_filter = ['category']
    search_fields = ['project__project_name', 'description']


@admin.register(ProjectDocument)
class ProjectDocumentAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'category', 'uploaded_by', 'uploaded_at']
    list_filter = ['category']
    search_fields = ['name', 'project__project_name']


@admin.register(ProjectTeamMember)
class ProjectTeamMemberAdmin(admin.ModelAdmin):
    list_display = ['project', 'user', 'role_title', 'added_at']
    search_fields = ['project__project_name', 'user__name']


@admin.register(ProjectSystemConfig)
class ProjectSystemConfigAdmin(admin.ModelAdmin):
    list_display = ['project', 'inverter_brand', 'panel_brand', 'panel_count']


@admin.register(ProjectMilestone)
class ProjectMilestoneAdmin(admin.ModelAdmin):
    list_display = ['project', 'title', 'parent', 'status', 'progress_percent', 'start_date', 'end_date']
    list_filter = ['status']
    search_fields = ['title', 'project__project_name']


@admin.register(SiteSurvey)
class SiteSurveyAdmin(admin.ModelAdmin):
    list_display = ['survey_id', 'project', 'survey_date', 'surveyed_by', 'feasibility', 'status']
    readonly_fields = ['survey_id', 'created_at', 'updated_at']
    search_fields = ['survey_id', 'project__project_name']


@admin.register(ProjectChecklistItem)
class ProjectChecklistItemAdmin(admin.ModelAdmin):
    list_display = ['project', 'phase', 'category', 'label', 'is_checked']
    list_filter = ['phase', 'category', 'is_checked']
    search_fields = ['label', 'project__project_name']


@admin.register(InstallationMaterial)
class InstallationMaterialAdmin(admin.ModelAdmin):
    list_display = ['project', 'item_name', 'category', 'required_qty', 'issued_qty', 'consumed_qty', 'status']
    list_filter = ['status', 'category']
    search_fields = ['item_name', 'project__project_name']
