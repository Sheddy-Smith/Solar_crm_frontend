from rest_framework import viewsets, status, filters
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Count, F, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from .models import (
    Project, ProjectActivity, ProjectNote, ProjectDocument, ProjectPayment, WorkOrder,
    ProjectTeamMember, ProjectSystemConfig, ProjectMilestone, SiteSurvey, SiteSurveyPhoto,
    ProjectChecklistItem, InstallationMaterial, MaterialPlan, SubsidyApplication, SubsidyDocument,
    ProjectApproval, ProjectApprovalDocument, JobSheet,
    ProjectPipelineStage, PM_STAGES, PM_STAGE_COMPLETED,
)
from .serializers import (
    JobSheetSerializer, PmPipelineProjectSerializer,
    ProjectListSerializer, ProjectDetailSerializer,
    ProjectActivitySerializer, ProjectNoteSerializer,
    ProjectDocumentSerializer, ProjectPaymentSerializer, WorkOrderSerializer,
    ProjectTeamMemberSerializer, ProjectSystemConfigSerializer, ProjectMilestoneSerializer,
    SiteSurveySerializer, SiteSurveyListSerializer, SiteSurveyPhotoSerializer, ProjectChecklistItemSerializer, InstallationMaterialSerializer,
    MaterialPlanSerializer, SubsidyApplicationSerializer, SubsidyDocumentSerializer,
    ProjectApprovalSerializer, ProjectApprovalDocumentSerializer,
)
from apps.accounts.permissions import HasModulePermission, is_lead_scoped, lead_owner_filter
from apps.leads.recycle import soft_delete_project


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'project_type', 'manager', 'priority', 'lead']
    search_fields = ['project_name', 'customer_name', 'site', 'project_id', 'lead__ivrs_number', 'lead__mobile_number']
    ordering_fields = ['created_at', 'start_date', 'target_date', 'progress_percent']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = Project.objects.select_related(
            'manager', 'site_engineer', 'lead', 'lead__assigned_to', 'created_by',
            'site_survey', 'site_survey__surveyed_by', 'pm_stage_tracker',
        ).prefetch_related(
            'activities__assigned_to',
            'notes__created_by',
            'documents__uploaded_by',
            'payments__created_by',
            'work_orders__assignee',
            'team_members__user',
            'checklist_items__checked_by',
            'installation_materials__inventory_item',
            'material_plans',
            'milestones__owner',
            'milestones__children__owner',
        ).filter(is_deleted=False).filter(Q(lead__isnull=True) | Q(lead__is_deleted=False))
        # Sales / Tele Sales Executives see only projects born from their own leads
        filt = lead_owner_filter(self.request.user, prefix='lead__')
        if filt:
            qs = qs.filter(**filt)
        return qs

    def get_serializer_class(self):
        if self.action in ('retrieve', 'update', 'partial_update'):
            return ProjectDetailSerializer
        return ProjectListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        """Keep Won-lead Team Assignment (lead.assigned_to) in sync with sales_executive.

        Project Details Update "Assigned Employee" maps to Team Assignment on the
        list, which reads lead.assigned_to. Sales Manager often has Project
        Management → Edit without Lead → Edit/Assign; syncing here lets that
        field save via the project PATCH alone.
        """
        prev_se_id = serializer.instance.sales_executive_id
        project = serializer.save()
        if 'sales_executive' not in serializer.validated_data:
            return
        if project.sales_executive_id == prev_se_id:
            return
        lead = project.lead
        if not lead or lead.is_deleted:
            return
        if project.sales_executive_id is not None:
            from apps.accounts.models import User
            se = User.objects.select_related('role').filter(pk=project.sales_executive_id).first()
            role_name = getattr(getattr(se, 'role', None), 'name', '') or ''
            # Match lead assign rules: block Tele Sales Executive only.
            if role_name == 'Tele Sales Executive':
                return
        if lead.assigned_to_id != project.sales_executive_id:
            lead.assigned_to_id = project.sales_executive_id
            lead.save(update_fields=['assigned_to', 'updated_at'])

    def perform_destroy(self, instance):
        soft_delete_project(instance, self.request.user)

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

    @action(detail=True, methods=['get'], url_path='pnl')
    def pnl(self, request, pk=None):
        """Project P&L: revenue, actual material cost, labour, expenses, planning difference."""
        from apps.accounts_module.project_financial_sync import project_pnl
        project = self.get_object()
        return Response(project_pnl(project))

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
        survey, created = SiteSurvey.objects.get_or_create(project=project)
        if created:
            survey.material_checklist = SiteSurvey.default_material_checklist()
            survey.save(update_fields=['material_checklist'])
        if request.method == 'GET':
            return Response(SiteSurveySerializer(survey, context={'request': request}).data)
        # Avoid wiping ImageField when client sends JSON without a file.
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if not request.FILES.get('site_drawing'):
            data.pop('site_drawing', None)
        serializer = SiteSurveySerializer(survey, data=data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ProjectActivityViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectActivitySerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'status', 'activity_type', 'assigned_to']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = ProjectActivity.objects.select_related('project', 'assigned_to', 'created_by').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProjectNoteViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectNoteSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'is_pinned']
    ordering = ['-is_pinned', '-created_at']

    def get_queryset(self):
        qs = ProjectNote.objects.select_related('project', 'created_by').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProjectDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'category']

    def get_queryset(self):
        qs = ProjectDocument.objects.select_related('project', 'uploaded_by').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs

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


class ProjectPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectPaymentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'payment_mode']
    ordering = ['-payment_date']

    def get_queryset(self):
        qs = ProjectPayment.objects.select_related('project', 'created_by').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs

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
    serializer_class = WorkOrderSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'status', 'assignee']
    search_fields = ['task', 'order_id', 'category']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = WorkOrder.objects.select_related('project', 'assignee', 'created_by').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class JobSheetViewSet(viewsets.ModelViewSet):
    serializer_class = JobSheetSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    permission_action_map = {'generate_work_orders': 'can_add'}
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'status']
    search_fields = ['job_sheet_no', 'project__project_id', 'project__project_name', 'project__customer_name']
    ordering = ['-updated_at']

    def get_queryset(self):
        qs = JobSheet.objects.select_related('project', 'project__manager', 'created_by').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        if filt:
            qs = qs.filter(**filt)
        params = self.request.query_params
        if params.get('project_code'):
            qs = qs.filter(project__project_id__icontains=params['project_code'].strip())
        if params.get('customer'):
            qs = qs.filter(project__customer_name__icontains=params['customer'].strip())
        if params.get('date_from'):
            qs = qs.filter(updated_at__date__gte=params['date_from'])
        if params.get('date_to'):
            qs = qs.filter(updated_at__date__lte=params['date_to'])
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='generate-work-orders')
    def generate_work_orders(self, request, pk=None):
        sheet = self.get_object()
        created, linked, skipped = 0, 0, 0

        def process(rows):
            nonlocal created, linked, skipped
            out = []
            for row in rows or []:
                row = dict(row) if isinstance(row, dict) else row
                if not isinstance(row, dict):
                    continue
                work = str(row.get('work') or '').strip()[:200]
                if not work or not row.get('work_order_type') or not row.get('assignee_name'):
                    skipped += 1
                    out.append(row)
                    continue
                note_parts = [f"{row['work_order_type']}: {row['assignee_name']}", f'Job Sheet: {sheet.job_sheet_no}']
                if row.get('notes'):
                    note_parts.append(str(row['notes']))
                order, was_created = WorkOrder.objects.get_or_create(
                    project=sheet.project,
                    task=work,
                    defaults={
                        'category': str(row.get('category') or '')[:100],
                        'start_date': timezone.localdate(),
                        'notes': '\n'.join(note_parts),
                        'created_by': request.user,
                    },
                )
                if was_created:
                    created += 1
                else:
                    linked += 1
                row['work_order_no'] = order.order_id
                out.append(row)
            return out

        sheet.items = process(sheet.items)
        sheet.extra_items = process(sheet.extra_items)
        sheet.work_orders_generated_at = timezone.now()
        sheet.save()
        data = self.get_serializer(sheet).data
        return Response({'created': created, 'linked': linked, 'skipped': skipped, 'job_sheet': data})


class ProjectTeamMemberViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectTeamMemberSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['project', 'user', 'status']
    search_fields = ['user__name', 'role_title']

    def get_queryset(self):
        qs = ProjectTeamMember.objects.select_related('project', 'user').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        project_id = request.query_params.get('project')
        qs = self.get_queryset()
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
    serializer_class = ProjectMilestoneSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'status', 'parent']
    ordering = ['sequence', 'start_date']

    def get_queryset(self):
        qs = ProjectMilestone.objects.select_related('project', 'owner', 'parent').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs


class ProjectChecklistItemViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectChecklistItemSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'phase', 'is_checked']

    def get_queryset(self):
        qs = ProjectChecklistItem.objects.select_related('project', 'checked_by').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs

    def perform_update(self, serializer):
        if serializer.validated_data.get('is_checked'):
            serializer.save(checked_by=self.request.user, checked_at=timezone.now())
        else:
            serializer.save(checked_by=None, checked_at=None)


class InstallationMaterialViewSet(viewsets.ModelViewSet):
    serializer_class = InstallationMaterialSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'status']

    def get_queryset(self):
        qs = InstallationMaterial.objects.select_related('project', 'inventory_item').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs


class MaterialPlanViewSet(viewsets.ModelViewSet):
    queryset = MaterialPlan.objects.select_related('project', 'inventory_item').all()
    serializer_class = MaterialPlanSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['project', 'status', 'category', 'dispatch_status']
    search_fields = ['category', 'items']
    permission_action_map = {'mark_packed': 'can_edit'}

    def get_queryset(self):
        qs = MaterialPlan.objects.select_related('project', 'inventory_item').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        if filt:
            qs = qs.filter(**filt)
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def perform_destroy(self, instance):
        from apps.accounts_module.project_financial_sync import remove_accounts_for_material_plan
        remove_accounts_for_material_plan(instance)
        if instance.stock_movement_id:
            movement = instance.stock_movement
            instance.stock_movement = None
            instance.save(update_fields=['stock_movement'])
            movement.delete()
        instance.delete()

    @action(detail=False, methods=['post'], url_path='mark-packed')
    def mark_packed(self, request):
        """Mark a project's not-yet-sent lines Packed (packed=false → back to Pending)."""
        project_id = request.data.get('project')
        if not project_id:
            return Response({'project': 'Select a project.'}, status=status.HTTP_400_BAD_REQUEST)
        packed = str(request.data.get('packed', True)).strip().lower() not in ('0', 'false', 'no')
        plans = self.get_queryset().filter(project_id=project_id)
        line_ids = request.data.get('lines')
        if line_ids:
            plans = plans.filter(pk__in=line_ids)
        now = timezone.now()
        updated = 0
        for plan in plans:
            if MaterialPlan.parse_qty(plan.dispatched_qty) > 0:
                continue
            target = 'Packed' if packed else 'Pending'
            if plan.dispatch_status == target:
                continue
            plan.dispatch_status = target
            plan.packed_at = (plan.packed_at or now) if packed else None
            plan.save(update_fields=['dispatch_status', 'packed_at', 'updated_at'])
            updated += 1
        return Response({'updated': updated})

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
        filt = lead_owner_filter(request.user, prefix='project__lead__')
        if filt:
            qs = qs.filter(**filt)
        project_id = request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class SubsidyApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = SubsidyApplicationSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['project', 'status']
    search_fields = ['application_number', 'assigned_employee__name', 'discom']

    def get_queryset(self):
        qs = SubsidyApplication.objects.select_related('project').prefetch_related('documents').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        if filt:
            qs = qs.filter(**filt)
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        project_id = request.query_params.get('project')
        qs = self.get_queryset()
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
    serializer_class = SubsidyDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['subsidy', 'doc_type']

    def get_queryset(self):
        qs = SubsidyDocument.objects.select_related('subsidy').all()
        filt = lead_owner_filter(self.request.user, prefix='subsidy__project__lead__')
        return qs.filter(**filt) if filt else qs


class ProjectApprovalViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectApprovalSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'status', 'approval_type', 'priority']
    search_fields = ['subject', 'requested_by', 'project__project_name']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = ProjectApproval.objects.select_related(
            'project', 'created_by', 'assigned_to', 'approved_by'
        ).prefetch_related('documents').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs

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
    serializer_class = ProjectApprovalDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['approval']

    def get_queryset(self):
        qs = ProjectApprovalDocument.objects.select_related('approval').all()
        filt = lead_owner_filter(self.request.user, prefix='approval__project__lead__')
        return qs.filter(**filt) if filt else qs


def _count_subquery(qs, field='project', outer='pk'):
    sq = qs.filter(**{field: OuterRef(outer)}).order_by().values(field).annotate(c=Count('id')).values('c')[:1]
    return Coalesce(Subquery(sq, output_field=IntegerField()), Value(0))


class PmPipelineViewSet(viewsets.ReadOnlyModelViewSet):
    """Won-lead projects moving through the Project Management pipeline
    (Site Survey -> Quotation -> ... -> Invoice -> Completed)."""

    serializer_class = PmPipelineProjectSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    permission_action_map = {'advance': 'can_edit', 'set_stage': 'can_edit'}
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['project_id', 'project_name', 'customer_name', 'city', 'lead__mobile_number']
    ordering = ['-created_at']

    def get_queryset(self):
        from apps.accounts_module.models import SellChallan, SellInvoice
        from apps.leads.models import Quotation

        qs = (
            Project.objects.filter(lead__status='Won', lead__is_deleted=False, is_deleted=False)
            .select_related('lead', 'manager', 'pm_stage_tracker')
            .annotate(
                pm_stage=Coalesce('pm_stage_tracker__stage', Value(PM_STAGES[0])),
                survey_state=F('site_survey__status'),
                job_sheet_state=F('job_sheet__status'),
                quotations_count=_count_subquery(Quotation.objects.filter(is_deleted=False), field='lead', outer='lead'),
                material_count=_count_subquery(MaterialPlan.objects.all()),
                dispatched_count=_count_subquery(MaterialPlan.objects.filter(dispatch_status='Dispatched')),
                challans_count=_count_subquery(SellChallan.objects.exclude(status='Cancelled')),
                invoices_count=_count_subquery(SellInvoice.objects.exclude(status='Cancelled')),
            )
        )
        filt = lead_owner_filter(self.request.user, prefix='lead__')
        if filt:
            qs = qs.filter(**filt)
        stage = self.request.query_params.get('stage')
        if stage:
            qs = qs.filter(pm_stage=stage)
        return qs

    def _respond(self, project_pk):
        return Response(self.get_serializer(self.get_queryset().get(pk=project_pk)).data)

    def _move(self, request, project, new_stage, kind):
        tracker, _ = ProjectPipelineStage.objects.get_or_create(project=project)
        tracker.history = [*(tracker.history or []), {
            'from': tracker.stage,
            'to': new_stage,
            'action': kind,
            'by': (request.user.name or request.user.email) if request.user else '',
            'at': timezone.now().isoformat(),
        }]
        tracker.stage = new_stage
        tracker.updated_by = request.user
        tracker.save()
        return self._respond(project.pk)

    @action(detail=True, methods=['post'], url_path='advance')
    def advance(self, request, pk=None):
        project = self.get_object()
        current = project.pm_stage
        expected = request.data.get('from_stage')
        if expected and expected != current:
            return Response(
                {'detail': f'Project is already at "{current}".', 'pm_stage': current},
                status=status.HTTP_409_CONFLICT,
            )
        if current not in PM_STAGES:
            return Response({'detail': 'All project stages are already completed.'}, status=status.HTTP_400_BAD_REQUEST)
        idx = PM_STAGES.index(current)
        new_stage = PM_STAGES[idx + 1] if idx + 1 < len(PM_STAGES) else PM_STAGE_COMPLETED
        return self._move(request, project, new_stage, 'done')

    @action(detail=True, methods=['post'], url_path='set-stage')
    def set_stage(self, request, pk=None):
        project = self.get_object()
        new_stage = request.data.get('stage')
        if new_stage not in [*PM_STAGES, PM_STAGE_COMPLETED]:
            return Response({'detail': 'Invalid stage.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_stage == project.pm_stage:
            return self._respond(project.pk)
        return self._move(request, project, new_stage, 'set')
