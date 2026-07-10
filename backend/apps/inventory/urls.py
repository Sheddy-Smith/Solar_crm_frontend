from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    InventoryCategoryViewSet,
    InventoryItemViewSet,
    StockMovementViewSet,
    WarehouseViewSet,
)

router = DefaultRouter()
router.register('categories', InventoryCategoryViewSet, basename='inventory-category')
router.register('items', InventoryItemViewSet, basename='inventory-item')
router.register('movements', StockMovementViewSet, basename='stock-movement')
router.register('warehouses', WarehouseViewSet, basename='warehouse')

urlpatterns = [path('', include(router.urls))]
