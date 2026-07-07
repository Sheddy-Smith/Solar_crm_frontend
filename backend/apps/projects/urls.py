from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProjectViewSet, ProjectActivityViewSet, ProjectNoteViewSet,
    ProjectDocumentViewSet, ProjectExpenseViewSet, ProjectExpenseDocumentViewSet,
    ProjectPaymentViewSet, WorkOrderViewSet,
    ProjectTeamMemberViewSet, ProjectMilestoneViewSet,
    ProjectChecklistItemViewSet, InstallationMaterialViewSet, MaterialPlanViewSet,
    SubsidyApplicationViewSet, SubsidyDocumentViewSet,
    ProjectApprovalViewSet, ProjectApprovalDocumentViewSet, SiteSurveyPhotoViewSet, SiteSurveyViewSet,
)

router = DefaultRouter()
router.register('projects', ProjectViewSet, basename='project')
router.register('project-activities', ProjectActivityViewSet)
router.register('project-notes', ProjectNoteViewSet)
router.register('project-documents', ProjectDocumentViewSet)
router.register('project-expenses', ProjectExpenseViewSet, basename='project-expense')
router.register('project-payments', ProjectPaymentViewSet)
router.register('work-orders', WorkOrderViewSet)
router.register('project-team-members', ProjectTeamMemberViewSet)
router.register('project-milestones', ProjectMilestoneViewSet)
router.register('project-checklist-items', ProjectChecklistItemViewSet)
router.register('installation-materials', InstallationMaterialViewSet)
router.register('material-plans', MaterialPlanViewSet, basename='material-plan')
router.register('subsidy', SubsidyApplicationViewSet, basename='subsidy')
router.register('subsidy-docs', SubsidyDocumentViewSet, basename='subsidy-docs')
router.register('expense-docs', ProjectExpenseDocumentViewSet, basename='expense-docs')
router.register('project-approvals', ProjectApprovalViewSet, basename='project-approval')
router.register('approval-docs', ProjectApprovalDocumentViewSet, basename='approval-docs')
router.register('site-survey-photos', SiteSurveyPhotoViewSet, basename='site-survey-photos')
router.register('site-surveys', SiteSurveyViewSet, basename='site-survey')

urlpatterns = [
    path('', include(router.urls)),
]
