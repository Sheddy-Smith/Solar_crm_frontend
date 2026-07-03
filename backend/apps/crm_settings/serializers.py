from rest_framework import serializers

from .models import (
    AppSetting,
    CompanyProfile,
    DocumentNumberSeries,
    FinancialYear,
    IpAccessRule,
    IpBlockedAttempt,
    MasterRecord,
    PaymentMode,
    SystemBackupLog,
    UserActivityLog,
)


class CompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = ['data', 'updated_at']
        read_only_fields = ['updated_at']


class AppSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppSetting
        fields = ['id', 'category', 'key', 'value', 'updated_at']
        read_only_fields = ['updated_at']


class PaymentModeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMode
        fields = ['id', 'name', 'code', 'description', 'is_active', 'sort_order', 'created_at']
        read_only_fields = ['created_at']


class MasterRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterRecord
        fields = ['id', 'master_type', 'name', 'code', 'is_active', 'sort_order', 'metadata', 'created_at']
        read_only_fields = ['created_at']


class FinancialYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialYear
        fields = ['id', 'label', 'start_date', 'end_date', 'status', 'is_current', 'created_at']
        read_only_fields = ['created_at']


class UserActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserActivityLog
        fields = [
            'id', 'user', 'user_name', 'action', 'module', 'description',
            'ip_address', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'user', 'user_name', 'created_at']


class IpAccessRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = IpAccessRule
        fields = ['id', 'name', 'ip_range', 'rule_type', 'description', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class IpBlockedAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = IpBlockedAttempt
        fields = ['id', 'ip_address', 'username', 'reason', 'attempted_at']
        read_only_fields = fields


class DocumentNumberSeriesSerializer(serializers.ModelSerializer):
    preview = serializers.CharField(read_only=True)

    class Meta:
        model = DocumentNumberSeries
        fields = [
            'id', 'document_type', 'prefix', 'next_number', 'padding',
            'suffix', 'is_active', 'preview', 'created_at',
        ]
        read_only_fields = ['created_at', 'preview']


class SystemBackupLogSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SystemBackupLog
        fields = [
            'id', 'filename', 'file_size', 'backup_type', 'status',
            'notes', 'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['created_at', 'created_by_name']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.name or obj.created_by.email
        return ''
