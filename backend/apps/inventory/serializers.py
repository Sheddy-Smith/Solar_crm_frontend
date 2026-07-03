from rest_framework import serializers
from .models import InventoryItem, StockMovement, Warehouse


class WarehouseSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'WH-{obj.id:04d}'

    class Meta:
        model = Warehouse
        fields = '__all__'


class InventoryItemSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    stock_status = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'PRD-{obj.id:04d}'

    class Meta:
        model = InventoryItem
        fields = '__all__'

    def get_stock_status(self, obj):
        if obj.current_stock <= 0:
            return 'Out of Stock'
        if obj.current_stock <= obj.minimum_stock:
            return 'Low Stock'
        return 'In Stock'


class StockMovementSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    item_name = serializers.CharField(source='item.name', read_only=True)
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    def get_record_no(self, obj):
        prefix = {'Inward': 'IN', 'Outward': 'OUT', 'Transfer': 'TRF', 'Adjustment': 'ADJ'}.get(obj.movement_type, 'MOV')
        return f'{prefix}-{obj.id:04d}'

    class Meta:
        model = StockMovement
        fields = '__all__'
        read_only_fields = ['created_by']
