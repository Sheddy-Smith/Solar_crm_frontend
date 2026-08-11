from django.contrib import admin

from .models import DailyTask, StaffDailyTask


@admin.register(DailyTask)
class DailyTaskAdmin(admin.ModelAdmin):
    list_display = ('task_date', 'category', 'status', 'summary_text', 'created_by', 'created_at')
    list_filter = ('category', 'status', 'task_date')
    search_fields = ('summary_text', 'notes')


@admin.register(StaffDailyTask)
class StaffDailyTaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'assigned_to', 'assigned_by', 'task_date', 'status', 'updated_at')
    list_filter = ('status', 'task_date', 'branch')
    search_fields = ('title', 'description', 'assigned_to__name', 'assigned_by__name')
