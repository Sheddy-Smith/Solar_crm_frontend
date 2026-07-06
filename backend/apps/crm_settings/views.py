from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModulePermission

from .models import (
    DocumentNumberSeries,
    FinancialYear,
    IpAccessRule,
    IpBlockedAttempt,
    MasterRecord,
    PaymentMode,
    SystemBackupLog,
    UserActivityLog,
)
from .serializers import (
    CompanyProfileSerializer,
    DocumentNumberSeriesSerializer,
    FinancialYearSerializer,
    IpAccessRuleSerializer,
    IpBlockedAttemptSerializer,
    MasterRecordSerializer,
    PaymentModeSerializer,
    SystemBackupLogSerializer,
    UserActivityLogSerializer,
)
from .services import (
    SETTING_CATEGORIES,
    accounts_settings_summary,
    create_backup_log,
    get_category_settings,
    log_user_activity,
    run_maintenance_action,
    settings_dashboard,
    update_category_settings,
)
from .models import CompanyProfile


class SettingsPermissionMixin:
    permission_classes = [HasModulePermission]
    permission_module = 'Settings'
    permission_action_map = {
        'list': 'can_view',
        'retrieve': 'can_view',
        'create': 'can_add',
        'update': 'can_edit',
        'partial_update': 'can_edit',
        'destroy': 'can_delete',
        'dashboard': 'can_view',
        'types': 'can_view',
        'categories': 'can_view',
        'run': 'can_edit',
        'restore': 'can_edit',
        'summary': 'can_view',
        'set_current': 'can_edit',
    }


class CompanyProfileView(SettingsPermissionMixin, APIView):
    def get(self, request):
        profile = CompanyProfile.get_solo()
        return Response(CompanyProfileSerializer(profile).data)

    def patch(self, request):
        profile = CompanyProfile.get_solo()
        serializer = CompanyProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_user_activity(request, 'Update', 'Settings', 'Company profile updated')
        return Response(serializer.data)


class CategorySettingsView(SettingsPermissionMixin, APIView):
    """GET/PATCH /settings/category/<category>/ — unified settings store."""

    def get(self, request, category):
        if category not in SETTING_CATEGORIES:
            return Response({'detail': 'Unknown settings category.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(get_category_settings(category))

    def patch(self, request, category):
        if category not in SETTING_CATEGORIES:
            return Response({'detail': 'Unknown settings category.'}, status=status.HTTP_404_NOT_FOUND)
        payload = update_category_settings(category, request.data)
        log_user_activity(request, 'Update', 'Settings', f'{category} settings updated')
        return Response(payload)


class SettingsCategoriesView(SettingsPermissionMixin, APIView):
    def get(self, request):
        return Response([
            {'key': key, 'label': key.replace('_', ' ').title()}
            for key in SETTING_CATEGORIES
        ])


class SystemSettingsView(CategorySettingsView):
    """Backward-compatible alias for /settings/system/."""

    def get(self, request):
        return Response(get_category_settings('system'))

    def patch(self, request, category=None):
        payload = update_category_settings('system', request.data)
        log_user_activity(request, 'Update', 'Settings', 'System settings updated')
        return Response(payload)


class PaymentSettingsView(CategorySettingsView):
    """Backward-compatible alias for /settings/payment/."""

    def get(self, request):
        return Response(get_category_settings('payment'))

    def patch(self, request, category=None):
        payload = update_category_settings('payment', request.data)
        log_user_activity(request, 'Update', 'Settings', 'Payment settings updated')
        return Response(payload)


class SettingsDashboardView(SettingsPermissionMixin, APIView):
    def get(self, request):
        return Response(settings_dashboard())


class AccountsSettingsSummaryView(SettingsPermissionMixin, APIView):
    def get(self, request):
        return Response(accounts_settings_summary())

    def patch(self, request):
        payload = update_category_settings('accounts', request.data)
        log_user_activity(request, 'Update', 'Settings', 'Accounts settings updated')
        return Response(accounts_settings_summary() | {'prefix': payload})


class SystemMaintenanceView(SettingsPermissionMixin, APIView):
    permission_method_map = {'POST': 'can_edit'}

    def post(self, request):
        action_name = request.data.get('action', 'health_check')
        result = run_maintenance_action(action_name)
        log_user_activity(request, 'Maintenance', 'Settings', f'Maintenance action: {action_name}')
        return Response(result)


class SystemBackupView(SettingsPermissionMixin, APIView):
    def get(self, request):
        logs = SystemBackupLog.objects.all()[:20]
        return Response(SystemBackupLogSerializer(logs, many=True).data)

    def post(self, request):
        backup_type = request.data.get('backup_type', 'Full')
        log = create_backup_log(request.user, backup_type=backup_type)
        log_user_activity(request, 'Backup', 'Settings', f'Backup created: {log.filename}')
        return Response(SystemBackupLogSerializer(log).data, status=status.HTTP_201_CREATED)


class PaymentModeViewSet(SettingsPermissionMixin, viewsets.ModelViewSet):
    queryset = PaymentMode.objects.all()
    serializer_class = PaymentModeSerializer
    search_fields = ['name', 'code']
    ordering = ['sort_order', 'name']


class MasterRecordViewSet(SettingsPermissionMixin, viewsets.ModelViewSet):
    queryset = MasterRecord.objects.all()
    serializer_class = MasterRecordSerializer
    search_fields = ['name', 'code']
    ordering = ['sort_order', 'name']
    filterset_fields = ['master_type', 'is_active']

    @action(detail=False, methods=['get'])
    def types(self, request):
        from .services import MASTER_TYPE_LABELS
        return Response([
            {'value': value, 'label': label}
            for value, label in MASTER_TYPE_LABELS.items()
        ])


class FinancialYearViewSet(SettingsPermissionMixin, viewsets.ModelViewSet):
    queryset = FinancialYear.objects.all()
    serializer_class = FinancialYearSerializer
    search_fields = ['label']
    ordering = ['-start_date']

    @action(detail=True, methods=['post'])
    def set_current(self, request, pk=None):
        fy = self.get_object()
        fy.is_current = True
        fy.save()
        return Response(FinancialYearSerializer(fy).data)


class UserActivityLogViewSet(SettingsPermissionMixin, viewsets.ReadOnlyModelViewSet):
    queryset = UserActivityLog.objects.select_related('user')
    serializer_class = UserActivityLogSerializer
    search_fields = ['user_name', 'action', 'module', 'description', 'ip_address']
    ordering = ['-created_at']
    filterset_fields = ['module', 'status', 'action']


class IpAccessRuleViewSet(SettingsPermissionMixin, viewsets.ModelViewSet):
    queryset = IpAccessRule.objects.all()
    serializer_class = IpAccessRuleSerializer
    search_fields = ['name', 'ip_range', 'description']
    ordering = ['-created_at']
    filterset_fields = ['rule_type', 'is_active']


class IpBlockedAttemptViewSet(SettingsPermissionMixin, viewsets.ReadOnlyModelViewSet):
    queryset = IpBlockedAttempt.objects.all()
    serializer_class = IpBlockedAttemptSerializer
    search_fields = ['ip_address', 'username', 'reason']
    ordering = ['-attempted_at']


class DocumentNumberSeriesViewSet(SettingsPermissionMixin, viewsets.ModelViewSet):
    queryset = DocumentNumberSeries.objects.all()
    serializer_class = DocumentNumberSeriesSerializer
    search_fields = ['document_type', 'prefix']
    ordering = ['document_type']
