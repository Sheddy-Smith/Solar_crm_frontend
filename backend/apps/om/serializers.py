from rest_framework import serializers
from .models import (
    OmAsset, OmMaintenanceTask, OmBreakdownTicket,
    OmSiteVisit, OmSparePart, OmReport, OmDocument,
)


def _user_name(user):
    if not user:
        return ''
    return user.name or user.email


class OmAssetSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'AST-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = OmAsset
        fields = [
            'id', 'record_no', 'name', 'asset_type', 'project', 'project_name', 'site',
            'capacity', 'manufacturer', 'status', 'installed_on',
            'energy_generated_kwh', 'energy_consumed_kwh', 'performance_ratio', 'specific_yield',
            'remarks', 'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class OmMaintenanceTaskSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'MT-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = OmMaintenanceTask
        fields = [
            'id', 'record_no', 'title', 'project', 'project_name', 'site', 'task_type',
            'priority', 'engineer', 'due_date', 'status', 'work_details', 'checklist',
            'remarks', 'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class OmBreakdownTicketSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'BD-{obj.id:04d}'

    def get_assigned_to_name(self, obj):
        return _user_name(obj.assigned_to)

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = OmBreakdownTicket
        fields = [
            'id', 'record_no', 'subject', 'project', 'project_name', 'site',
            'asset', 'asset_name', 'priority', 'assigned_to', 'assigned_to_name',
            'status', 'issue_description', 'resolution', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class OmSiteVisitSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'SV-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = OmSiteVisit
        fields = [
            'id', 'record_no', 'project', 'project_name', 'site', 'purpose', 'engineer',
            'date', 'status', 'checklist', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class OmSparePartSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    stock_status = serializers.CharField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    linked_inventory_item_name = serializers.CharField(source='linked_inventory_item.name', read_only=True)

    def get_record_no(self, obj):
        return f'SP-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = OmSparePart
        fields = [
            'id', 'record_no', 'name', 'category', 'site', 'stock_qty', 'min_stock',
            'unit', 'unit_cost', 'supplier', 'stock_status', 'remarks',
            'linked_inventory_item', 'linked_inventory_item_name',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class OmReportSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    generated_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'RPT-{obj.id:04d}'

    def get_generated_by_name(self, obj):
        return _user_name(obj.generated_by)

    class Meta:
        model = OmReport
        fields = [
            'id', 'record_no', 'name', 'report_type', 'file', 'remarks',
            'generated_by', 'generated_by_name', 'created_at',
        ]
        read_only_fields = ['generated_by', 'created_at']


class OmDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    def get_uploaded_by_name(self, obj):
        return _user_name(obj.uploaded_by)

    class Meta:
        model = OmDocument
        fields = ['id', 'module', 'related_id', 'name', 'file', 'uploaded_by', 'uploaded_by_name', 'uploaded_at']
        read_only_fields = ['uploaded_by', 'uploaded_at']
