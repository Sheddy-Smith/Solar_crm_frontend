from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from .models import Branch, Role, RolePermission
from .serializers import (
    BranchSerializer, RoleSerializer, UserSerializer,
    UserCreateSerializer, ChangePasswordSerializer,
    CustomTokenObtainPairSerializer, RolePermissionSerializer,
)
from .permissions import IsSuperAdmin, is_super_admin

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [IsSuperAdmin]
    search_fields = ['name', 'city']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


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
    queryset = User.objects.select_related('role', 'branch').all()
    permission_classes = [IsSuperAdmin]
    search_fields = ['name', 'email', 'mobile']
    filterset_fields = ['role', 'branch', 'is_active']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        if self.action in ('me', 'change_password'):
            return [IsAuthenticated()]
        return [IsSuperAdmin()]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

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
        user.is_active = not user.is_active
        user.save()
        return Response({'is_active': user.is_active})
