from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProjectViewSet, ProjectActivityViewSet, ProjectNoteViewSet,
    ProjectDocumentViewSet, ProjectExpenseViewSet, ProjectPaymentViewSet, WorkOrderViewSet,
    ProjectTeamMemberViewSet, ProjectMilestoneViewSet,
    ProjectChecklistItemViewSet, InstallationMaterialViewSet, MaterialPlanViewSet,
    SubsidyApplicationViewSet, SubsidyDocumentViewSet,
)

router = DefaultRouter()
router.register('projects', ProjectViewSet, basename='project')
router.register('project-activities', ProjectActivityViewSet)
router.register('project-notes', ProjectNoteViewSet)
router.register('project-documents', ProjectDocumentViewSet)
router.register('project-expenses', ProjectExpenseViewSet)
router.register('project-payments', ProjectPaymentViewSet)
router.register('work-orders', WorkOrderViewSet)
router.register('project-team-members', ProjectTeamMemberViewSet)
router.register('project-milestones', ProjectMilestoneViewSet)
router.register('project-checklist-items', ProjectChecklistItemViewSet)
router.register('installation-materials', InstallationMaterialViewSet)
router.register('material-plans', MaterialPlanViewSet, basename='material-plan')
router.register('subsidy', SubsidyApplicationViewSet, basename='subsidy')
router.register('subsidy-docs', SubsidyDocumentViewSet, basename='subsidy-docs')

urlpatterns = [
    path('', include(router.urls)),
]
