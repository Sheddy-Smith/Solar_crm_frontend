import threading
import time
from collections import defaultdict, deque

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import Throttled
from malwa_solar.throttling import SafeScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from django.conf import settings
from django.contrib.auth import get_user_model
from .models import Branch, Role, RolePermission
from .serializers import (
    BranchSerializer, RoleSerializer, UserSerializer,
    UserCreateSerializer, ChangePasswordSerializer,
    CustomTokenObtainPairSerializer, RolePermissionSerializer,
)
from .permissions import IsAdminOrSuperAdmin, IsSuperAdmin, HasModulePermission, is_super_admin

User = get_user_model()


def _parse_throttle_rate(rate):
    """Parse a DRF throttle rate string ('10/min') into (num_requests, period_seconds)."""
    try:
        num, period = rate.split('/')
        num = int(num)
    except (ValueError, AttributeError):
        return 10, 60
    period = period.strip().lower()
    seconds_by_period = {
        's': 1, 'sec': 1, 'second': 1,
        'm': 60, 'min': 60, 'minute': 60,
        'h': 3600, 'hour': 3600,
        'd': 86400, 'day': 86400,
    }
    return num, seconds_by_period.get(period, 60)


class _InMemoryLoginThrottle:
    """BUG-023: degraded-mode fallback used only when the cache-backed
    ScopedRateThrottle itself raises (Redis unreachable/misconfigured etc).
    The existing fail-open behavior (see CustomTokenObtainPairView.check_throttles)
    was an intentional fix for a real production 500 outage and must stay —
    this does NOT revert to fail-closed. Instead of skipping rate limiting
    entirely during a cache outage, it bounds brute-force with a simple
    in-process fixed-window counter per client IP. Not distributed-safe (each
    worker process has its own counters) — that's an acceptable trade-off
    for a fallback that only activates while the shared cache is down.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._hits = defaultdict(deque)

    def allow(self, request):
        rate = settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {}).get('login', '10/min')
        limit, window_seconds = _parse_throttle_rate(rate)
        ident = request.META.get('REMOTE_ADDR', 'unknown')
        now = time.monotonic()
        with self._lock:
            hits = self._hits[ident]
            while hits and now - hits[0] > window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                wait = window_seconds - (now - hits[0])
                return False, max(wait, 1)
            hits.append(now)
            return True, None


_login_throttle_fallback = _InMemoryLoginThrottle()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [SafeScopedRateThrottle]
    throttle_scope = 'login'

    def check_throttles(self, request):
        # Throttling is a nice-to-have, not something login can afford to
        # depend on: if the Redis-backed throttle cache errors (unreachable,
        # bad credentials, free-tier hiccup), this call happens in
        # dispatch()/initial() *before* post()'s own try/except ever runs,
        # so an unhandled cache error here previously took down the entire
        # login endpoint with a raw 500. Fail open instead of raising a raw
        # 500 — but "fail open" no longer means "skip rate limiting
        # entirely": fall back to a simple in-process limiter (BUG-023) so
        # brute-force is still bounded during a cache outage. A real
        # Throttled (rate exceeded via the normal cache-backed throttle)
        # still passes straight through as before.
        try:
            super().check_throttles(request)
        except Throttled:
            raise
        except Exception:
            allowed, wait = _login_throttle_fallback.allow(request)
            if not allowed:
                raise Throttled(wait=wait)

    def post(self, request, *args, **kwargs):
        # Invalid credentials make super().post() RAISE (AuthenticationFailed),
        # not return a non-200 response — so failed attempts must be logged in
        # an except block or they are never recorded at all.
        try:
            response = super().post(request, *args, **kwargs)
        except Exception:
            self._log_attempt(request, success=False)
            raise
        if response.status_code == 200:
            self._log_attempt(request, success=True)
        else:
            self._log_attempt(request, success=False)
        return response

    @staticmethod
    def _log_attempt(request, success):
        try:
            from apps.crm_settings.services import log_user_activity
            if success:
                log_user_activity(request, 'Login', 'Authentication', 'User logged in successfully')
            else:
                attempted_email = request.data.get('email', '') if hasattr(request, 'data') else ''
                log_user_activity(
                    request,
                    'Login Failed',
                    'Authentication',
                    f'Failed login attempt for {attempted_email}' if attempted_email else 'Failed login attempt',
                    status='Failed',
                )
        except Exception:
            pass


class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [IsSuperAdmin]
    search_fields = ['name', 'city']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAdminOrSuperAdmin()]
        return [IsSuperAdmin()]


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsSuperAdmin]
    search_fields = ['name']
    ordering = ['name']

    @action(detail=True, methods=['get', 'put'])
    def permissions(self, request, pk=None):
        role = self.get_object()
        existing = {perm.module: perm for perm in role.permissions.all()}
        for module, _ in RolePermission.MODULE_CHOICES:
            if module not in existing:
                existing[module] = RolePermission.objects.create(role=role, module=module)

        if request.method == 'GET':
            ordered = [existing[module] for module, _ in RolePermission.MODULE_CHOICES]
            return Response(RolePermissionSerializer(ordered, many=True).data)

        incoming = request.data if isinstance(request.data, list) else request.data.get('permissions', [])
        valid_modules = dict(RolePermission.MODULE_CHOICES)
        for entry in incoming:
            module = entry.get('module')
            if module not in valid_modules:
                continue
            perm = existing[module]
            for field in ('can_view', 'can_add', 'can_edit', 'can_delete', 'can_export', 'can_import', 'can_approve', 'full_access'):
                if field in entry:
                    setattr(perm, field, bool(entry[field]))
            perm.save()
        ordered = [existing[module] for module, _ in RolePermission.MODULE_CHOICES]
        return Response(RolePermissionSerializer(ordered, many=True).data)


class UserViewSet(viewsets.ModelViewSet):
    # BUG-018: list/create/update/delete are gated by the 'User Management'
    # role-matrix module (same pattern as every other viewset) instead of
    # being hard-locked to Super Admin, so roles can actually be granted
    # user-admin access via the permission matrix as the UI implies.
    # Highly sensitive actions stay locked down separately below:
    # `toggle_active` (can deactivate any account) requires Super Admin
    # outright, and `change_password` keeps its existing self-or-Super-Admin
    # check in the action body.
    queryset = User.objects.select_related('role', 'branch').all()
    permission_classes = [HasModulePermission]
    permission_module = 'User Management'
    search_fields = ['name', 'email', 'mobile']
    filterset_fields = ['role', 'branch', 'is_active']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        if self.action in ('me', 'change_password', 'verify_password'):
            return [IsAuthenticated()]
        # Account mutations (add/edit/delete/activate) are Super Admin only;
        # list/retrieve stay on the User Management module permission.
        if self.action in ('toggle_active', 'create', 'update', 'partial_update', 'destroy'):
            return [IsSuperAdmin()]
        return [HasModulePermission()]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response(
                {'detail': 'You cannot delete your own account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    def get_throttles(self):
        # verify_password is a password oracle for the caller's own account;
        # rate-limit it like login so a stolen session can't brute-force it.
        if self.action == 'verify_password':
            self.throttle_scope = 'login'
            return [SafeScopedRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        # UserCreateSerializer has no id/role_name/branch_name, so echo the
        # full read serializer back — the frontend renders the new row from
        # this response and otherwise ends up with an id-less entry.
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='verify-password')
    def verify_password(self, request):
        password = request.data.get('password', '')
        if not request.user.check_password(password):
            return Response({'detail': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'verified': True})

    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        user = self.get_object()
        is_self = user == request.user
        if not is_self and not is_super_admin(request.user):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        if is_self and not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': 'Wrong password.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'message': 'Password changed successfully.'})

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        if user == request.user and user.is_active:
            return Response(
                {'detail': 'You cannot deactivate your own account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = not user.is_active
        user.save()
        return Response({'is_active': user.is_active})
