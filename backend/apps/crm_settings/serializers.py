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
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = CompanyProfile
        fields = ['data', 'logo', 'logo_url', 'updated_at']
        read_only_fields = ['updated_at', 'logo_url']
        extra_kwargs = {
            'logo': {'required': False, 'allow_null': True},
        }

    def get_logo_url(self, obj):
        """Return a same-app relative media path (e.g. /media/company_logos/…).

        Absolute host URLs break the SPA when API and UI are on different
        origins (crm.* vs api.*) or when Django sees an internal Host header.
        The frontend resolves /media via VITE_API_URL / Vite proxy.
        """
        if not obj.logo:
            return ''
        try:
            return obj.logo.url or ''
        except ValueError:
            return ''


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
    role_name = serializers.SerializerMethodField()

    class Meta:
        model = UserActivityLog
        fields = [
            'id', 'user', 'user_name', 'role_name', 'action', 'module', 'description',
            'ip_address', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'user', 'user_name', 'role_name', 'created_at']

    def get_role_name(self, obj):
        user = getattr(obj, 'user', None)
        if user is None:
            return ''
        role = getattr(user, 'role', None)
        return getattr(role, 'name', '') or ''


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
        from apps.accounts.models import User
        return User.public_display_name(obj.created_by)
