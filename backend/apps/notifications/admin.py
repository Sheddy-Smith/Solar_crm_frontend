from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'severity', 'user', 'module', 'channel', 'created_at')
    list_filter = ('category', 'severity', 'channel')
    search_fields = ('title', 'message', 'dedupe_key')
