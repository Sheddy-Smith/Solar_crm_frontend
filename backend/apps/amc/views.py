from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.permissions import HasModulePermission

from .models import (
    AmcClaim, AmcContract, AmcDocument, AmcRenewal,
    AmcServiceRequest, AmcVisit, AmcWarranty,
)
from .serializers import (
    AmcClaimSerializer, AmcContractSerializer, AmcDocumentSerializer, AmcRenewalSerializer,
    AmcServiceRequestSerializer, AmcVisitSerializer, AmcWarrantySerializer,
)
from .services import amc_dashboard_summary


class AmcBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'AMC & Warranty'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AmcContractViewSet(AmcBaseViewSet):
    serializer_class = AmcContractSerializer
    filterset_fields = ['project', 'status', 'contract_type']
    search_fields = ['customer_name', 'site', 'project__project_name']

    def get_queryset(self):
        return AmcContract.objects.select_related('project', 'created_by').all()

    @action(detail=False, methods=['get'])
    def summary(self, request):
        return Response(amc_dashboard_summary())


class AmcWarrantyViewSet(AmcBaseViewSet):
    serializer_class = AmcWarrantySerializer
    filterset_fields = ['project', 'status']
    search_fields = ['asset_type', 'manufacturer', 'serial_number', 'project__project_name']

    def get_queryset(self):
        return AmcWarranty.objects.select_related('project', 'created_by').all()


class AmcServiceRequestViewSet(AmcBaseViewSet):
    serializer_class = AmcServiceRequestSerializer
    filterset_fields = ['project', 'status', 'priority', 'contract']
    search_fields = ['subject', 'assigned_engineer', 'project__project_name']

    def get_queryset(self):
        return AmcServiceRequest.objects.select_related('project', 'contract', 'created_by').all()


class AmcVisitViewSet(AmcBaseViewSet):
    serializer_class = AmcVisitSerializer
    filterset_fields = ['project', 'status', 'visit_type']
    search_fields = ['engineer', 'findings', 'project__project_name']

    def get_queryset(self):
        return AmcVisit.objects.select_related('project', 'service_request', 'created_by').all()


class AmcRenewalViewSet(AmcBaseViewSet):
    serializer_class = AmcRenewalSerializer
    filterset_fields = ['contract', 'status']
    search_fields = ['contract__customer_name', 'remarks']

    def get_queryset(self):
        return AmcRenewal.objects.select_related('contract', 'created_by').all()


class AmcClaimViewSet(AmcBaseViewSet):
    serializer_class = AmcClaimSerializer
    filterset_fields = ['project', 'status', 'warranty']
    search_fields = ['description', 'project__project_name']

    def get_queryset(self):
        return AmcClaim.objects.select_related('project', 'warranty', 'created_by').all()


class AmcDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = AmcDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'AMC & Warranty'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'document_type', 'contract']
    search_fields = ['name', 'category', 'project__project_name']
    ordering = ['-created_at']

    def get_queryset(self):
        return AmcDocument.objects.select_related('project', 'contract', 'uploaded_by').all()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
