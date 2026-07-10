from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import Branch, Role, RolePermission
from .permissions import is_super_admin

User = get_user_model()


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name', 'city', 'address', 'is_active', 'created_at']


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = [
            'module', 'can_view', 'can_add', 'can_edit', 'can_delete',
            'can_export', 'can_import', 'can_approve', 'full_access',
        ]


class RoleSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['id', 'name', 'role_type', 'description', 'is_active', 'user_count', 'created_at']

    def get_user_count(self, obj):
        return obj.users.filter(is_active=True).count()


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    initials = serializers.ReadOnlyField()
    is_super_admin = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'name', 'mobile', 'role', 'role_name', 'branch', 'branch_name',
            'is_active', 'initials', 'created_at', 'is_super_admin', 'permissions',
        ]
        extra_kwargs = {
            'role': {'write_only': True},
            'branch': {'write_only': True},
        }

    def get_is_super_admin(self, obj):
        return is_super_admin(obj)

    def get_permissions(self, obj):
        if not obj.role:
            return []
        return RolePermissionSerializer(obj.role.permissions.all(), many=True).data

    def validate_mobile(self, value):
        # BUG-072: mobile now has a real unique=True (null=True for "no
        # phone on file"). Normalize '' to None so two users who both leave
        # mobile blank don't collide on the empty string, which Postgres
        # treats as a real (non-distinct) value unlike NULL.
        return value or None


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['email', 'name', 'mobile', 'role', 'branch', 'password']

    def validate_mobile(self, value):
        return value or None

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=False, allow_blank=True, default='')
    new_password = serializers.CharField(required=True, min_length=8)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data
