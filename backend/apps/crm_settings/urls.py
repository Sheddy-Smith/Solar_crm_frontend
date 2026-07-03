from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AccountsSettingsSummaryView,
    CategorySettingsView,
    CompanyProfileView,
    DocumentNumberSeriesViewSet,
    FinancialYearViewSet,
    IpAccessRuleViewSet,
    IpBlockedAttemptViewSet,
    MasterRecordViewSet,
    PaymentModeViewSet,
    PaymentSettingsView,
    SettingsCategoriesView,
    SettingsDashboardView,
    SystemBackupView,
    SystemMaintenanceView,
    SystemSettingsView,
    UserActivityLogViewSet,
)

router = DefaultRouter()
router.register('payment-modes', PaymentModeViewSet, basename='payment-mode')
router.register('masters', MasterRecordViewSet, basename='master-record')
router.register('financial-years', FinancialYearViewSet, basename='financial-year')
router.register('activity-logs', UserActivityLogViewSet, basename='activity-log')
router.register('ip-rules', IpAccessRuleViewSet, basename='ip-rule')
router.register('ip-blocked-attempts', IpBlockedAttemptViewSet, basename='ip-blocked-attempt')
router.register('document-series', DocumentNumberSeriesViewSet, basename='document-series')

urlpatterns = [
    path('dashboard/', SettingsDashboardView.as_view(), name='settings-dashboard'),
    path('categories/', SettingsCategoriesView.as_view(), name='settings-categories'),
    path('company/', CompanyProfileView.as_view(), name='settings-company'),
    path('category/<str:category>/', CategorySettingsView.as_view(), name='settings-category'),
    path('system/', SystemSettingsView.as_view(), name='settings-system'),
    path('payment/', PaymentSettingsView.as_view(), name='settings-payment'),
    path('accounts-summary/', AccountsSettingsSummaryView.as_view(), name='settings-accounts-summary'),
    path('maintenance/', SystemMaintenanceView.as_view(), name='settings-maintenance'),
    path('backups/', SystemBackupView.as_view(), name='settings-backups'),
    path('', include(router.urls)),
]
