from django.contrib import admin
from django.core.exceptions import PermissionDenied

from .models import InventoryCategory, InventoryItem, StockMovement, Warehouse


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'location')


@admin.register(InventoryCategory)
class InventoryCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'form_template', 'is_active', 'created_at')
    list_filter = ('is_active', 'form_template')
    search_fields = ('name',)


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'item_code', 'category', 'current_stock', 'warehouse', 'is_active')
    list_filter = ('is_active', 'category', 'warehouse')
    search_fields = ('name', 'item_code', 'hsn_code')
    readonly_fields = ('current_stock', 'created_at', 'updated_at')


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'item', 'movement_type', 'quantity', 'reference_type',
        'reference_no', 'project', 'created_at',
    )
    list_filter = ('movement_type', 'reference_type')
    search_fields = ('reference_no', 'reference', 'notes', 'item__name')
    raw_id_fields = ('item', 'from_warehouse', 'to_warehouse', 'project', 'created_by')

    def get_readonly_fields(self, request, obj=None):
        base = ('created_at',)
        if obj and obj.is_source_protected():
            return base + (
                'item', 'movement_type', 'quantity', 'rate',
                'from_warehouse', 'to_warehouse', 'project',
                'reference_type', 'reference_no', 'reference', 'notes', 'created_by',
            )
        return base

    def has_change_permission(self, request, obj=None):
        if obj and obj.is_source_protected():
            return request.user.is_superuser  # view-only via readonly; still allow open
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if obj and obj.is_source_protected():
            return False
        return super().has_delete_permission(request, obj)

    def save_model(self, request, obj, form, change):
        if change and obj.is_source_protected():
            raise PermissionDenied(
                'Cannot edit invoice/challan/dispatch-linked stock movements from Admin. '
                'Correct them from the source document.'
            )
        if (obj.reference_type or 'Manual') == 'Manual' and not (obj.notes or '').strip():
            raise PermissionDenied('Manual stock adjustments require a reason in notes.')
        super().save_model(request, obj, form, change)
