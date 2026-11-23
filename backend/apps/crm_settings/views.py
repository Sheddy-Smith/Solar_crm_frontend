from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
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
    organization_snapshot,
    run_maintenance_action,
    settings_dashboard,
    sync_business_to_company,
    sync_company_to_business,
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


class OrganizationSnapshotView(APIView):
    """Authenticated org snapshot for documents, headers, and settings pages."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(organization_snapshot(request=request))


class PublicBrandingView(APIView):
    """Unauthenticated branding for portal / login screens (name + logo only)."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        snap = organization_snapshot(request=request)
        return Response({
            'display_name': snap.get('display_name') or 'Company',
            'logo_url': snap.get('logo_url') or '',
            'updated_at': snap.get('updated_at'),
        })


class CompanyProfileView(SettingsPermissionMixin, APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        profile = CompanyProfile.get_solo()
        return Response(CompanyProfileSerializer(profile, context={'request': request}).data)

    def patch(self, request):
        profile = CompanyProfile.get_solo()
        # Prefer request.FILES — QueryDict.dict() can drop multipart file objects.
        logo_file = request.FILES.get('logo')
        if logo_file is not None:
            if getattr(logo_file, 'size', 0) > 2 * 1024 * 1024:
                return Response(
                    {'logo': ['Logo must be 2 MB or smaller.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            name = (getattr(logo_file, 'name', '') or '').lower()
            content_type = (getattr(logo_file, 'content_type', '') or '').lower()
            ok_ext = name.endswith(('.jpg', '.jpeg', '.png', '.webp'))
            ok_mime = content_type in ('image/jpeg', 'image/png', 'image/webp', '')
            if not ok_ext and not ok_mime:
                return Response(
                    {'logo': ['Upload a JPG, PNG, or WEBP image.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profile.logo = logo_file
            profile.save(update_fields=['logo', 'updated_at'])
            log_user_activity(request, 'Update', 'Settings', 'Company logo updated')
            return Response(CompanyProfileSerializer(profile, context={'request': request}).data)

        payload = request.data
        if hasattr(payload, 'dict'):
            payload = payload.dict()
        if isinstance(payload, dict):
            payload.pop('logo', None)
        serializer = CompanyProfileSerializer(
            profile, data=payload, partial=True, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if isinstance(serializer.instance.data, dict) and serializer.instance.data:
            sync_company_to_business(serializer.instance.data)
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
        if category == 'business':
            sync_business_to_company(payload)
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
    queryset = UserActivityLog.objects.select_related('user', 'user__role')
    serializer_class = UserActivityLogSerializer
    search_fields = ['user_name', 'action', 'module', 'description', 'ip_address']
    ordering = ['-created_at']
    filterset_fields = ['module', 'status', 'action', 'user']

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        created_from = (params.get('created_from') or params.get('date_from') or '').strip()
        created_to = (params.get('created_to') or params.get('date_to') or '').strip()
        try:
            if created_from:
                qs = qs.filter(created_at__date__gte=created_from)
            if created_to:
                qs = qs.filter(created_at__date__lte=created_to)
        except (TypeError, ValueError):
            pass
        raw_users = (params.get('user_ids') or '').strip()
        if raw_users and not params.get('user'):
            user_ids = [part.strip() for part in raw_users.split(',') if part.strip().isdigit()]
            if user_ids:
                qs = qs.filter(user_id__in=user_ids)
        return qs


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
