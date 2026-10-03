from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import NotificationSerializer
from .services import notifications_for


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Every signed-in user sees alerts addressed to them plus broadcasts for
    modules their role can view — no extra module permission needed."""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = notifications_for(self.request.user)
        params = self.request.query_params
        if params.get('category'):
            qs = qs.filter(category=params['category'])
        if params.get('severity'):
            qs = qs.filter(severity=params['severity'])
        if params.get('unread') in ('1', 'true'):
            qs = qs.exclude(read_by=self.request.user)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['read_ids'] = set(self.request.user.read_notifications.values_list('id', flat=True))
        return ctx

    def list(self, request, *args, **kwargs):
        limit = min(int(request.query_params.get('limit') or 30), 100)
        items = self.get_queryset()[:limit]
        return Response(self.get_serializer(items, many=True).data)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        return Response({'count': notifications_for(request.user).exclude(read_by=request.user).count()})

    @action(detail=False, methods=['post'], url_path='mark-read')
    def mark_read(self, request):
        ids = request.data.get('ids') or []
        if not isinstance(ids, list):
            ids = [ids]
        visible = notifications_for(request.user).filter(id__in=ids)
        request.user.read_notifications.add(*visible)
        return Response({'marked': visible.count()})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        unread = list(notifications_for(request.user).exclude(read_by=request.user))
        request.user.read_notifications.add(*unread)
        return Response({'marked': len(unread)})
