from django.contrib import admin
from .models import Lead, FollowUp, AdminApproval, Quotation, QuotationItem


class FollowUpInline(admin.TabularInline):
    model = FollowUp
    extra = 0
    readonly_fields = ['created_at']


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 1


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ['customer_name', 'mobile_number', 'ivrs_number', 'status', 'category', 'assigned_to', 'next_follow_up', 'created_at']
    list_filter = ['status', 'category', 'assigned_to__branch']
    search_fields = ['customer_name', 'mobile_number', 'ivrs_number', 'project_name']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [FollowUpInline]
    raw_id_fields = ['assigned_to', 'created_by']
    date_hierarchy = 'created_at'


@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = ['lead', 'follow_up_type', 'status', 'scheduled_at', 'created_by']
    list_filter = ['follow_up_type', 'status']
    search_fields = ['lead__customer_name', 'lead__ivrs_number']
    readonly_fields = ['created_at']


@admin.register(AdminApproval)
class AdminApprovalAdmin(admin.ModelAdmin):
    list_display = ['ivrs_number', 'lead', 'requested_by', 'status', 'approved_by', 'created_at']
    list_filter = ['status']
    search_fields = ['ivrs_number', 'lead__customer_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ['lead', 'grand_total', 'status', 'created_by', 'created_at']
    list_filter = ['status']
    readonly_fields = ['subtotal', 'gst_amount', 'grand_total', 'created_at', 'updated_at']
    inlines = [QuotationItemInline]
