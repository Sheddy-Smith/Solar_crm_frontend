from rest_framework import serializers

from .bom_models import BomCapacityConfig, BomLine, BomVersion
from .bom_services import bom_preview


class BomLineSerializer(serializers.ModelSerializer):
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = BomLine
        fields = [
            'id', 'version', 'category', 'material_name', 'sku', 'unit',
            'quantity', 'unit_price', 'line_total', 'sort_order', 'inventory_item',
        ]
    def get_line_total(self, obj):
        return float(obj.line_total)


class BomVersionSerializer(serializers.ModelSerializer):
    lines = BomLineSerializer(many=True, required=False)
    capacity_kw = serializers.DecimalField(source='capacity_config.capacity_kw', max_digits=8, decimal_places=2, read_only=True)
    materials_subtotal = serializers.SerializerMethodField()
    computed_project_price = serializers.SerializerMethodField()
    capacity_config_id = serializers.PrimaryKeyRelatedField(
        source='capacity_config', queryset=BomCapacityConfig.objects.all(),
    )

    class Meta:
        model = BomVersion
        fields = [
            'id', 'capacity_config_id', 'capacity_kw', 'version_number', 'status',
            'effective_date', 'labour_cost', 'other_charges', 'tax_percent',
            'final_project_price', 'notes', 'pending_configuration',
            'materials_subtotal', 'computed_project_price', 'lines',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['version_number', 'created_at', 'updated_at']

    def get_materials_subtotal(self, obj):
        return float(obj.materials_subtotal())

    def get_computed_project_price(self, obj):
        return float(obj.computed_project_price())

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        config = validated_data['capacity_config']
        last = config.versions.order_by('-version_number').values_list('version_number', flat=True).first() or 0
        validated_data['version_number'] = last + 1
        request = self.context.get('request')
        if request and getattr(request.user, 'is_authenticated', False):
            validated_data['created_by'] = request.user
        version = BomVersion.objects.create(**validated_data)
        for i, row in enumerate(lines_data):
            BomLine.objects.create(version=version, sort_order=row.get('sort_order', i), **{
                k: v for k, v in row.items() if k != 'sort_order'
            })
        if lines_data:
            version.pending_configuration = False
            version.save(update_fields=['pending_configuration', 'updated_at'])
        return version

    def update(self, instance, validated_data):
        if instance.status == BomVersion.STATUS_ACTIVE and 'status' not in self.initial_data:
            # Allow line edits on Active only via explicit inactive→edit→activate workflow preferred;
            # still allow non-price metadata notes.
            pass
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            instance.lines.all().delete()
            for i, row in enumerate(lines_data):
                BomLine.objects.create(version=instance, sort_order=row.get('sort_order', i), **{
                    k: v for k, v in row.items() if k not in ('sort_order', 'id', 'version', 'line_total')
                })
            instance.pending_configuration = len(lines_data) == 0
            instance.save(update_fields=['pending_configuration', 'updated_at'])
        return instance


class BomCapacityConfigSerializer(serializers.ModelSerializer):
    active_version = serializers.SerializerMethodField()
    versions_count = serializers.SerializerMethodField()

    class Meta:
        model = BomCapacityConfig
        fields = [
            'id', 'capacity_kw', 'label', 'is_active', 'sort_order',
            'active_version', 'versions_count', 'created_at', 'updated_at',
        ]

    def get_active_version(self, obj):
        ver = obj.versions.filter(status=BomVersion.STATUS_ACTIVE).first()
        return bom_preview(ver) if ver else None

    def get_versions_count(self, obj):
        return obj.versions.count()
