from decimal import Decimal, InvalidOperation

from django.db.models import F
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission

from .models import InventoryCategory, InventoryItem, StockMovement, Warehouse
from .serializers import (
    InventoryCategorySerializer,
    InventoryItemSerializer,
    StockMovementSerializer,
    WarehouseSerializer,
)
from .services import inventory_summary, movement_analytics


class InventoryBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Inventory'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering = ['-created_at']


class InventoryCategoryViewSet(InventoryBaseViewSet):
    queryset = InventoryCategory.objects.all()
    serializer_class = InventoryCategorySerializer
    search_fields = ['name', 'description']
    ordering = ['name']


class WarehouseViewSet(InventoryBaseViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    search_fields = ['name', 'location']
    ordering = ['name']


class InventoryItemViewSet(InventoryBaseViewSet):
    queryset = InventoryItem.objects.select_related('warehouse').all()
    serializer_class = InventoryItemSerializer
    filterset_fields = ['category', 'warehouse', 'is_active']
    search_fields = ['name', 'specification', 'hsn_code', 'item_code', 'category']
    ordering_fields = ['name', 'current_stock', 'created_at', 'item_code']
    permission_action_map = {'quick_adjust': 'can_edit'}

    def get_queryset(self):
        qs = super().get_queryset()
        stock_status = self.request.query_params.get('stock_status')
        if stock_status == 'In Stock':
            qs = qs.filter(current_stock__gt=F('minimum_stock'))
        elif stock_status == 'Low Stock':
            qs = qs.filter(current_stock__gt=0, current_stock__lte=F('minimum_stock'))
        elif stock_status == 'Out of Stock':
            qs = qs.filter(current_stock__lte=0)
        return qs

    @action(detail=False, methods=['get'])
    def summary(self, request):
        return Response(inventory_summary())

    @action(detail=True, methods=['post'], url_path='quick-adjust')
    def quick_adjust(self, request, pk=None):
        item = self.get_object()
        raw_qty = request.data.get('quantity')
        direction = request.data.get('direction', 'add')
        notes = (request.data.get('notes') or '').strip()
        if direction not in ('add', 'remove'):
            return Response({'detail': "direction must be either 'add' or 'remove'."}, status=400)
        if raw_qty in (None, ''):
            return Response({'detail': 'quantity is required.'}, status=400)
        try:
            qty = Decimal(str(raw_qty))
        except (InvalidOperation, TypeError):
            return Response({'detail': 'quantity must be a valid number.'}, status=400)
        if qty <= 0:
            return Response({'detail': 'quantity must be greater than zero.'}, status=400)
        if not notes:
            return Response({'detail': 'notes (reason) is required for manual stock adjustments.'}, status=400)
        if not item.warehouse_id:
            return Response({
                'detail': 'Assign a warehouse to this product before adjusting stock.',
            }, status=400)
        data = {
            'item': item,
            'movement_type': 'Adjustment',
            'quantity': qty,
            'rate': item.rate,
            'reference_type': 'Manual',
            'notes': notes,
            'created_by': request.user,
        }
        if direction == 'add':
            data['to_warehouse'] = item.warehouse
        else:
            data['from_warehouse'] = item.warehouse
        movement = StockMovement.objects.create(**data)
        return Response(StockMovementSerializer(movement).data)


class StockMovementViewSet(InventoryBaseViewSet):
    queryset = StockMovement.objects.select_related(
        'item', 'created_by', 'from_warehouse', 'to_warehouse', 'project',
    ).all()
    serializer_class = StockMovementSerializer
    filterset_fields = ['movement_type', 'item', 'reference_type', 'project']
    search_fields = [
        'reference', 'reference_no', 'notes',
        'item__name', 'item__item_code', 'item__category',
        'project__project_name', 'project__project_id',
    ]
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    @staticmethod
    def _reject_source_protected(instance, verb='modify'):
        from rest_framework.exceptions import PermissionDenied
        if instance and instance.is_source_protected():
            raise PermissionDenied(
                f'Cannot {verb} {instance.reference_type or "source"}-linked stock movement '
                f'({instance.reference_no or instance.id}). Correct it from the source document '
                f'(invoice, challan, or material dispatch), or use a Manual adjustment.'
            )

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        ref = serializer.validated_data.get('reference_type') or 'Manual'
        if ref in StockMovement.SOURCE_PROTECTED_REFERENCE_TYPES:
            raise ValidationError({
                'reference_type': (
                    'Cannot create invoice/dispatch-linked movements via Stock Movement API. '
                    'Use Manual for adjustments, or create the source document.'
                ),
            })
        if ref == 'Opening Stock':
            raise ValidationError({
                'reference_type': (
                    'Opening Stock movements are created only when adding a product with '
                    'initial stock. Use Manual for adjustments.'
                ),
            })
        if ref == 'Manual' and not (serializer.validated_data.get('notes') or '').strip():
            raise ValidationError({'notes': 'Reason is required for Manual stock adjustments.'})
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        self._reject_source_protected(serializer.instance, verb='edit')
        serializer.save()

    def perform_destroy(self, instance):
        self._reject_source_protected(instance, verb='delete')
        instance.delete()

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        return Response(movement_analytics(
            date_from=request.query_params.get('date_from'),
            date_to=request.query_params.get('date_to'),
            movement_type=request.query_params.get('movement_type'),
            reference_type=request.query_params.get('reference_type'),
            search=request.query_params.get('search'),
        ))

    @action(detail=False, methods=['get'], url_path='reconciliation')
    def reconciliation(self, request):
        """Read-only stock ledger reconciliation findings (no auto-repair)."""
        from .reconciliation import build_stock_reconciliation
        return Response(build_stock_reconciliation(
            project_id=request.query_params.get('project') or None,
            warehouse_id=request.query_params.get('warehouse') or None,
            item_id=request.query_params.get('item') or None,
            date_from=request.query_params.get('date_from') or None,
            date_to=request.query_params.get('date_to') or None,
        ))
