from django.db import models
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Sum
from .models import InventoryItem, StockMovement, Warehouse
from .serializers import InventoryItemSerializer, StockMovementSerializer, WarehouseSerializer
from apps.accounts.permissions import IsManagerOrAbove


class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [IsManagerOrAbove]


class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.select_related('warehouse').all()
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsManagerOrAbove()]
    filterset_fields = ['category', 'warehouse', 'is_active']
    search_fields = ['name', 'hsn_code']
    ordering_fields = ['name', 'current_stock', 'created_at']

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = InventoryItem.objects.filter(is_active=True)
        return Response({
            'total_items': qs.count(),
            'low_stock': qs.filter(current_stock__lte=models.F('minimum_stock'), current_stock__gt=0).count(),
            'out_of_stock': qs.filter(current_stock__lte=0).count(),
            'total_value': qs.aggregate(val=Sum(models.F('current_stock') * models.F('rate')))['val'] or 0,
            'by_category': list(qs.values('category').annotate(count=Count('id'))),
        })


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related('item', 'created_by').all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsManagerOrAbove()]
    filterset_fields = ['movement_type', 'item']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
