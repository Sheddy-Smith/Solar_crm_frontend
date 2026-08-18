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
            'can_export', 'can_import', 'can_approve', 'can_assign', 'full_access',
        ]


class RoleSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['id', 'name', 'role_type', 'description', 'is_active', 'user_count', 'created_at']

    def get_user_count(self, obj):
        return obj.users.filter(is_active=True, is_deleted=False).count()


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
            'is_active', 'is_deleted', 'initials', 'created_at', 'is_super_admin', 'permissions',
        ]

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
    """Login accepts email, display name (username), or mobile.

    The User model has no separate username field — staff type the person's
    name (e.g. "Roshini") into the Email / Username box. Resolve that to the
    canonical email before SimpleJWT's email-based authenticate runs.
    """

    @staticmethod
    def resolve_login_identifier(login_id):
        from rest_framework.exceptions import AuthenticationFailed

        identifier = (login_id or '').strip()
        if not identifier:
            return None

        qs = User.objects.filter(is_active=True, is_deleted=False)

        by_email = qs.filter(email__iexact=identifier).first()
        if by_email:
            return by_email

        digits = ''.join(ch for ch in identifier if ch.isdigit())
        if len(digits) >= 10:
            by_mobile = qs.filter(mobile=digits[-10:]).first()
            if by_mobile:
                return by_mobile

        name_matches = list(qs.filter(name__iexact=identifier)[:2])
        if len(name_matches) == 1:
            return name_matches[0]
        if len(name_matches) > 1:
            raise AuthenticationFailed(
                'Multiple accounts match this username. Please login with email.',
            )
        return None

    def validate(self, attrs):
        from rest_framework.exceptions import AuthenticationFailed

        login_id = attrs.get(self.username_field)
        user = self.resolve_login_identifier(login_id)
        if user is None:
            raise AuthenticationFailed('No active account found with the given credentials')
        attrs[self.username_field] = user.email

        data = super().validate(attrs)
        if getattr(self.user, 'is_deleted', False):
            raise AuthenticationFailed('This account has been deleted.')
        data['user'] = UserSerializer(self.user).data
        return data
