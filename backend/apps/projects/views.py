from rest_framework import viewsets, status, filters
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Count, Q
from .models import (
    Project, ProjectActivity, ProjectNote, ProjectDocument, ProjectExpense, ProjectPayment, WorkOrder,
    ProjectTeamMember, ProjectSystemConfig, ProjectMilestone, SiteSurvey, SiteSurveyPhoto,
    ProjectChecklistItem, InstallationMaterial, MaterialPlan, SubsidyApplication, SubsidyDocument,
    ProjectExpenseDocument, ProjectApproval, ProjectApprovalDocument,
)
from .serializers import (
    ProjectListSerializer, ProjectDetailSerializer,
    ProjectActivitySerializer, ProjectNoteSerializer,
    ProjectDocumentSerializer, ProjectExpenseSerializer, ProjectPaymentSerializer, WorkOrderSerializer,
    ProjectTeamMemberSerializer, ProjectSystemConfigSerializer, ProjectMilestoneSerializer,
    SiteSurveySerializer, SiteSurveyListSerializer, SiteSurveyPhotoSerializer, ProjectChecklistItemSerializer, InstallationMaterialSerializer,
    MaterialPlanSerializer, SubsidyApplicationSerializer, SubsidyDocumentSerializer,
    ProjectExpenseDocumentSerializer, ProjectApprovalSerializer, ProjectApprovalDocumentSerializer,
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
        return Project.objects.select_related('manager', 'site_engineer', 'lead', 'created_by', 'site_survey', 'site_survey__surveyed_by').prefetch_related(
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


class SiteSurveyViewSet(viewsets.ReadOnlyModelViewSet):
    # Read-only across all projects, for the office-wide Survey Dashboard.
    # Editing a survey always goes through /projects/{id}/site_survey/ — one
    # write path keeps the OneToOne get-or-create semantics unambiguous.
    queryset = SiteSurvey.objects.select_related('project', 'project__lead', 'surveyed_by').prefetch_related('photos').all()
    serializer_class = SiteSurveyListSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'surveyed_by']
    ordering_fields = ['survey_date', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SiteSurveySerializer
        return SiteSurveyListSerializer

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = self.get_queryset()
        engineer_stats = list(
            qs.filter(surveyed_by__isnull=False)
            .values('surveyed_by__name')
            .annotate(
                total=Count('id'),
                completed=Count('id', filter=Q(status='Completed')),
                in_progress=Count('id', filter=Q(status='In Progress')),
                pending=Count('id', filter=Q(status='Pending')),
            )
            .order_by('-total')
        )
        for row in engineer_stats:
            row['name'] = row.pop('surveyed_by__name') or 'Unassigned'
        return Response({
            'total': qs.count(),
            'pending': qs.filter(status='Pending').count(),
            'in_progress': qs.filter(status='In Progress').count(),
            'completed': qs.filter(status='Completed').count(),
            'engineer_stats': engineer_stats,
        })


class SiteSurveyPhotoViewSet(viewsets.ModelViewSet):
    queryset = SiteSurveyPhoto.objects.select_related('survey', 'survey__project', 'uploaded_by').all()
    serializer_class = SiteSurveyPhotoSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['survey', 'slot']

    def create(self, request, *args, **kwargs):
        # Each checklist slot holds exactly one photo — uploading again for the
        # same slot replaces it instead of erroring on the unique constraint.
        survey_id = request.data.get('survey')
        slot = request.data.get('slot')
        existing = SiteSurveyPhoto.objects.filter(survey_id=survey_id, slot=slot).first()
        if existing:
            serializer = self.get_serializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save(uploaded_by=request.user)
            return Response(serializer.data)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class ProjectExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectExpenseSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'category', 'status']
    search_fields = ['description', 'paid_by', 'project__project_name', 'project__customer_name']
    ordering = ['-date']

    def get_queryset(self):
        qs = ProjectExpense.objects.select_related('project', 'created_by').prefetch_related('expense_documents').all()
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        from django.db.models import Sum, Count
        from decimal import Decimal
        # filter_queryset applies project/category/status query params too —
        # get_queryset alone only handles the manual date range.
        qs = self.filter_queryset(self.get_queryset())
        total_expenses = qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        material = qs.filter(category='Materials').aggregate(t=Sum('amount'))['t'] or Decimal('0')
        labour = qs.filter(category='Labor').aggregate(t=Sum('amount'))['t'] or Decimal('0')
        transport = qs.filter(category='Transport').aggregate(t=Sum('amount'))['t'] or Decimal('0')
        equipment = qs.filter(category='Equipment').aggregate(t=Sum('amount'))['t'] or Decimal('0')
        misc = qs.filter(category='Miscellaneous').aggregate(t=Sum('amount'))['t'] or Decimal('0')
        other = total_expenses - material - labour - transport - equipment - misc
        project_ids = qs.values('project').distinct().count()
        budget_qs = Project.objects.all()
        project_id = request.query_params.get('project')
        if project_id:
            budget_qs = budget_qs.filter(pk=project_id)
        total_budget = budget_qs.aggregate(b=Sum('total_value'))['b'] or Decimal('0')
        return Response({
            'total_projects': project_ids,
            'total_budget': float(total_budget),
            'total_expenses': float(total_expenses),
            'material_cost': float(material),
            'labour_cost': float(labour),
            'transport_cost': float(transport),
            'equipment_cost': float(equipment),
            'misc_cost': float(misc),
            'other_expenses': float(other),
        })


class ProjectExpenseDocumentViewSet(viewsets.ModelViewSet):
    queryset = ProjectExpenseDocument.objects.select_related('expense').all()
    serializer_class = ProjectExpenseDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['expense', 'doc_type']


class ProjectPaymentViewSet(viewsets.ModelViewSet):
    queryset = ProjectPayment.objects.select_related('project', 'created_by').all()
    serializer_class = ProjectPaymentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'payment_mode']
    ordering = ['-payment_date']

    def perform_create(self, serializer):
        project_payment = serializer.save(created_by=self.request.user)
        from apps.accounts_module.services import sync_project_payment_to_accounts
        sync_project_payment_to_accounts(project_payment, self.request.user)

    def perform_update(self, serializer):
        project_payment = serializer.save()
        from apps.accounts_module.services import sync_project_payment_to_accounts
        sync_project_payment_to_accounts(project_payment, self.request.user)

    def perform_destroy(self, instance):
        from apps.accounts_module.services import remove_accounts_payment_for_project_payment
        remove_accounts_payment_for_project_payment(instance)
        instance.delete()


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
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['project', 'user', 'status']
    search_fields = ['user__name', 'role_title']

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        project_id = request.query_params.get('project')
        qs = ProjectTeamMember.objects.all()
        if project_id:
            qs = qs.filter(project_id=project_id)
        return Response({
            'total': qs.count(),
            'active': qs.filter(status='Active').count(),
            'on_site': qs.filter(status='On Site').count(),
            'off_site': qs.filter(status='Off Site').count(),
            'on_leave': qs.filter(status='On Leave').count(),
        })


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


