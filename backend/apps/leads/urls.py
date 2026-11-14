from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeadViewSet, FollowUpViewSet, AdminApprovalViewSet, QuotationViewSet, LeadSurveyPhotoViewSet
from .module_sync_views import (
    ModuleSyncHistoryViewSet,
    ModuleSyncPreviewView,
    ModuleSyncReportTypesView,
    ModuleSyncRunView,
)

router = DefaultRouter()
router.register('leads', LeadViewSet, basename='lead')
router.register('follow-ups', FollowUpViewSet)
router.register('admin-approvals', AdminApprovalViewSet)
router.register('quotations', QuotationViewSet)
router.register('lead-survey-photos', LeadSurveyPhotoViewSet)
router.register('module-sync/history', ModuleSyncHistoryViewSet, basename='module-sync-history')

urlpatterns = [
    path('module-sync/report-types/', ModuleSyncReportTypesView.as_view(), name='module-sync-report-types'),
    path('module-sync/preview/', ModuleSyncPreviewView.as_view(), name='module-sync-preview'),
    path('module-sync/run/', ModuleSyncRunView.as_view(), name='module-sync-run'),
    path('', include(router.urls)),
]
