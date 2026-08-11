from django.db.models import Count, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import HasModulePermission, is_super_admin

from .access import (
    can_assign_daily_tasks,
    can_assign_to_user,
    can_see_staff_task,
    can_update_staff_task_status,
    is_branch_manager,
)
from .models import DailyTask, StaffDailyTask
from .serializers import DailyTaskSerializer, StaffDailyTaskSerializer


class DailyTaskViewSet(viewsets.ModelViewSet):
    queryset = DailyTask.objects.select_related('created_by', 'assigned_to').all()
    serializer_class = DailyTaskSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Daily Tasks'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'status', 'task_date', 'assigned_to']
    search_fields = ['summary_text', 'notes', 'assigned_to__name']
    ordering_fields = ['task_date', 'created_at', 'status']

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(task_date__gte=date_from)
        if date_to:
            qs = qs.filter(task_date__lte=date_to)
        return qs

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        rows = DailyTask.objects.values('category').annotate(
            total=Count('id'),
            completed=Count('id', filter=Q(status='Completed')),
        )
        payload = {
            row['category']: {'total': row['total'], 'completed': row['completed']}
            for row in rows
        }
        for key, _ in DailyTask.CATEGORY_CHOICES:
            payload.setdefault(key, {'total': 0, 'completed': 0})
        return Response(payload)


class StaffDailyTaskViewSet(viewsets.ModelViewSet):
    queryset = StaffDailyTask.objects.select_related(
        'assigned_by', 'assigned_to', 'assigned_to__role', 'branch',
    ).all()
    serializer_class = StaffDailyTaskSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Daily Tasks'
    permission_action_map = {
        'assignees': 'can_add',
        'update_status': 'can_edit',
        'destroy': 'can_add',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'task_date', 'assigned_to', 'assigned_by', 'branch']
    search_fields = ['title', 'description', 'assigned_to__name', 'assigned_by__name']
    ordering_fields = ['task_date', 'due_date', 'created_at', 'status']
    http_method_names = ['get', 'post', 'patch', 'head', 'options', 'delete']

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if is_super_admin(user):
            return qs
        scoped = Q(assigned_to=user) | Q(assigned_by=user)
        if user.branch_id and (is_branch_manager(user) or can_assign_daily_tasks(user)):
            scoped |= Q(branch_id=user.branch_id)
        return qs.filter(scoped).distinct()

    def perform_create(self, serializer):
        assignee = serializer.validated_data.get('assigned_to')
        if not can_assign_to_user(self.request.user, assignee):
            raise PermissionDenied('You can only assign Daily Tasks to authorized users.')
        serializer.save()

    def update(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Use PATCH /update_status/ to change Completed / Not Completed only.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        # Block generic PATCH of title/assignment. Status-only goes through update_status.
        keys = {str(k) for k in request.data.keys()}
        if keys and keys <= {'status'}:
            return self.update_status(request, pk=kwargs.get('pk'))
        raise PermissionDenied('Task details cannot be edited. Only status can be updated.')

    def destroy(self, request, *args, **kwargs):
        task = self.get_object()
        user = request.user
        if not (is_super_admin(user) or (can_assign_daily_tasks(user) and task.assigned_by_id == user.id)):
            raise PermissionDenied('You cannot delete this Daily Task.')
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['patch'], url_path='update_status')
    def update_status(self, request, pk=None):
        task = self.get_object()
        if not can_see_staff_task(request.user, task):
            raise PermissionDenied('You cannot access this Daily Task.')
        if not can_update_staff_task_status(request.user, task):
            raise PermissionDenied('You do not have Edit permission to update task status.')
        new_status = request.data.get('status')
        if new_status not in {StaffDailyTask.STATUS_COMPLETED, StaffDailyTask.STATUS_NOT_COMPLETED}:
            raise ValidationError({'status': 'Status must be Completed or Not Completed.'})
        task.status = new_status
        task.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(task).data)

    @action(detail=False, methods=['get'])
    def assignees(self, request):
        if not can_assign_daily_tasks(request.user):
            raise PermissionDenied('You cannot assign Daily Tasks.')
        qs = User.objects.filter(is_deleted=False, is_active=True).select_related('role', 'branch')
        if not is_super_admin(request.user):
            if not request.user.branch_id:
                qs = qs.none()
            else:
                qs = qs.filter(branch_id=request.user.branch_id)
        rows = [
            {
                'id': item.id,
                'name': item.name,
                'email': item.email,
                'role_name': item.role_name,
                'branch_name': item.branch_name,
            }
            for item in qs.order_by('name')[:500]
        ]
        return Response(rows)
