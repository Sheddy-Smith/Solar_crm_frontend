from apps.accounts.permissions import is_super_admin


DAILY_TASKS_MODULE = 'Daily Tasks'


def _role_name(user):
    return (getattr(getattr(user, 'role', None), 'name', '') or '').strip()


def is_branch_manager(user):
    return _role_name(user).lower() == 'branch manager'


def module_flag(user, flag):
    if not user or not user.is_authenticated:
        return False
    if is_super_admin(user):
        return True
    role = getattr(user, 'role', None)
    if not role:
        return False
    perm = role.permissions.filter(module=DAILY_TASKS_MODULE).first()
    if not perm:
        return False
    return bool(perm.full_access or getattr(perm, flag, False))


def can_view_daily_tasks(user):
    return module_flag(user, 'can_view')


def can_assign_daily_tasks(user):
    return module_flag(user, 'can_add')


def can_edit_daily_task_status(user):
    return module_flag(user, 'can_edit')


def can_see_staff_task(user, task):
    if is_super_admin(user):
        return True
    if not can_view_daily_tasks(user):
        return False
    if task.assigned_to_id == user.id or task.assigned_by_id == user.id:
        return True
    if is_branch_manager(user) and user.branch_id and task.branch_id == user.branch_id:
        return True
    if can_assign_daily_tasks(user) and user.branch_id and task.branch_id == user.branch_id:
        return True
    return False


def can_update_staff_task_status(user, task):
    if not can_edit_daily_task_status(user):
        return False
    if is_super_admin(user):
        return True
    if task.assigned_to_id == user.id:
        return True
    if is_branch_manager(user) and user.branch_id and task.branch_id == user.branch_id:
        return True
    return False


def can_assign_to_user(actor, target):
    if not can_assign_daily_tasks(actor) or not target:
        return False
    if is_super_admin(actor):
        return True
    if not actor.branch_id or target.branch_id != actor.branch_id:
        return False
    return True
