from decimal import Decimal

from rest_framework import serializers

from .models import InventoryCategory, InventoryItem, StockMovement, Warehouse
from .services import next_item_code


class WarehouseSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'WH-{obj.id:04d}'

    class Meta:
        model = Warehouse
        fields = '__all__'


class InventoryCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryCategory
        fields = '__all__'


class InventoryItemSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    stock_status = serializers.SerializerMethodField()
    valuation = serializers.SerializerMethodField()
    initial_stock = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, write_only=True, allow_null=True)

    def get_record_no(self, obj):
        return obj.item_code or f'PRD-{obj.id:04d}'

    def get_stock_status(self, obj):
        if obj.current_stock <= 0:
            return 'Out of Stock'
        if obj.current_stock <= obj.minimum_stock:
            return 'Low Stock'
        return 'In Stock'

    def get_valuation(self, obj):
        return float((obj.current_stock or 0) * (obj.rate or 0))

    class Meta:
        model = InventoryItem
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'current_stock']

    def validate(self, attrs):
        opening = attrs.get('initial_stock')
        if opening is not None and Decimal(str(opening)) > 0 and not attrs.get('warehouse'):
            raise serializers.ValidationError({
                'warehouse': 'Select a warehouse when setting opening stock.',
            })
        return attrs

    def _apply_pricing_defaults(self, validated_data):
        rate = validated_data.get('rate')
        if rate is not None and not validated_data.get('selling_price'):
            validated_data['selling_price'] = (Decimal(rate) * Decimal('1.5')).quantize(Decimal('0.01'))
        return validated_data

    def create(self, validated_data):
        initial_stock = validated_data.pop('initial_stock', None)
        validated_data = self._apply_pricing_defaults(validated_data)
        if not validated_data.get('item_code'):
            validated_data['item_code'] = next_item_code()

        opening = Decimal(initial_stock or 0)
        if opening > 0:
            validated_data['current_stock'] = Decimal('0')

        item = super().create(validated_data)

        if opening > 0:
            request = self.context.get('request')
            StockMovement.objects.create(
                item=item,
                movement_type='Inward',
                quantity=opening,
                rate=item.rate,
                to_warehouse=item.warehouse,
                reference_type='Opening Stock',
                reference='Opening balance',
                notes='Auto-created from product opening stock',
                created_by=request.user if request and request.user.is_authenticated else None,
            )
        return item

    def update(self, instance, validated_data):
        validated_data.pop('initial_stock', None)
        validated_data = self._apply_pricing_defaults(validated_data)
        return super().update(instance, validated_data)


class StockMovementSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_code = serializers.CharField(source='item.item_code', read_only=True)
    item_category = serializers.CharField(source='item.category', read_only=True)
    item_unit = serializers.CharField(source='item.unit', read_only=True)
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    movement_direction = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        prefix = {'Inward': 'IN', 'Outward': 'OUT', 'Transfer': 'TRF', 'Adjustment': 'ADJ'}.get(obj.movement_type, 'MOV')
        return f'{prefix}-{obj.id:04d}'

    def get_movement_direction(self, obj):
        if obj.movement_type == 'Inward':
            return 'IN'
        if obj.movement_type == 'Outward':
            return 'OUT'
        return obj.movement_type

    def validate(self, attrs):
        movement_type = attrs.get('movement_type') or (
            self.instance.movement_type if self.instance else None
        )
        from_wh = attrs.get(
            'from_warehouse',
            self.instance.from_warehouse if self.instance else None,
        )
        to_wh = attrs.get(
            'to_warehouse',
            self.instance.to_warehouse if self.instance else None,
        )
        qty = attrs.get('quantity', self.instance.quantity if self.instance else None)

        if qty is not None and Decimal(str(qty)) <= 0:
            raise serializers.ValidationError({'quantity': 'Must be greater than zero.'})

        if movement_type == 'Inward' and not to_wh:
            raise serializers.ValidationError({'to_warehouse': 'Required for inward movement.'})
        if movement_type == 'Outward' and not from_wh:
            raise serializers.ValidationError({'from_warehouse': 'Required for outward movement.'})
        if movement_type == 'Transfer':
            if not from_wh or not to_wh:
                raise serializers.ValidationError({'detail': 'Both warehouses are required for transfer.'})
            if from_wh == to_wh:
                raise serializers.ValidationError({'detail': 'From and to warehouse must be different.'})
        if movement_type == 'Adjustment' and not from_wh and not to_wh:
            raise serializers.ValidationError({
                'detail': 'Select at least one warehouse (from or to) for adjustment.',
            })
        return attrs

    class Meta:
        model = StockMovement
        fields = '__all__'
        read_only_fields = ['created_by']
