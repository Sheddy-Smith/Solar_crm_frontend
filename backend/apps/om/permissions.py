from apps.accounts.permissions import HasModulePermission, SAFE_HTTP_METHODS, is_super_admin

FIELD_WORK_MODULE = 'O&M Field Work'


def _module_perm(user, module):
    role = getattr(user, 'role', None)
    return role.permissions.filter(module=module).first() if role else None


def has_full_om_access(user):
    if is_super_admin(user):
        return True
    perm = _module_perm(user, 'O&M')
    return bool(perm and (perm.full_access or perm.can_view))


def has_field_work_access(user, write=False):
    perm = _module_perm(user, FIELD_WORK_MODULE)
    if not perm:
        return False
    if perm.full_access:
        return True
    return bool(perm.can_edit if write else perm.can_view)


class OmOrFieldWorkPermission(HasModulePermission):
    """Normal O&M module check; actions listed in the view's
    `field_work_actions` are also open to engineers who only hold the
    "O&M Field Work" permission (their querysets are then limited to work
    assigned to them)."""

    def has_permission(self, request, view):
        if super().has_permission(request, view):
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(view, 'action', None) not in getattr(view, 'field_work_actions', ()):
            return False
        return has_field_work_access(user, write=request.method not in SAFE_HTTP_METHODS)
