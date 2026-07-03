from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OmAssetViewSet, OmMaintenanceTaskViewSet, OmBreakdownTicketViewSet,
    OmSiteVisitViewSet, OmSparePartViewSet, OmReportViewSet, OmDocumentViewSet,
)

router = DefaultRouter()
router.register('assets', OmAssetViewSet, basename='om-asset')
router.register('maintenance-tasks', OmMaintenanceTaskViewSet, basename='om-task')
router.register('tickets', OmBreakdownTicketViewSet, basename='om-ticket')
router.register('site-visits', OmSiteVisitViewSet, basename='om-visit')
router.register('spare-parts', OmSparePartViewSet, basename='om-part')
router.register('reports', OmReportViewSet, basename='om-report')
router.register('documents', OmDocumentViewSet, basename='om-document')

urlpatterns = [
    path('', include(router.urls)),
]
