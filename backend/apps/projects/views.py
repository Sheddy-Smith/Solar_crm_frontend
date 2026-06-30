from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from .models import (
    Project, ProjectActivity, ProjectNote, ProjectDocument, ProjectExpense, ProjectPayment, WorkOrder,
    ProjectTeamMember, ProjectSystemConfig, ProjectMilestone, SiteSurvey,
    ProjectChecklistItem, InstallationMaterial,
)
from .serializers import (
    ProjectListSerializer, ProjectDetailSerializer,
    ProjectActivitySerializer, ProjectNoteSerializer,
    ProjectDocumentSerializer, ProjectExpenseSerializer, ProjectPaymentSerializer, WorkOrderSerializer,
    ProjectTeamMemberSerializer, ProjectSystemConfigSerializer, ProjectMilestoneSerializer,
    SiteSurveySerializer, ProjectChecklistItemSerializer, InstallationMaterialSerializer,
)
from apps.accounts.permissions import HasModulePermission


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'project_type', 'manager', 'priority', 'lead']
    search_fields = ['project_name', 'customer_name', 'site', 'project_id', 'lead__ivrs_number', 'lead__mobile_number']
    ordering_fields = ['created_at', 'start_date', 'target_date', 'progress_percent']
    ordering = ['-created_at']

    def get_queryset(self):
        return Project.objects.select_related('manager', 'site_engineer', 'lead', 'created_by').prefetch_related(
            'activities__assigned_to',
            'notes__created_by',
            'documents__uploaded_by',
            'expenses__created_by',
            'payments__created_by',
            'work_orders__assignee',
            'team_members__user',
            'checklist_items__checked_by',
            'installation_materials__inventory_item',
            'milestones__owner',
            'milestones__children__owner',
        ).all()

    def get_serializer_class(self):
        if self.action in ('retrieve', 'update', 'partial_update'):
            return ProjectDetailSerializer
        return ProjectListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def update_progress(self, request, pk=None):
        project = self.get_object()
        try:
            progress = int(request.data.get('progress_percent', -1))
        except (ValueError, TypeError):
            progress = -1
        if not (0 <= progress <= 100):
            return Response({'error': 'progress_percent must be between 0 and 100'}, status=status.HTTP_400_BAD_REQUEST)
        project.progress_percent = progress
        project.save(update_fields=['progress_percent', 'updated_at'])
        return Response({'progress_percent': project.progress_percent})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = self.get_queryset()
        return Response({
            'total': qs.count(),
            'planning': qs.filter(status='Planning').count(),
            'active': qs.filter(status='Active').count(),
            'on_hold': qs.filter(status='On Hold').count(),
            'completed': qs.filter(status='Completed').count(),
            'cancelled': qs.filter(status='Cancelled').count(),
        })

    @action(detail=True, methods=['get', 'put'])
    def system_config(self, request, pk=None):
        project = self.get_object()
        config, _ = ProjectSystemConfig.objects.get_or_create(project=project)
        if request.method == 'GET':
            return Response(ProjectSystemConfigSerializer(config).data)
        serializer = ProjectSystemConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'put'])
    def site_survey(self, request, pk=None):
        project = self.get_object()
        survey, _ = SiteSurvey.objects.get_or_create(project=project)
        if request.method == 'GET':
            return Response(SiteSurveySerializer(survey).data)
        serializer = SiteSurveySerializer(survey, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ProjectActivityViewSet(viewsets.ModelViewSet):
    queryset = ProjectActivity.objects.select_related('project', 'assigned_to', 'created_by').all()
    serializer_class = ProjectActivitySerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'status', 'activity_type', 'assigned_to']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProjectNoteViewSet(viewsets.ModelViewSet):
    queryset = ProjectNote.objects.select_related('project', 'created_by').all()
    serializer_class = ProjectNoteSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'is_pinned']
    ordering = ['-is_pinned', '-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProjectDocumentViewSet(viewsets.ModelViewSet):
    queryset = ProjectDocument.objects.select_related('project', 'uploaded_by').all()
    serializer_class = ProjectDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'category']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class ProjectExpenseViewSet(viewsets.ModelViewSet):
    queryset = ProjectExpense.objects.select_related('project', 'created_by').all()
    serializer_class = ProjectExpenseSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'category']
    ordering = ['-date']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProjectPaymentViewSet(viewsets.ModelViewSet):
    queryset = ProjectPayment.objects.select_related('project', 'created_by').all()
    serializer_class = ProjectPaymentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'payment_mode']
    ordering = ['-payment_date']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class WorkOrderViewSet(viewsets.ModelViewSet):
    queryset = WorkOrder.objects.select_related('project', 'assignee', 'created_by').all()
    serializer_class = WorkOrderSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'status', 'assignee']
    search_fields = ['task', 'order_id', 'category']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProjectTeamMemberViewSet(viewsets.ModelViewSet):
    queryset = ProjectTeamMember.objects.select_related('project', 'user').all()
    serializer_class = ProjectTeamMemberSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'user']


class ProjectMilestoneViewSet(viewsets.ModelViewSet):
    queryset = ProjectMilestone.objects.select_related('project', 'owner', 'parent').all()
    serializer_class = ProjectMilestoneSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'status', 'parent']
    ordering = ['sequence', 'start_date']


class ProjectChecklistItemViewSet(viewsets.ModelViewSet):
    queryset = ProjectChecklistItem.objects.select_related('project', 'checked_by').all()
    serializer_class = ProjectChecklistItemSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'phase', 'is_checked']

    def perform_update(self, serializer):
        if serializer.validated_data.get('is_checked'):
            serializer.save(checked_by=self.request.user, checked_at=timezone.now())
        else:
            serializer.save(checked_by=None, checked_at=None)


class InstallationMaterialViewSet(viewsets.ModelViewSet):
    queryset = InstallationMaterial.objects.select_related('project', 'inventory_item').all()
    serializer_class = InstallationMaterialSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'status']
