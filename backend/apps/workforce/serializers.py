from decimal import Decimal

from rest_framework import serializers

from .models import Employee, EmployeeAssignment, EmployeeDocument, EmployeeAttendance, EmployeeVoucher
from .services import employee_net_balance, hourly_rate_for, payment_for_attendance


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeDocument
        fields = ['id', 'employee', 'doc_type', 'name', 'file', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class EmployeeAssignmentSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    project_id_code = serializers.CharField(source='project.project_id', read_only=True)
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_emp_id = serializers.CharField(source='employee.employee_id', read_only=True)
    employee_department = serializers.CharField(source='employee.department', read_only=True)
    employee_role = serializers.CharField(source='employee.role', read_only=True)
    employee_status = serializers.CharField(source='employee.status', read_only=True)

    class Meta:
        model = EmployeeAssignment
        fields = [
            'id', 'employee', 'project', 'project_name', 'project_id_code',
            'employee_name', 'employee_emp_id', 'employee_department', 'employee_role', 'employee_status',
            'task_name', 'assigned_date', 'expected_completion',
            'priority', 'progress_percent', 'status', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class EmployeeListSerializer(serializers.ModelSerializer):
    current_assignment = serializers.SerializerMethodField()
    pending_tasks = serializers.SerializerMethodField()
    completed_tasks = serializers.SerializerMethodField()
    hourly_rate = serializers.SerializerMethodField()
    net_balance = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'name', 'mobile', 'email',
            'department', 'role', 'skill_trade', 'joining_date', 'status',
            'aadhaar_number', 'address', 'daily_rate', 'hourly_rate', 'opening_balance', 'net_balance',
            'present_days', 'absent_days', 'leave_balance',
            'current_assignment', 'pending_tasks', 'completed_tasks',
            'created_at',
        ]

    def get_hourly_rate(self, obj):
        return str(hourly_rate_for(obj))

    def get_net_balance(self, obj):
        return str(employee_net_balance(obj))

    def get_current_assignment(self, obj):
        a = obj.assignments.exclude(status='Completed').order_by('-created_at').first()
        if not a:
            return None
        return {
            'id': a.id,
            'task_name': a.task_name,
            'project_name': a.project.project_name if a.project else None,
            'status': a.status,
            'progress_percent': a.progress_percent,
            'priority': a.priority,
            'expected_completion': a.expected_completion,
        }

    def get_pending_tasks(self, obj):
        return obj.assignments.exclude(status='Completed').count()

    def get_completed_tasks(self, obj):
        return obj.assignments.filter(status='Completed').count()


class EmployeeDetailSerializer(serializers.ModelSerializer):
    assignments = EmployeeAssignmentSerializer(many=True, read_only=True)
    documents = EmployeeDocumentSerializer(many=True, read_only=True)
    pending_tasks = serializers.SerializerMethodField()
    completed_tasks = serializers.SerializerMethodField()
    overall_progress = serializers.SerializerMethodField()
    hourly_rate = serializers.SerializerMethodField()
    net_balance = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'name', 'mobile', 'email',
            'department', 'role', 'skill_trade', 'joining_date', 'status',
            'aadhaar_number', 'address', 'daily_rate', 'hourly_rate', 'opening_balance', 'net_balance',
            'present_days', 'absent_days', 'leave_balance', 'notes',
            'assignments', 'documents',
            'pending_tasks', 'completed_tasks', 'overall_progress',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['employee_id', 'created_at', 'updated_at']

    def get_hourly_rate(self, obj):
        return str(hourly_rate_for(obj))

    def get_net_balance(self, obj):
        return str(employee_net_balance(obj))

    def get_pending_tasks(self, obj):
        return obj.assignments.exclude(status='Completed').count()

    def get_completed_tasks(self, obj):
        return obj.assignments.filter(status='Completed').count()

    def get_overall_progress(self, obj):
        assignments = obj.assignments.all()
        if not assignments.exists():
            return 0
        total = sum(a.progress_percent for a in assignments)
        return round(total / assignments.count())


class EmployeeAttendanceSerializer(serializers.ModelSerializer):
    day = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeAttendance
        fields = [
            'id', 'employee', 'date', 'day', 'status', 'hours', 'ot_hours',
            'payment', 'voucher_amount', 'payment_mode', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_day(self, obj):
        return obj.date.strftime('%a')

    def validate(self, attrs):
        employee = attrs.get('employee') or getattr(self.instance, 'employee', None)
        status = attrs.get('status', getattr(self.instance, 'status', 'Not Marked'))
        hours = attrs.get('hours', getattr(self.instance, 'hours', Decimal('0.00')))
        ot_hours = attrs.get('ot_hours', getattr(self.instance, 'ot_hours', Decimal('0.00')))

        if employee and status == 'Present' and not hours:
            attrs['hours'] = Decimal('9.00')
            hours = attrs['hours']

        if employee and status == 'Present':
            attrs['payment'] = payment_for_attendance(employee, hours, ot_hours)
        elif status in ('Absent', 'Not Marked'):
            attrs['payment'] = Decimal('0.00')
            if status == 'Absent':
                attrs['hours'] = Decimal('0.00')
                attrs['ot_hours'] = Decimal('0.00')

        return attrs


class EmployeeVoucherSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)

    class Meta:
        model = EmployeeVoucher
        fields = [
            'id', 'employee', 'employee_name', 'voucher_date', 'amount', 'payment_mode',
            'notes', 'period_start', 'period_end', 'created_at',
        ]
        read_only_fields = ['created_at']
