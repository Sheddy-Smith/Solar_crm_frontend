from rest_framework import viewsets, filters
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from .models import (
    LiaisonApplication, LiaisonApproval, LiaisonInspection,
    LiaisonCommissioning, LiaisonCompliance, LiaisonDocument,
)
from .serializers import (
    LiaisonApplicationSerializer, LiaisonApprovalSerializer, LiaisonInspectionSerializer,
    LiaisonCommissioningSerializer, LiaisonComplianceSerializer, LiaisonDocumentSerializer,
)
from apps.accounts.permissions import HasModulePermission


class LiaisonBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Liaisoning & Commissioning'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class LiaisonApplicationViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonApplicationSerializer
    filterset_fields = ['project', 'status', 'application_type']
    search_fields = ['application_number', 'discom', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return LiaisonApplication.objects.select_related('project', 'created_by').all()


class LiaisonApprovalViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonApprovalSerializer
    filterset_fields = ['project', 'status', 'approval_type']
    search_fields = ['approval_type', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return LiaisonApproval.objects.select_related('project', 'created_by', 'assigned_to', 'approved_by').all()

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
        return LiaisonInspection.objects.select_related('project', 'created_by').all()


class LiaisonCommissioningViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonCommissioningSerializer
    filterset_fields = ['project', 'status']
    search_fields = ['engineer', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return LiaisonCommissioning.objects.select_related('project', 'created_by').all()


class LiaisonComplianceViewSet(LiaisonBaseViewSet):
    serializer_class = LiaisonComplianceSerializer
    filterset_fields = ['project', 'status', 'compliance_type']
    search_fields = ['compliance_type', 'project__project_name', 'project__customer_name']

    def get_queryset(self):
        return LiaisonCompliance.objects.select_related('project', 'created_by').all()


class LiaisonDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = LiaisonDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Liaisoning & Commissioning'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['project', 'module', 'related_id', 'doc_type']
    search_fields = ['name', 'project__project_name']

    def get_queryset(self):
        return LiaisonDocument.objects.select_related('project', 'uploaded_by').all()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
