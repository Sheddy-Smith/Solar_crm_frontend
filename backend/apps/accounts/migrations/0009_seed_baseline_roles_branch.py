from django.db import migrations

# Baseline system roles + permission matrix (mirrors seed_demo_data, minus
# the demo users/passwords which must never reach production — BUG-049).
# A fresh production database previously had zero roles/branches, so the
# Add-User modal's Role/Branch dropdowns were empty and no user could be
# assigned a role at all.


def seed_roles_and_branch(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    RolePermission = apps.get_model('accounts', 'RolePermission')
    Branch = apps.get_model('accounts', 'Branch')

    all_modules = [
        'Dashboard', 'Leads', 'Follow-ups', 'IVRS Management', 'Approvals',
        'Project Management', 'Workforce', 'Liaisoning & Commissioning',
        'O&M', 'Accounts', 'Inventory', 'Daily Tasks', 'AMC & Warranty',
        'Reports', 'User Management', 'Settings',
    ]

    role_matrix = {
        'Super Admin': {m: {'full_access': True} for m in all_modules},
        'Admin': {m: {'full_access': m != 'User Management'} for m in all_modules},
        'Branch Manager': {
            'Leads': {'full_access': True}, 'Follow-ups': {'full_access': True},
            'Approvals': {'full_access': True}, 'Project Management': {'full_access': True},
            'Accounts': {'can_view': True, 'can_export': True},
            'Reports': {'can_view': True, 'can_export': True},
            'Dashboard': {'can_view': True},
            'IVRS Management': {'can_view': True},
            'Liaisoning & Commissioning': {'can_view': True},
            'O&M': {'can_view': True},
            'Inventory': {'can_view': True, 'can_add': True, 'can_edit': True},
            'AMC & Warranty': {'can_view': True, 'can_add': True, 'can_edit': True},
            'Daily Tasks': {'full_access': True},
            'Workforce': {'can_view': True, 'can_add': True, 'can_edit': True},
        },
        'Team Leader': {
            'Leads': {'can_view': True, 'can_add': True, 'can_edit': True},
            'Follow-ups': {'full_access': True},
            'Approvals': {'can_view': True},
            'Project Management': {'can_view': True, 'can_edit': True},
            'Dashboard': {'can_view': True},
            'Reports': {'can_view': True},
            'Inventory': {'can_view': True},
            'AMC & Warranty': {'can_view': True},
            'Daily Tasks': {'can_view': True, 'can_add': True, 'can_edit': True},
        },
        'Sales Executive': {
            'Leads': {'can_view': True, 'can_add': True, 'can_edit': True},
            'Follow-ups': {'can_view': True, 'can_add': True, 'can_edit': True},
            'Dashboard': {'can_view': True},
            'Reports': {'can_view': True},
            'Inventory': {'can_view': True},
            'AMC & Warranty': {'can_view': True},
            'Daily Tasks': {'can_view': True, 'can_add': True},
        },
        'Viewer': {
            'Leads': {'can_view': True}, 'Follow-ups': {'can_view': True},
            'Project Management': {'can_view': True}, 'Accounts': {'can_view': True},
            'Reports': {'can_view': True}, 'Dashboard': {'can_view': True},
        },
    }

    for role_name, module_flags in role_matrix.items():
        role, _ = Role.objects.get_or_create(
            name=role_name, defaults={'role_type': 'system', 'is_active': True},
        )
        for module in all_modules:
            flags = module_flags.get(module)
            if not flags:
                continue
            # get_or_create (not update_or_create): never clobber permission
            # tweaks an admin already made through the Roles & Permissions UI.
            RolePermission.objects.get_or_create(
                role=role, module=module, defaults=flags,
            )

    # Only give a brand-new install a starter branch; respect existing setups.
    if not Branch.objects.exists():
        Branch.objects.create(name='Head Office', city='Indore', is_active=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_seed_daily_tasks_permission'),
    ]

    operations = [
        migrations.RunPython(seed_roles_and_branch, noop_reverse),
    ]
