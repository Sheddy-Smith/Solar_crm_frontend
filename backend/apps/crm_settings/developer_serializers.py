from rest_framework import serializers

from .models import (
    AttendanceMachineConfig,
    AttendanceMachineSyncRun,
    AuditEvent,
    BugReport,
    DeveloperMemoryNote,
    WhatsAppExtensionMessage,
)


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            'id', 'user', 'user_name', 'branch', 'action', 'entity',
            'description', 'payload', 'created_at',
        ]
        read_only_fields = fields


class BugReportSerializer(serializers.ModelSerializer):
    reporter_id = serializers.IntegerField(source='reported_by_id', read_only=True)
    source_label = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = BugReport
        fields = [
            'id', 'title', 'body', 'path', 'status', 'source', 'source_label',
            'fingerprint', 'occurrence_count', 'attachments',
            'reported_by', 'reporter_id', 'reporter_name', 'created_at', 'resolved_at',
        ]
        read_only_fields = [
            'id', 'status', 'source', 'source_label', 'fingerprint', 'occurrence_count',
            'attachments', 'reported_by', 'reporter_id', 'reporter_name', 'created_at', 'resolved_at',
        ]
        extra_kwargs = {
            'body': {'allow_blank': True, 'required': False},
        }

    def get_source_label(self, obj):
        return 'Auto pick' if obj.source == 'auto' else 'User'

    def get_attachments(self, obj):
        items = []
        for item in obj.attachments.all():
            items.append({
                'id': item.id,
                'name': item.original_name or item.file.name,
                'kind': item.kind,
                'url': item.file.url if item.file else '',
            })
        return items


class WhatsAppExtensionMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppExtensionMessage
        fields = [
            'id', 'occurred_at', 'from_number', 'sender_name', 'group_module',
            'vehicle_no', 'message', 'attachment_name', 'status', 'raw',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AttendanceMachineConfigSerializer(serializers.ModelSerializer):
    is_configured = serializers.BooleanField(read_only=True)

    class Meta:
        model = AttendanceMachineConfig
        fields = [
            'corporate_id', 'username', 'api_endpoint', 'auto_sync',
            'late_after', 'default_lookback_days', 'last_sync_at',
            'last_sync_status', 'last_sync_detail', 'is_configured', 'updated_at',
        ]
        read_only_fields = [
            'last_sync_at', 'last_sync_status', 'last_sync_detail',
            'is_configured', 'updated_at',
        ]


class AttendanceMachineSyncRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceMachineSyncRun
        fields = [
            'id', 'from_date', 'to_date', 'emp_code', 'status',
            'punches_imported', 'detail', 'created_at', 'finished_at',
        ]
        read_only_fields = fields


class DeveloperMemoryNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeveloperMemoryNote
        fields = ['notes', 'updated_at']
        read_only_fields = ['updated_at']
