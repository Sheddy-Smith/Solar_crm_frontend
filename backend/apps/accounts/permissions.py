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


SAFE_HTTP_METHODS = ('GET', 'HEAD', 'OPTIONS')

# Fallback for plain APIViews (no `.action` attribute): map the HTTP method
# to a permission flag. Views can override per-method via `permission_method_map`.
HTTP_METHOD_FLAGS = {
    'GET': 'can_view',
    'HEAD': 'can_view',
    'OPTIONS': 'can_view',
    'POST': 'can_add',
    'PUT': 'can_edit',
    'PATCH': 'can_edit',
    'DELETE': 'can_delete',
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

        action = getattr(view, 'action', None)
        action_map = {**MODULE_ACTION_FLAGS, **getattr(view, 'permission_action_map', {})}
        flag = action_map.get(action) if action else None
        if not flag:
            # Custom actions not explicitly mapped (and plain APIViews with no
            # `.action` at all) fall back to the HTTP method's default flag
            # instead of being denied outright, so full_access roles aren't
            # 403'd on every new @action until someone remembers to map it.
            method_map = {**HTTP_METHOD_FLAGS, **getattr(view, 'permission_method_map', {})}
            flag = method_map.get(request.method)
        if not flag:
            return False

        # Custom actions that serve both reads and writes (e.g. site_survey
        # GET+PUT) map to can_view; an unsafe method must still require edit.
        if flag == 'can_view' and request.method not in SAFE_HTTP_METHODS:
            flag = 'can_edit'

        role = user.role
        if not role:
            return False

        perm = role.permissions.filter(module=module).first()
        if not perm:
            return False
        return perm.full_access or getattr(perm, flag, False)
