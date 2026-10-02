from rest_framework import viewsets, filters, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from apps.projects.models import Project, SubsidyApplication
from .models import (
    LiaisonApplication, LiaisonApproval, LiaisonInspection,
    LiaisonCommissioning, LiaisonCompliance, LiaisonDocument,
    LiaisonAgreement, LiaisonNetMeter, LiaisonProjectStage,
    LIAISON_STAGES, LIAISON_STAGE_COMPLETED,
)
from .serializers import (
    LiaisonApplicationSerializer, LiaisonApprovalSerializer, LiaisonInspectionSerializer,
    LiaisonCommissioningSerializer, LiaisonComplianceSerializer, LiaisonDocumentSerializer,
    LiaisonAgreementSerializer, LiaisonNetMeterSerializer, LiaisonProjectSerializer,
)
from apps.accounts.permissions import HasModulePermission, lead_owner_filter


class LiaisonBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Liaisoning & Commissioning'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _scope(self, qs, prefix='project__lead__'):
        # Sales / Tele Sales Executives only see liaisoning records tied to
        # their own leads' projects.
        filt = lead_owner_filter(self.request.user, prefix=prefix)
        return qs.filter(**filt) if filt else qs


class LiaisonApplicationViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonApplicationSerializer
    filterset_fields = ['project', 'status', 'application_type']
    search_fields = ['application_number', 'discom', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return self._scope(LiaisonApplication.objects.select_related('project', 'created_by').all())


class LiaisonApprovalViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonApprovalSerializer
    filterset_fields = ['project', 'status', 'approval_type']
    search_fields = ['approval_type', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return self._scope(LiaisonApproval.objects.select_related('project', 'created_by', 'assigned_to', 'approved_by').all())

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


class LiaisonInspectionViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonInspectionSerializer
    filterset_fields = ['project', 'status']
    search_fields = ['inspector', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return self._scope(LiaisonInspection.objects.select_related('project', 'created_by').all())


class LiaisonCommissioningViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonCommissioningSerializer
    filterset_fields = ['project', 'status']
    search_fields = ['engineer', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return self._scope(LiaisonCommissioning.objects.select_related('project', 'created_by').all())


class LiaisonComplianceViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonComplianceSerializer
    filterset_fields = ['project', 'status', 'compliance_type']
    search_fields = ['compliance_type', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return self._scope(LiaisonCompliance.objects.select_related('project', 'created_by').all())


class LiaisonDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = LiaisonDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Liaisoning & Commissioning'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['project', 'module', 'related_id', 'doc_type']
    search_fields = ['name', 'project__project_name']

    def get_queryset(self):
        qs = LiaisonDocument.objects.select_related('project', 'uploaded_by').all()
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        return qs.filter(**filt) if filt else qs

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class LiaisonAgreementViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonAgreementSerializer
    filterset_fields = ['project', 'status', 'agreement_type']
    search_fields = ['agreement_number', 'signed_by', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return self._scope(LiaisonAgreement.objects.select_related('project', 'created_by').all())


class LiaisonNetMeterViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonNetMeterSerializer
    filterset_fields = ['project', 'status', 'meter_type']
    search_fields = ['meter_number', 'meter_make', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return self._scope(LiaisonNetMeter.objects.select_related('project', 'created_by').all())


def _per_project_count(model):
    sq = (
        model.objects.filter(project=OuterRef('pk'))
        .order_by()
        .values('project')
        .annotate(c=Count('id'))
        .values('c')[:1]
    )
    return Coalesce(Subquery(sq, output_field=IntegerField()), Value(0))


class LiaisonProjectViewSet(viewsets.ReadOnlyModelViewSet):
    """Won-lead projects moving through the Liaisoning pipeline
    (Documents → Application → … → Subsidy → Completed)."""

    serializer_class = LiaisonProjectSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Liaisoning & Commissioning'
    permission_action_map = {'advance': 'can_edit', 'set_stage': 'can_edit'}
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['project_id', 'project_name', 'customer_name', 'city', 'lead__mobile_number']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = (
            Project.objects.filter(lead__status='Won', is_deleted=False)
            .select_related('lead', 'manager', 'liaison_stage')
            .annotate(
                lc_stage=Coalesce('liaison_stage__stage', Value(LIAISON_STAGES[0])),
                documents_count=_per_project_count(LiaisonDocument),
                applications_count=_per_project_count(LiaisonApplication),
                agreements_count=_per_project_count(LiaisonAgreement),
                inspections_count=_per_project_count(LiaisonInspection),
                net_meters_count=_per_project_count(LiaisonNetMeter),
                commissionings_count=_per_project_count(LiaisonCommissioning),
                subsidies_count=_per_project_count(SubsidyApplication),
            )
        )
        filt = lead_owner_filter(self.request.user, prefix='lead__')
        if filt:
            qs = qs.filter(**filt)
        stage = self.request.query_params.get('stage')
        if stage:
            qs = qs.filter(lc_stage=stage)
        return qs

    def _respond(self, project_pk):
        return Response(self.get_serializer(self.get_queryset().get(pk=project_pk)).data)

    def _move(self, request, project, new_stage, kind):
        tracker, _ = LiaisonProjectStage.objects.get_or_create(project=project)
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
        current = project.lc_stage
        expected = request.data.get('from_stage')
        if expected and expected != current:
            return Response(
                {'detail': f'Project is already at "{current}".', 'lc_stage': current},
                status=status.HTTP_409_CONFLICT,
            )
        if current not in LIAISON_STAGES:
            return Response({'detail': 'Liaisoning is already completed for this project.'}, status=status.HTTP_400_BAD_REQUEST)
        idx = LIAISON_STAGES.index(current)
        new_stage = LIAISON_STAGES[idx + 1] if idx + 1 < len(LIAISON_STAGES) else LIAISON_STAGE_COMPLETED
        return self._move(request, project, new_stage, 'done')

    @action(detail=True, methods=['post'], url_path='set-stage')
    def set_stage(self, request, pk=None):
        project = self.get_object()
        new_stage = request.data.get('stage')
        if new_stage not in [*LIAISON_STAGES, LIAISON_STAGE_COMPLETED]:
            return Response({'detail': 'Invalid stage.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_stage == project.lc_stage:
            return self._respond(project.pk)
        return self._move(request, project, new_stage, 'set')
