from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProjectViewSet, ProjectActivityViewSet, ProjectNoteViewSet,
    ProjectDocumentViewSet,
    ProjectPaymentViewSet, WorkOrderViewSet,
    ProjectTeamMemberViewSet, ProjectMilestoneViewSet,
    ProjectChecklistItemViewSet, InstallationMaterialViewSet, MaterialPlanViewSet,
    SubsidyApplicationViewSet, SubsidyDocumentViewSet,
    ProjectApprovalViewSet, ProjectApprovalDocumentViewSet, SiteSurveyPhotoViewSet, SiteSurveyViewSet,
    JobSheetViewSet, PmPipelineViewSet,
)
from .billing_views import ProjectSalesChallanViewSet, ProjectInvoiceViewSet

router = DefaultRouter()
router.register('project-pipeline', PmPipelineViewSet, basename='project-pipeline')
router.register('projects', ProjectViewSet, basename='project')
router.register('project-activities', ProjectActivityViewSet, basename='project-activity')
router.register('project-notes', ProjectNoteViewSet, basename='project-note')
router.register('project-documents', ProjectDocumentViewSet, basename='project-document')
router.register('project-payments', ProjectPaymentViewSet, basename='project-payment')
router.register('work-orders', WorkOrderViewSet, basename='work-order')
router.register('project-team-members', ProjectTeamMemberViewSet, basename='project-team-member')
router.register('project-milestones', ProjectMilestoneViewSet, basename='project-milestone')
router.register('project-checklist-items', ProjectChecklistItemViewSet, basename='project-checklist-item')
router.register('installation-materials', InstallationMaterialViewSet, basename='installation-material')
router.register('material-plans', MaterialPlanViewSet, basename='material-plan')
router.register('job-sheets', JobSheetViewSet, basename='job-sheet')
router.register('project-sales-challans', ProjectSalesChallanViewSet, basename='project-sales-challan')
router.register('project-invoices', ProjectInvoiceViewSet, basename='project-invoice')
router.register('subsidy', SubsidyApplicationViewSet, basename='subsidy')
router.register('subsidy-docs', SubsidyDocumentViewSet, basename='subsidy-docs')
router.register('project-approvals', ProjectApprovalViewSet, basename='project-approval')
router.register('approval-docs', ProjectApprovalDocumentViewSet, basename='approval-docs')
router.register('site-survey-photos', SiteSurveyPhotoViewSet, basename='site-survey-photos')
router.register('site-surveys', SiteSurveyViewSet, basename='site-survey')

urlpatterns = [
    path('', include(router.urls)),
]
