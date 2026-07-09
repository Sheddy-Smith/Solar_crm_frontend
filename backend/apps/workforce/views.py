from datetime import datetime

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from .models import Employee, EmployeeAssignment, EmployeeDocument, EmployeeAttendance, EmployeeVoucher
from .serializers import (
    EmployeeListSerializer, EmployeeDetailSerializer,
    EmployeeAssignmentSerializer, EmployeeDocumentSerializer,
    EmployeeAttendanceSerializer, EmployeeVoucherSerializer,
)
from .services import attendance_ledger_payload, week_start_for
from apps.accounts.permissions import HasModulePermission


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.prefetch_related('assignments', 'documents', 'attendance_records', 'vouchers').all()
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'department']
    search_fields = ['name', 'employee_id', 'role', 'mobile', 'skill_trade', 'aadhaar_number']
    ordering_fields = ['name', 'created_at', 'status']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return EmployeeDetailSerializer
        return EmployeeListSerializer

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        qs = Employee.objects.all()
        today = timezone.now().date()
        completed_today = EmployeeAssignment.objects.filter(
            status='Completed',
            updated_at__date=today,
        ).count()
        return Response({
            'total': qs.count(),
            'available': qs.filter(status='Available').count(),
            'assigned': qs.filter(status='Assigned').count(),
            'in_progress': qs.filter(status='In Progress').count(),
            'on_leave': qs.filter(status='On Leave').count(),
            'completed_today': completed_today,
        })

    @action(detail=True, methods=['get'], url_path='summary')
    def summary(self, request, pk=None):
        emp = self.get_object()
        assignments = emp.assignments.all()
        project_ids = assignments.exclude(project=None).values_list('project_id', flat=True)
        unique_projects = set(project_ids)
        active_statuses = ['Pending', 'In Progress', 'On Hold']
        active_proj = assignments.filter(status__in=active_statuses).exclude(project=None).values_list('project_id', flat=True)
        completed_proj = assignments.filter(status='Completed').exclude(project=None).values_list('project_id', flat=True)
        return Response({
            'total_assigned_projects': len(unique_projects),
            'active_projects': len(set(active_proj)),
            'completed_projects': len(set(completed_proj)),
            'pending_tasks': assignments.filter(status__in=['Pending', 'On Hold']).count(),
            'completed_tasks': assignments.filter(status='Completed').count(),
            'total_working_days': emp.present_days,
        })

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        emp = self.get_object()
        assignments = emp.assignments.select_related('project').order_by('-assigned_date')
        data = []
        for a in assignments:
            proj = a.project
            data.append({
                'id': a.id,
                'task_name': a.task_name,
                'project_id': proj.id if proj else None,
                'project_name': proj.project_name if proj else '—',
                'customer_name': proj.customer_name if proj else '—',
                'project_status': proj.status if proj else '—',
                'project_progress': proj.progress_percent if proj else 0,
                'role': emp.role,
                'assigned_date': str(a.assigned_date) if a.assigned_date else '',
                'expected_completion': str(a.expected_completion) if a.expected_completion else '',
                'status': a.status,
                'progress_percent': a.progress_percent,
                'notes': a.notes,
            })
        return Response(data)

    @action(detail=True, methods=['get'], url_path='attendance-ledger')
    def attendance_ledger(self, request, pk=None):
        emp = self.get_object()
        start = request.query_params.get('start_date')
        end = request.query_params.get('end_date')
        if not start or not end:
            return Response({'detail': 'start_date and end_date are required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            start_date = datetime.strptime(start, '%Y-%m-%d').date()
            end_date = datetime.strptime(end, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(attendance_ledger_payload(emp, start_date, end_date))


class EmployeeAttendanceViewSet(viewsets.ModelViewSet):
    queryset = EmployeeAttendance.objects.select_related('employee').all()
    serializer_class = EmployeeAttendanceSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'status', 'date']
    ordering_fields = ['date']

    @action(detail=True, methods=['post'], url_path='mark-present')
    def mark_present(self, request, pk=None):
        record = self.get_object()
        hours = request.data.get('hours', 9)
        ot_hours = request.data.get('ot_hours', 0)
        serializer = self.get_serializer(record, data={
            'employee': record.employee_id,
            'date': record.date,
            'status': 'Present',
            'hours': hours,
            'ot_hours': ot_hours,
            'payment_mode': request.data.get('payment_mode', record.payment_mode),
            'notes': request.data.get('notes', record.notes),
        }, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='mark-absent')
    def mark_absent(self, request, pk=None):
        record = self.get_object()
        serializer = self.get_serializer(record, data={
            'employee': record.employee_id,
            'date': record.date,
            'status': 'Absent',
            'hours': 0,
            'ot_hours': 0,
            'payment_mode': '',
            'notes': request.data.get('notes', record.notes),
        }, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class EmployeeVoucherViewSet(viewsets.ModelViewSet):
    queryset = EmployeeVoucher.objects.select_related('employee').all()
    serializer_class = EmployeeVoucherSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'payment_mode', 'voucher_date']
    ordering_fields = ['voucher_date', 'created_at']


class EmployeeAssignmentViewSet(viewsets.ModelViewSet):
    queryset = EmployeeAssignment.objects.select_related('employee', 'project').all()
    serializer_class = EmployeeAssignmentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['employee', 'status', 'priority', 'project']
    search_fields = ['task_name']

    def perform_create(self, serializer):
        assignment = serializer.save()
        emp = assignment.employee
        if emp.status == 'Available':
            emp.status = 'Assigned'
            emp.save(update_fields=['status'])

    def perform_update(self, serializer):
        assignment = serializer.save()
        emp = assignment.employee
        active = emp.assignments.exclude(status='Completed').exists()
        if not active and emp.status not in ('On Leave',):
            emp.status = 'Available'
            emp.save(update_fields=['status'])
        elif assignment.status == 'In Progress' and emp.status == 'Assigned':
            emp.status = 'In Progress'
            emp.save(update_fields=['status'])


class EmployeeDocumentViewSet(viewsets.ModelViewSet):
    queryset = EmployeeDocument.objects.select_related('employee').all()
    serializer_class = EmployeeDocumentSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee', 'doc_type']
