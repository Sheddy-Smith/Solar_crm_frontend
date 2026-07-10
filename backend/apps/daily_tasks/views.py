from django.db.models import Count, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission

from .models import DailyTask
from .serializers import DailyTaskSerializer


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
