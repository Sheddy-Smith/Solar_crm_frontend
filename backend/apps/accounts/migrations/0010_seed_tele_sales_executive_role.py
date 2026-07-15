from django.db import migrations

# Tele Sales Executive: the Tele Executive portal role. Handles calls,
# follow-ups and lead updates for leads assigned to them only — lead/project
# visibility is additionally scoped to `assigned_to=user` in the viewsets
# (see apps.accounts.permissions.is_lead_scoped).


def seed_tele_sales_executive(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    RolePermission = apps.get_model('accounts', 'RolePermission')

    role, _ = Role.objects.get_or_create(
        name='Tele Sales Executive',
        defaults={
            'role_type': 'system',
            'is_active': True,
            'description': 'Tele Executive portal — calls, follow-ups and updates on own assigned leads only.',
        },
    )

    module_flags = {
        'Dashboard': {'can_view': True},
        'Leads': {'can_view': True, 'can_add': True, 'can_edit': True, 'can_delete': True},
        'Follow-ups': {'can_view': True, 'can_add': True, 'can_edit': True},
        'Reports': {'can_view': True},
    }

    for module, flags in module_flags.items():
        # get_or_create (not update_or_create): never clobber permission
        # tweaks an admin already made through the Roles & Permissions UI.
        RolePermission.objects.get_or_create(role=role, module=module, defaults=flags)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_seed_baseline_roles_branch'),
    ]

    operations = [
        migrations.RunPython(seed_tele_sales_executive, noop_reverse),
    ]
