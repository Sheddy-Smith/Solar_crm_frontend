from rest_framework.permissions import BasePermission


class IsAdminOrSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return getattr(request.user.role, 'name', '') in ('Super Admin', 'Admin')


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.is_superuser or getattr(request.user.role, 'name', '') == 'Super Admin'


class IsManagerOrAbove(BasePermission):
    ALLOWED_ROLES = ('Super Admin', 'Admin', 'Branch Manager')

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return getattr(request.user.role, 'name', '') in self.ALLOWED_ROLES


class IsTeamLeaderOrAbove(BasePermission):
    ALLOWED_ROLES = ('Super Admin', 'Admin', 'Branch Manager', 'Team Leader')

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return getattr(request.user.role, 'name', '') in self.ALLOWED_ROLES
