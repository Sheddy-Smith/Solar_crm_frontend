from datetime import date

from django.utils import timezone
from rest_framework import serializers
from .models import (
    OmAsset, OmMaintenanceTask, OmBreakdownTicket,
    OmSiteVisit, OmSparePart, OmReport, OmDocument,
    OmPlant, OmVisitPart, OmInsurance,
)


def _user_name(user):
    if not user:
        return ''
    return user.name or user.email


def _plant_code(plant):
    return plant.plant_code if plant else ''


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


class OmPlantSerializer(serializers.ModelSerializer):
    plant_code = serializers.CharField(read_only=True)
    project_code = serializers.CharField(source='project.project_id', read_only=True)
    lead_code = serializers.SerializerMethodField()
    customer_code = serializers.SerializerMethodField()
    days_to_free_expiry = serializers.SerializerMethodField()
    next_service = serializers.SerializerMethodField()
    open_tickets = serializers.SerializerMethodField()
    insurance = serializers.SerializerMethodField()
    last_visit_date = serializers.SerializerMethodField()

    def get_lead_code(self, obj):
        return f'LD-{obj.lead_id:04d}' if obj.lead_id else ''

    def get_customer_code(self, obj):
        return f'CUS-{obj.customer_id:04d}' if obj.customer_id else ''

    def get_days_to_free_expiry(self, obj):
        if not obj.free_service_end:
            return None
        return (obj.free_service_end - date.today()).days

    def get_next_service(self, obj):
        open_quarterly = [
            t for t in obj.tasks.all()
            if t.source == 'Quarterly' and t.status not in OmMaintenanceTask.CLOSED_STATUSES and t.due_date
        ]
        if not open_quarterly:
            return None
        task = min(open_quarterly, key=lambda t: t.due_date)
        return {
            'id': task.id, 'title': task.title, 'due_date': task.due_date, 'status': task.status,
            'overdue': task.due_date < date.today(),
        }

    def get_open_tickets(self, obj):
        return sum(1 for t in obj.tickets.all() if t.status in OmBreakdownTicket.OPEN_STATUSES)

    def get_insurance(self, obj):
        policies = sorted(
            obj.insurances.all(), key=lambda p: (p.expiry_date or date.min, p.id), reverse=True,
        )
        if not policies:
            return {'status': 'Not Insured', 'expiry_date': None, 'days_to_expiry': None, 'company': ''}
        policy = policies[0]
        days = (policy.expiry_date - date.today()).days if policy.expiry_date else None
        status = policy.status
        if status == 'Insured' and days is not None and days < 0:
            status = 'Expired'
        return {
            'id': policy.id, 'status': status, 'expiry_date': policy.expiry_date,
            'days_to_expiry': days, 'company': policy.company, 'policy_number': policy.policy_number,
        }

    def get_last_visit_date(self, obj):
        dates = [v.date for v in obj.visits.all() if v.date and v.status == 'Completed']
        return max(dates) if dates else None

    class Meta:
        model = OmPlant
        fields = '__all__'
        read_only_fields = [
            'project', 'lead', 'commissioning_date', 'free_service_start', 'free_service_end',
            'created_by', 'created_at', 'updated_at',
        ]


class OmBreakdownTicketSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    plant_code = serializers.SerializerMethodField()
    plant_name = serializers.CharField(source='plant.plant_name', read_only=True)
    customer_name = serializers.CharField(source='plant.customer_name', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    task_count = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'BD-{obj.id:04d}'

    def get_plant_code(self, obj):
        return _plant_code(obj.plant)

    def get_assigned_to_name(self, obj):
        return _user_name(obj.assigned_to)

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def get_is_overdue(self, obj):
        return bool(
            obj.status in OmBreakdownTicket.OPEN_STATUSES
            and obj.expected_visit_date and obj.expected_visit_date < date.today()
        )

    def get_task_count(self, obj):
        return obj.tasks.count()

    def validate(self, attrs):
        plant = attrs.get('plant') or (self.instance.plant if self.instance else None)
        if plant:
            attrs.setdefault('project', plant.project)
            if not attrs.get('site') and not (self.instance and self.instance.site):
                attrs['site'] = plant.plant_location
            if not attrs.get('contact_number') and not (self.instance and self.instance.contact_number):
                attrs['contact_number'] = plant.mobile_number
        if not self.instance:
            attrs.setdefault('complaint_at', timezone.now())
            if attrs.get('assigned_to') and attrs.get('status', 'Open') == 'Open':
                attrs['status'] = 'Assigned'
        status = attrs.get('status')
        if status in ('Resolved', 'Closed') and not (self.instance and self.instance.resolved_at):
            attrs['resolved_at'] = timezone.now()
        if status == 'Closed' and not (self.instance and self.instance.closed_at):
            attrs['closed_at'] = timezone.now()
        return attrs

    class Meta:
        model = OmBreakdownTicket
        fields = [
            'id', 'record_no', 'subject', 'plant', 'plant_code', 'plant_name', 'customer_name',
            'project', 'project_name', 'site', 'asset', 'asset_name', 'contact_number',
            'complaint_at', 'complaint_type', 'priority', 'assigned_to', 'assigned_to_name',
            'expected_visit_date', 'status', 'issue_description', 'resolution', 'remarks',
            'resolved_at', 'closed_at', 'is_overdue', 'task_count',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'resolved_at', 'closed_at']


class OmMaintenanceTaskSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    plant_code = serializers.SerializerMethodField()
    plant_name = serializers.CharField(source='plant.plant_name', read_only=True)
    customer_name = serializers.CharField(source='plant.customer_name', read_only=True)
    customer_mobile = serializers.CharField(source='plant.mobile_number', read_only=True)
    plant_location = serializers.CharField(source='plant.plant_location', read_only=True)
    ticket_no = serializers.SerializerMethodField()
    ticket_subject = serializers.CharField(source='ticket.subject', read_only=True)
    assigned_engineer_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'MT-{obj.id:04d}'

    def get_plant_code(self, obj):
        return _plant_code(obj.plant)

    def get_ticket_no(self, obj):
        return f'BD-{obj.ticket_id:04d}' if obj.ticket_id else ''

    def get_assigned_engineer_name(self, obj):
        return _user_name(obj.assigned_engineer) or obj.engineer

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def get_is_overdue(self, obj):
        deadline = obj.effective_deadline
        return bool(obj.status not in OmMaintenanceTask.CLOSED_STATUSES and deadline and deadline < date.today())

    def validate(self, attrs):
        plant = attrs.get('plant') or (self.instance.plant if self.instance else None)
        if plant:
            attrs.setdefault('project', plant.project)
            if not attrs.get('site') and not (self.instance and self.instance.site):
                attrs['site'] = plant.plant_location
        engineer = attrs.get('assigned_engineer')
        current_status = attrs.get('status') or (self.instance.status if self.instance else 'Pending')
        if engineer and current_status in ('Scheduled', 'Pending'):
            attrs['status'] = 'Assigned'
        if attrs.get('status') == 'Completed' and not (self.instance and self.instance.completed_at):
            attrs['completed_at'] = timezone.now()
        return attrs

    class Meta:
        model = OmMaintenanceTask
        fields = [
            'id', 'record_no', 'title', 'plant', 'plant_code', 'plant_name', 'customer_name',
            'customer_mobile', 'plant_location', 'ticket', 'ticket_no', 'ticket_subject',
            'project', 'project_name', 'site', 'source', 'sequence_no', 'task_type',
            'priority', 'engineer', 'assigned_engineer', 'assigned_engineer_name',
            'due_date', 'visit_date', 'deadline', 'status', 'completed_at', 'is_overdue',
            'work_details', 'checklist', 'remarks',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'completed_at']


class OmVisitPartSerializer(serializers.ModelSerializer):
    total_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    used_by_name = serializers.SerializerMethodField()
    inventory_item_name = serializers.CharField(source='inventory_item.name', read_only=True)

    def get_used_by_name(self, obj):
        return _user_name(obj.used_by)

    class Meta:
        model = OmVisitPart
        fields = [
            'id', 'visit', 'plant', 'ticket', 'material', 'description', 'inventory_item',
            'inventory_item_name', 'quantity', 'serial_number', 'unit_cost', 'total_cost',
            'used_by', 'used_by_name', 'used_on', 'created_at',
        ]
        read_only_fields = ['created_at']


class OmSiteVisitSerializer(serializers.ModelSerializer):
    record_no = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    plant_code = serializers.SerializerMethodField()
    plant_name = serializers.CharField(source='plant.plant_name', read_only=True)
    customer_name = serializers.CharField(source='plant.customer_name', read_only=True)
    task_title = serializers.CharField(source='task.title', read_only=True)
    ticket_no = serializers.SerializerMethodField()
    assigned_engineer_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    parts = OmVisitPartSerializer(many=True, read_only=True)
    spare_cost = serializers.SerializerMethodField()

    def get_record_no(self, obj):
        return f'SV-{obj.id:04d}'

    def get_plant_code(self, obj):
        return _plant_code(obj.plant)

    def get_ticket_no(self, obj):
        return f'BD-{obj.ticket_id:04d}' if obj.ticket_id else ''

    def get_assigned_engineer_name(self, obj):
        return _user_name(obj.assigned_engineer) or obj.engineer

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def get_spare_cost(self, obj):
        return sum((p.total_cost for p in obj.parts.all()), 0)

    def validate(self, attrs):
        plant = attrs.get('plant') or (self.instance.plant if self.instance else None)
        if plant:
            attrs.setdefault('project', plant.project)
            if not attrs.get('site') and not (self.instance and self.instance.site):
                attrs['site'] = plant.plant_location
        return attrs

    class Meta:
        model = OmSiteVisit
        fields = [
            'id', 'record_no', 'plant', 'plant_code', 'plant_name', 'customer_name',
            'task', 'task_title', 'ticket', 'ticket_no', 'project', 'project_name', 'site',
            'purpose', 'service_type', 'engineer', 'assigned_engineer', 'assigned_engineer_name',
            'date', 'arrival_time', 'departure_time', 'status', 'plant_generation_kwh',
            'inspection', 'checklist', 'complaint', 'fault_found', 'diagnosis', 'work_done',
            'labour_cost', 'engineer_notes', 'customer_remarks', 'customer_signature',
            'final_status', 'next_service_date', 'remarks', 'completed_at', 'parts', 'spare_cost',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'completed_at']


class OmInsuranceSerializer(serializers.ModelSerializer):
    plant_code = serializers.SerializerMethodField()
    plant_name = serializers.CharField(source='plant.plant_name', read_only=True)
    customer_name = serializers.CharField(source='plant.customer_name', read_only=True)
    days_to_expiry = serializers.SerializerMethodField()
    alert = serializers.SerializerMethodField()

    def get_plant_code(self, obj):
        return _plant_code(obj.plant)

    def get_days_to_expiry(self, obj):
        return (obj.expiry_date - date.today()).days if obj.expiry_date else None

    def get_alert(self, obj):
        days = self.get_days_to_expiry(obj)
        if obj.status == 'Not Insured':
            return ''
        if obj.status == 'Expired' or (days is not None and days < 0):
            return 'Insurance Expired'
        if days is not None and days <= 7:
            return 'Insurance Expiring Soon'
        if days is not None and days <= 30:
            return 'Insurance Expiring in 30 Days'
        return ''

    def validate(self, attrs):
        duration = attrs.get('duration') or (self.instance.duration if self.instance else '1 Year')
        if duration == 'Custom' and not (attrs.get('expiry_date') or (self.instance and self.instance.expiry_date)):
            raise serializers.ValidationError({'expiry_date': 'Expiry date is required for a custom duration.'})
        return attrs

    class Meta:
        model = OmInsurance
        fields = [
            'id', 'plant', 'plant_code', 'plant_name', 'customer_name', 'status', 'company',
            'policy_number', 'policy_type', 'start_date', 'duration', 'expiry_date',
            'coverage_amount', 'premium', 'policy_document', 'remarks', 'days_to_expiry', 'alert',
            'created_by', 'created_at', 'updated_at',
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
        fields = [
            'id', 'module', 'related_id', 'plant', 'category', 'name', 'file',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
        ]
        read_only_fields = ['uploaded_by', 'uploaded_at']
