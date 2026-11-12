from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModulePermission

from .bom_models import BomCapacityConfig, BomLine, BomVersion
from .bom_serializers import BomCapacityConfigSerializer, BomLineSerializer, BomVersionSerializer
from .bom_services import (
    activate_bom_version,
    bom_preview,
    create_draft_quotation_from_bom,
    ensure_default_capacity_shells,
    get_active_bom_version,
    parse_capacity_kw,
)


class BomCapacityConfigViewSet(viewsets.ModelViewSet):
    queryset = BomCapacityConfig.objects.all().prefetch_related('versions')
    serializer_class = BomCapacityConfigSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    permission_method_map = {
        'GET': 'can_view', 'POST': 'can_add', 'PUT': 'can_edit',
        'PATCH': 'can_edit', 'DELETE': 'can_delete',
    }

    @action(detail=False, methods=['post'], url_path='ensure-defaults')
    def ensure_defaults(self, request):
        created = ensure_default_capacity_shells(user=request.user)
        return Response({'created_version_ids': created, 'capacities': list(
            BomCapacityConfig.objects.order_by('sort_order').values_list('capacity_kw', flat=True)
        )})


class BomVersionViewSet(viewsets.ModelViewSet):
    queryset = BomVersion.objects.select_related('capacity_config').prefetch_related('lines').all()
    serializer_class = BomVersionSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    permission_method_map = {
        'GET': 'can_view', 'POST': 'can_add', 'PUT': 'can_edit',
        'PATCH': 'can_edit', 'DELETE': 'can_delete',
    }
    filterset_fields = ['capacity_config', 'status']

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        version = self.get_object()
        try:
            activate_bom_version(version, user=request.user)
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)}) from exc
        return Response(BomVersionSerializer(version, context={'request': request}).data)

    @action(detail=True, methods=['get'], url_path='preview')
    def preview(self, request, pk=None):
        return Response(bom_preview(self.get_object()))


class BomLineViewSet(viewsets.ModelViewSet):
    queryset = BomLine.objects.select_related('version').all()
    serializer_class = BomLineSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    permission_method_map = {
        'GET': 'can_view', 'POST': 'can_add', 'PUT': 'can_edit',
        'PATCH': 'can_edit', 'DELETE': 'can_delete',
    }
    filterset_fields = ['version']


class ActiveBomForCapacityView(APIView):
    """GET /bom/active/?capacity_kw=5 — used by Lead/Quotation UI."""
    permission_classes = [HasModulePermission]
    permission_modules = ('Lead', 'Project Management')
    permission_method_map = {'GET': 'can_view'}

    def get(self, request):
        kw = request.query_params.get('capacity_kw') or request.query_params.get('capacity')
        version = get_active_bom_version(kw)
        if not version:
            return Response({
                'detail': 'No active BOM for this capacity.',
                'capacity_kw': str(parse_capacity_kw(kw) or ''),
                'bom': None,
            }, status=status.HTTP_404_NOT_FOUND)
        return Response(bom_preview(version))


class DraftQuotationFromBomView(APIView):
    """POST { lead_id, bom_version_id?, force_new? } → Draft quotation."""
    permission_classes = [HasModulePermission]
    permission_module = 'Lead'
    permission_method_map = {'POST': 'can_add'}

    def post(self, request):
        from apps.leads.models import Lead
        from apps.leads.serializers import QuotationSerializer

        lead_id = request.data.get('lead_id')
        lead = Lead.objects.filter(pk=lead_id, is_deleted=False).first()
        if not lead:
            raise ValidationError({'lead_id': 'Lead not found.'})
        bom_version = None
        bom_id = request.data.get('bom_version_id')
        if bom_id:
            bom_version = BomVersion.objects.filter(pk=bom_id).first()
            if not bom_version:
                raise ValidationError({'bom_version_id': 'BOM version not found.'})
        try:
            quotation, created = create_draft_quotation_from_bom(
                lead,
                bom_version=bom_version,
                user=request.user,
                force_new=bool(request.data.get('force_new')),
            )
        except ValueError as exc:
            raise ValidationError({'detail': str(exc)}) from exc
        data = QuotationSerializer(quotation, context={'request': request}).data
        return Response(
            {'created': created, 'quotation': data},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
