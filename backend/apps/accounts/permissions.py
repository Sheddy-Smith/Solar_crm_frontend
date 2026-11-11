from rest_framework.permissions import BasePermission

# Roles whose record visibility is restricted to their own assigned leads —
# a (Tele) Sales Executive must never see another executive's leads, projects,
# follow-ups or quotations.
LEAD_SCOPED_ROLES = ('Sales Executive', 'Tele Sales Executive')


def is_lead_scoped(user):
    if not user or not user.is_authenticated:
        return False
    return getattr(getattr(user, 'role', None), 'name', '') in LEAD_SCOPED_ROLES


def lead_owner_q(user, prefix=''):
    """Q() scoping lead-scoped roles to their own leads.

    Sales Executive: leads assigned to them OR leads they added (created_by).
    Tele Sales Executive: ONLY leads assigned to them (Tele portal My Leads —
    unassigned pool leads stay with managers until explicitly assigned).

    Creator `is_active` must never gate assignee visibility. `prefix` is prepended
    to field names (e.g. 'lead__' for FollowUp). Returns None when the user is
    not lead-scoped (they see everything)."""
    from django.db.models import Q

    role = getattr(getattr(user, 'role', None), 'name', '')
    if role not in LEAD_SCOPED_ROLES:
        return None
    created = f'{prefix}created_by'
    assigned = f'{prefix}assigned_to'
    if role == 'Sales Executive':
        return Q(**{created: user}) | Q(**{assigned: user})
    # Tele Sales Executive — assigned leads only.
    return Q(**{assigned: user})


def lead_owner_filter(user, prefix=''):
    """Alias for `lead_owner_q` — returns a Django Q (or None).

    Call sites must use `qs.filter(filt)` (not `filter(**filt)`)."""
    return lead_owner_q(user, prefix=prefix)


def is_own_lead(user, lead):
    """True if `lead` belongs to this (Tele) Sales Executive.

    Sales Executive: assigned to them OR created by them.
    Tele Sales Executive: assigned to them only.
    Non-scoped roles always own everything."""
    role = getattr(getattr(user, 'role', None), 'name', '')
    if role not in LEAD_SCOPED_ROLES:
        return True
    if lead.assigned_to_id == user.id:
        return True
    if role == 'Sales Executive':
        return lead.created_by_id == user.id
    return False


def is_super_admin(user):
    """True only for the Super Admin role / Django superuser.

    Day-to-day module access (including Users & Roles screens) is controlled
    by the Role → Permissions matrix in Settings UI — not by hard-coded role
    names. Keep this helper for irreversible safeguards only (e.g. cannot
    delete the last Super Admin / Super Admin role).
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    role_name = (getattr(getattr(user, 'role', None), 'name', '') or '').strip().lower()
    return role_name == 'super admin'


def can_manage_leads(user):
    """True when the user's Lead permission row allows Assign (or full_access).

    Used for lead (re)assignment and deleting Won leads. Controlled from
    Settings → Roles & Permissions → Lead → Assign — not by hardcoded role names.
    """
    if not user or not user.is_authenticated:
        return False
    if is_super_admin(user):
        return True
    role = getattr(user, 'role', None)
    if not role:
        return False
    perm = role.permissions.filter(module='Lead').first()
    if not perm:
        return False
    return bool(perm.full_access or perm.can_assign)


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
    'check_ivrs': 'can_view',
    'create': 'can_add',
    'update': 'can_edit',
    'partial_update': 'can_edit',
    'assign': 'can_assign',
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

        action = getattr(view, 'action', None)
        module_map = getattr(view, 'permission_module_map', {})
        module = module_map.get(action) if action else None
        modules = None
        if not module:
            modules = getattr(view, 'permission_modules', None)
            if modules:
                modules = tuple(modules)
            else:
                module = getattr(view, 'permission_module', None)
        if not module and not modules:
            return False

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

        check_modules = modules or (module,)
        for mod in check_modules:
            perm = role.permissions.filter(module=mod).first()
            if perm and (perm.full_access or getattr(perm, flag, False)):
                return True
        return False
