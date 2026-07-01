from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from .models import Employee, EmployeeAssignment, EmployeeDocument
from .serializers import (
    EmployeeListSerializer, EmployeeDetailSerializer,
    EmployeeAssignmentSerializer, EmployeeDocumentSerializer,
)
from apps.accounts.permissions import HasModulePermission


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.prefetch_related('assignments', 'documents').all()
    permission_classes = [HasModulePermission]
    permission_module = 'Project Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'department']
    search_fields = ['name', 'employee_id', 'role', 'mobile']
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
