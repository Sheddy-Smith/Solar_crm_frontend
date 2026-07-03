from rest_framework import viewsets, filters
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    OmAsset, OmMaintenanceTask, OmBreakdownTicket,
    OmSiteVisit, OmSparePart, OmReport, OmDocument,
)
from .serializers import (
    OmAssetSerializer, OmMaintenanceTaskSerializer, OmBreakdownTicketSerializer,
    OmSiteVisitSerializer, OmSparePartSerializer, OmReportSerializer, OmDocumentSerializer,
)
from apps.accounts.permissions import HasModulePermission


class OmBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'O&M'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class OmAssetViewSet(OmBaseViewSet):
    serializer_class = OmAssetSerializer
    filterset_fields = ['project', 'status', 'asset_type']
    search_fields = ['name', 'site', 'manufacturer', 'project__project_name']

    def get_queryset(self):
        return OmAsset.objects.select_related('project', 'created_by').all()


class OmMaintenanceTaskViewSet(OmBaseViewSet):
    serializer_class = OmMaintenanceTaskSerializer
    filterset_fields = ['project', 'status', 'task_type', 'priority']
    search_fields = ['title', 'site', 'engineer', 'project__project_name']

    def get_queryset(self):
        return OmMaintenanceTask.objects.select_related('project', 'created_by').all()


class OmBreakdownTicketViewSet(OmBaseViewSet):
    serializer_class = OmBreakdownTicketSerializer
    filterset_fields = ['project', 'status', 'priority', 'asset']
    search_fields = ['subject', 'site', 'project__project_name', 'asset__name']

    def get_queryset(self):
        return OmBreakdownTicket.objects.select_related('project', 'asset', 'assigned_to', 'created_by').all()


class OmSiteVisitViewSet(OmBaseViewSet):
    serializer_class = OmSiteVisitSerializer
    filterset_fields = ['project', 'status']
    search_fields = ['site', 'purpose', 'engineer', 'project__project_name']

    def get_queryset(self):
        return OmSiteVisit.objects.select_related('project', 'created_by').all()


class OmSparePartViewSet(OmBaseViewSet):
    serializer_class = OmSparePartSerializer
    filterset_fields = ['category']
    search_fields = ['name', 'site', 'supplier', 'category']

    def get_queryset(self):
        return OmSparePart.objects.select_related('created_by').all()


class OmReportViewSet(viewsets.ModelViewSet):
    serializer_class = OmReportSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'O&M'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['report_type']
    search_fields = ['name', 'report_type']
    ordering = ['-created_at']

    def get_queryset(self):
        return OmReport.objects.select_related('generated_by').all()

    def perform_create(self, serializer):
        serializer.save(generated_by=self.request.user)


class OmDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = OmDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'O&M'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['module', 'related_id']

    def get_queryset(self):
        return OmDocument.objects.select_related('uploaded_by').all()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
