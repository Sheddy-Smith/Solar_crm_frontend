from django.contrib import admin

from .models import DailyTask


@admin.register(DailyTask)
class DailyTaskAdmin(admin.ModelAdmin):
    list_display = ('task_date', 'category', 'status', 'summary_text', 'created_by', 'created_at')
    list_filter = ('category', 'status', 'task_date')
    search_fields = ('summary_text', 'notes')
