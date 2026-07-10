from django.db import migrations


def seed_daily_tasks_permission(apps, schema_editor):
    """Grant Daily Tasks access to existing roles based on Project Management
    flags so the new module does not lock everyone out on deploy."""
    RolePermission = apps.get_model('accounts', 'RolePermission')
    for perm in RolePermission.objects.filter(module='Project Management'):
        RolePermission.objects.get_or_create(
            role=perm.role,
            module='Daily Tasks',
            defaults={
                'can_view': perm.can_view,
                'can_add': perm.can_add,
                'can_edit': perm.can_edit,
                'can_delete': perm.can_delete,
                'can_export': perm.can_export,
                'can_import': perm.can_import,
                'can_approve': perm.can_approve,
                'full_access': perm.full_access,
            },
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_alter_rolepermission_module_daily_tasks'),
    ]

    operations = [
        migrations.RunPython(seed_daily_tasks_permission, noop_reverse),
    ]
