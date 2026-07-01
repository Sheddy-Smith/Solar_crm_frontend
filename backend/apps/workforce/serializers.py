from rest_framework import serializers
from .models import Employee, EmployeeAssignment, EmployeeDocument


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeDocument
        fields = ['id', 'employee', 'doc_type', 'name', 'file', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class EmployeeAssignmentSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.project_name', read_only=True)
    project_id_code = serializers.CharField(source='project.project_id', read_only=True)

    class Meta:
        model = EmployeeAssignment
        fields = [
            'id', 'employee', 'project', 'project_name', 'project_id_code',
            'task_name', 'assigned_date', 'expected_completion',
            'priority', 'progress_percent', 'status', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class EmployeeListSerializer(serializers.ModelSerializer):
    current_assignment = serializers.SerializerMethodField()
    pending_tasks = serializers.SerializerMethodField()
    completed_tasks = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'name', 'mobile', 'email',
            'department', 'role', 'joining_date', 'status',
            'present_days', 'absent_days', 'leave_balance',
            'current_assignment', 'pending_tasks', 'completed_tasks',
            'created_at',
        ]

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

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_id', 'name', 'mobile', 'email',
            'department', 'role', 'joining_date', 'status',
            'present_days', 'absent_days', 'leave_balance', 'notes',
            'assignments', 'documents',
            'pending_tasks', 'completed_tasks', 'overall_progress',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['employee_id', 'created_at', 'updated_at']

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
