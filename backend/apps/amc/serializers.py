from rest_framework import serializers

from .models import (
    AmcClaim, AmcContract, AmcDocument, AmcRenewal,
    AmcServiceRequest, AmcVisit, AmcWarranty,
)


def _user_name(user):
    if not user:
        return ''
    return user.name or user.email


class AmcContractSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'AMC-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = AmcContract
        fields = [
            'id', 'record_no', 'project', 'project_name', 'customer_name', 'site',
            'contract_type', 'start_date', 'end_date', 'annual_value', 'status',
            'next_renewal_date', 'remarks', 'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class AmcWarrantySerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'WAR-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = AmcWarranty
        fields = [
            'id', 'record_no', 'project', 'project_name', 'asset_type', 'manufacturer',
            'serial_number', 'warranty_start', 'warranty_end', 'status', 'coverage_details',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class AmcServiceRequestSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    contract_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'SR-{obj.id:04d}'

    def get_contract_no(self, obj):
        return f'AMC-{obj.contract_id:04d}' if obj.contract_id else ''

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = AmcServiceRequest
        fields = [
            'id', 'record_no', 'project', 'project_name', 'contract', 'contract_no',
            'subject', 'priority', 'status', 'requested_date', 'assigned_engineer',
            'description', 'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class AmcVisitSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'VIS-{obj.id:04d}'

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = AmcVisit
        fields = [
            'id', 'record_no', 'project', 'project_name', 'service_request',
            'visit_date', 'engineer', 'visit_type', 'status', 'findings',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class AmcRenewalSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    contract_no = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source='contract.customer_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'RNW-{obj.id:04d}'

    def get_contract_no(self, obj):
        return f'AMC-{obj.contract_id:04d}' if obj.contract_id else ''

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = AmcRenewal
        fields = [
            'id', 'record_no', 'contract', 'contract_no', 'customer_name',
            'renewal_date', 'new_end_date', 'amount', 'status', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class AmcClaimSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    warranty_no = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'CLM-{obj.id:04d}'

    def get_warranty_no(self, obj):
        return f'WAR-{obj.warranty_id:04d}' if obj.warranty_id else ''

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    class Meta:
        model = AmcClaim
        fields = [
            'id', 'record_no', 'project', 'project_name', 'warranty', 'warranty_no',
            'claim_date', 'claim_amount', 'status', 'description',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class AmcDocumentSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    contract_no = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'DOC-{obj.id:04d}'

    def get_contract_no(self, obj):
        return f'AMC-{obj.contract_id:04d}' if obj.contract_id else ''

    def get_uploaded_by_name(self, obj):
        return _user_name(obj.uploaded_by)

    class Meta:
        model = AmcDocument
        fields = [
            'id', 'record_no', 'name', 'document_type', 'category', 'project', 'project_name',
            'contract', 'contract_no', 'file', 'remarks', 'uploaded_by', 'uploaded_by_name',
            'created_at',
        ]
        read_only_fields = ['uploaded_by', 'created_at']
