import hashlib

from django.conf import settings
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.core.cache import cache

from .models import PushSubscription
from .push import vapid_configured
from .serializers import NotificationSerializer
from .services import UNREAD_CACHE_TTL, invalidate_unread_cache, notifications_for, unread_cache_key


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

    def list(self, request, *args, **kwargs):
        limit = min(int(request.query_params.get('limit') or 30), 100)
        items = list(self.get_queryset()[:limit])
        # Only check read state for the page — avoid loading the full M2M set.
        page_ids = [row.id for row in items]
        read_ids = set(
            request.user.read_notifications.filter(id__in=page_ids).values_list('id', flat=True)
        ) if page_ids else set()
        serializer = self.get_serializer(items, many=True, context={
            **self.get_serializer_context(),
            'read_ids': read_ids,
        })
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        key = unread_cache_key(request.user.id)
        cached = cache.get(key)
        if cached is not None:
            return Response({'count': int(cached)})
        count = notifications_for(request.user).exclude(read_by=request.user).count()
        cache.set(key, count, UNREAD_CACHE_TTL)
        return Response({'count': count})

    @action(detail=False, methods=['post'], url_path='mark-read')
    def mark_read(self, request):
        ids = request.data.get('ids') or []
        if not isinstance(ids, list):
            ids = [ids]
        visible = notifications_for(request.user).filter(id__in=ids)
        request.user.read_notifications.add(*visible)
        invalidate_unread_cache(request.user.id)
        return Response({'marked': visible.count()})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        unread = list(notifications_for(request.user).exclude(read_by=request.user))
        request.user.read_notifications.add(*unread)
        invalidate_unread_cache(request.user.id)
        return Response({'marked': len(unread)})

    @action(detail=False, methods=['get'], url_path='push-vapid-public-key')
    def push_vapid_public_key(self, request):
        if not vapid_configured():
            return Response({'configured': False, 'publicKey': ''}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({
            'configured': True,
            'publicKey': settings.VAPID_PUBLIC_KEY,
        })

    @action(detail=False, methods=['post'], url_path='push-subscription')
    def push_subscription(self, request):
        endpoint = (request.data.get('endpoint') or '').strip()
        keys = request.data.get('keys') or {}
        p256dh = (keys.get('p256dh') or request.data.get('p256dh') or '').strip()
        auth = (keys.get('auth') or request.data.get('auth') or '').strip()
        if not endpoint or not p256dh or not auth:
            return Response({'detail': 'endpoint, p256dh and auth are required.'}, status=status.HTTP_400_BAD_REQUEST)
        endpoint_hash = hashlib.sha256(endpoint.encode('utf-8')).hexdigest()
        user_agent = (request.META.get('HTTP_USER_AGENT') or '')[:255]
        row, _created = PushSubscription.objects.update_or_create(
            endpoint_hash=endpoint_hash,
            defaults={
                'user': request.user,
                'endpoint': endpoint,
                'p256dh': p256dh,
                'auth': auth,
                'user_agent': user_agent,
            },
        )
        return Response({'id': row.id, 'ok': True})

    @action(detail=False, methods=['post'], url_path='push-subscription/delete')
    def push_subscription_delete(self, request):
        endpoint = (request.data.get('endpoint') or '').strip()
        qs = PushSubscription.objects.filter(user=request.user)
        if endpoint:
            endpoint_hash = hashlib.sha256(endpoint.encode('utf-8')).hexdigest()
            qs = qs.filter(endpoint_hash=endpoint_hash)
        deleted, _ = qs.delete()
        return Response({'deleted': deleted})
