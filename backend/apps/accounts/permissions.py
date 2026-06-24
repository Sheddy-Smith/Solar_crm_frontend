from rest_framework.permissions import BasePermission


def is_super_admin(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return getattr(user.role, 'name', '') == 'Super Admin'


class IsAdminOrSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        if is_super_admin(request.user):
            return True
        if not request.user.is_authenticated:
            return False
        return getattr(request.user.role, 'name', '') == 'Admin'


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_super_admin(request.user)


class IsManagerOrAbove(BasePermission):
    ALLOWED_ROLES = ('Admin', 'Branch Manager')

    def has_permission(self, request, view):
        if is_super_admin(request.user):
            return True
        if not request.user.is_authenticated:
            return False
        return getattr(request.user.role, 'name', '') in self.ALLOWED_ROLES


class IsTeamLeaderOrAbove(BasePermission):
    ALLOWED_ROLES = ('Admin', 'Branch Manager', 'Team Leader')

    def has_permission(self, request, view):
        if is_super_admin(request.user):
            return True
        if not request.user.is_authenticated:
            return False
        return getattr(request.user.role, 'name', '') in self.ALLOWED_ROLES


MODULE_ACTION_FLAGS = {
    'list': 'can_view',
    'retrieve': 'can_view',
    'overdue': 'can_view',
    'today_followups': 'can_view',
    'stats': 'can_view',
    'analytics': 'can_view',
    'recent': 'can_view',
    'summary': 'can_view',
    'system_config': 'can_view',
    'site_survey': 'can_view',
    'create': 'can_add',
    'update': 'can_edit',
    'partial_update': 'can_edit',
    'assign': 'can_edit',
    'update_status': 'can_edit',
    'update_progress': 'can_edit',
    'destroy': 'can_delete',
    'export': 'can_export',
    'import_data': 'can_import',
    'approve': 'can_approve',
    'reject': 'can_approve',
}


class HasModulePermission(BasePermission):
    """Gates a viewset action against the requesting user's Role.permissions row
    for the module declared as `permission_module` on the view. Only the Super
    Admin bypasses this check; every other role's access is whatever the Super
    Admin has granted on that role's permission matrix."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if is_super_admin(user):
            return True

        module = getattr(view, 'permission_module', None)
        if not module:
            return False

        action_map = {**MODULE_ACTION_FLAGS, **getattr(view, 'permission_action_map', {})}
        flag = action_map.get(view.action)
        if not flag:
            return False

        role = user.role
        if not role:
            return False

        perm = role.permissions.filter(module=module).first()
        if not perm:
            return False
        return perm.full_access or getattr(perm, flag, False)
