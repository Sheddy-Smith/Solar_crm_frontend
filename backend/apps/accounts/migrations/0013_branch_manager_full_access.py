from django.db import migrations

# Branch Manager should match Super Admin on the module permission matrix
# (View/Add/Edit/Delete/Export/Import/Approve + full_access) for every module.


def grant_branch_manager_full_access(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    RolePermission = apps.get_model('accounts', 'RolePermission')

    role = Role.objects.filter(name='Branch Manager').first()
    if not role:
        return

    # Historical migration models do not expose MODULE_CHOICES — keep in sync
    # with apps.accounts.models.RolePermission.MODULE_CHOICES.
    all_modules = [
        'Dashboard', 'Leads', 'Follow-ups', 'IVRS Management', 'Approvals',
        'Project Management', 'Workforce', 'Liaisoning & Commissioning',
        'O&M', 'Accounts', 'Inventory', 'Daily Tasks', 'AMC & Warranty',
        'Reports', 'User Management', 'Settings',
    ]
    full_flags = {
        'can_view': True,
        'can_add': True,
        'can_edit': True,
        'can_delete': True,
        'can_export': True,
        'can_import': True,
        'can_approve': True,
        'full_access': True,
    }

    for module in all_modules:
        RolePermission.objects.update_or_create(
            role=role,
            module=module,
            defaults=full_flags,
        )


def noop_reverse(apps, schema_editor):
    # Intentionally keep elevated permissions — do not silently strip access.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_user_soft_delete'),
    ]

    operations = [
        migrations.RunPython(grant_branch_manager_full_access, noop_reverse),
    ]