class MaterialPlanViewSet(viewsets.ModelViewSet):
    queryset = MaterialPlan.objects.select_related('project').all()
    serializer_class = MaterialPlanSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['project', 'status', 'category']
    search_fields = ['category', 'items']

    def get_queryset(self):
        qs = MaterialPlan.objects.select_related('project').all()
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        qs = self._filtered_qs(request)
        total = qs.count()
        return Response({
            'total': total,
            'not_started': qs.filter(status='Not Started').count(),
            'in_progress': qs.filter(status='In Progress').count(),
            'partially_completed': qs.filter(status='Partially Completed').count(),
            'completed': qs.filter(status='Completed').count(),
            'delayed': qs.filter(status='Delayed').count(),
        })

    @action(detail=False, methods=['get'], url_path='status-overview')
    def status_overview(self, request):
        qs = self._filtered_qs(request)
        labels = ['Not Started', 'In Progress', 'Partially Completed', 'Completed', 'Delayed']
        values = [qs.filter(status=s).count() for s in labels]
        return Response({'labels': labels, 'values': values})

    def _filtered_qs(self, request):
        qs = MaterialPlan.objects.all()
        project_id = request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class SubsidyApplicationViewSet(viewsets.ModelViewSet):
    queryset = SubsidyApplication.objects.select_related('project').prefetch_related('documents').all()
    serializer_class = SubsidyApplicationSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['project', 'status']
    search_fields = ['application_number', 'assigned_employee__name', 'discom']

    def get_queryset(self):
        qs = SubsidyApplication.objects.select_related('project').prefetch_related('documents').all()
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        project_id = request.query_params.get('project')
        qs = SubsidyApplication.objects.all()
        if project_id:
            qs = qs.filter(project_id=project_id)
        return Response({
            'total': qs.count(),
            'submitted': qs.filter(status='Submitted').count(),
            'under_process': qs.filter(status='Under Process').count(),
            'approved': qs.filter(status='Approved').count(),
            'rejected': qs.filter(status='Rejected').count(),
            'completed': qs.filter(status='Completed').count(),
        })


class SubsidyDocumentViewSet(viewsets.ModelViewSet):
    queryset = SubsidyDocument.objects.select_related('subsidy').all()
    serializer_class = SubsidyDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['subsidy', 'doc_type']


class ProjectApprovalViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectApprovalSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'status', 'approval_type', 'priority']
    search_fields = ['subject', 'requested_by', 'project__project_name']
    ordering = ['-created_at']

    def get_queryset(self):
        return ProjectApproval.objects.select_related(
            'project', 'created_by', 'assigned_to', 'approved_by'
        ).prefetch_related('documents').all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        approval = self.get_object()
        approval.status = 'Approved'
        approval.approved_by = request.user
        approval.approved_at = timezone.now()
        approval.rejection_reason = ''
        approval.save()
        return Response(self.get_serializer(approval).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        approval = self.get_object()
        approval.status = 'Rejected'
        approval.approved_by = request.user
        approval.approved_at = timezone.now()
        approval.rejection_reason = request.data.get('reason', '')
        approval.save()
        return Response(self.get_serializer(approval).data)


class ProjectApprovalDocumentViewSet(viewsets.ModelViewSet):
    queryset = ProjectApprovalDocument.objects.select_related('approval').all()
    serializer_class = ProjectApprovalDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['approval']
