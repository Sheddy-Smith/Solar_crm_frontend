from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LiaisonApplicationViewSet, LiaisonApprovalViewSet, LiaisonInspectionViewSet,
    LiaisonCommissioningViewSet, LiaisonComplianceViewSet, LiaisonDocumentViewSet,
    LiaisonAgreementViewSet, LiaisonNetMeterViewSet, LiaisonLoanProcessViewSet,
    LiaisonInspectionPlacedViewSet, LiaisonProjectViewSet,
)

router = DefaultRouter()
router.register('applications', LiaisonApplicationViewSet, basename='lc-application')
router.register('approvals', LiaisonApprovalViewSet, basename='lc-approval')
router.register('inspections', LiaisonInspectionViewSet, basename='lc-inspection')
router.register('commissionings', LiaisonCommissioningViewSet, basename='lc-commissioning')
router.register('compliances', LiaisonComplianceViewSet, basename='lc-compliance')
router.register('documents', LiaisonDocumentViewSet, basename='lc-document')
router.register('loan-processes', LiaisonLoanProcessViewSet, basename='lc-loan-process')
router.register('inspections-placed', LiaisonInspectionPlacedViewSet, basename='lc-inspection-placed')
router.register('agreements', LiaisonAgreementViewSet, basename='lc-agreement')
router.register('net-meters', LiaisonNetMeterViewSet, basename='lc-net-meter')
router.register('projects', LiaisonProjectViewSet, basename='lc-project')

urlpatterns = [
    path('', include(router.urls)),
]
