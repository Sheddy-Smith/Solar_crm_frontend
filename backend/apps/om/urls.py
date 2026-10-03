from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OmAssetViewSet, OmMaintenanceTaskViewSet, OmBreakdownTicketViewSet,
    OmSiteVisitViewSet, OmSparePartViewSet, OmReportViewSet, OmDocumentViewSet,
    OmPlantViewSet, OmVisitPartViewSet, OmInsuranceViewSet, OmDashboardView, OmEngineersView,
)
from .pending_views import PendingFlowViewSet

router = DefaultRouter()
router.register('pending', PendingFlowViewSet, basename='om-pending')
router.register('plants', OmPlantViewSet, basename='om-plant')
router.register('assets', OmAssetViewSet, basename='om-asset')
router.register('maintenance-tasks', OmMaintenanceTaskViewSet, basename='om-task')
router.register('tickets', OmBreakdownTicketViewSet, basename='om-ticket')
router.register('site-visits', OmSiteVisitViewSet, basename='om-visit')
router.register('visit-parts', OmVisitPartViewSet, basename='om-visit-part')
router.register('insurance', OmInsuranceViewSet, basename='om-insurance')
router.register('spare-parts', OmSparePartViewSet, basename='om-part')
router.register('reports', OmReportViewSet, basename='om-report')
router.register('documents', OmDocumentViewSet, basename='om-document')

urlpatterns = [
    path('dashboard/', OmDashboardView.as_view(), name='om-dashboard'),
    path('engineers/', OmEngineersView.as_view(), name='om-engineers'),
    path('', include(router.urls)),
]
