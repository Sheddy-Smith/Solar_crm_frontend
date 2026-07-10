from django.db import migrations


def seed_workforce_permission(apps, schema_editor):
    """BUG-016: workforce endpoints move from the 'Project Management' permission
    module to their own 'Workforce' module. Without this, every existing role
    that currently has Project Management access would be locked out of
    workforce/attendance/voucher endpoints the moment the module switch ships.
    Copy each role's existing Project Management flags onto a new Workforce row
    so access is preserved; Super Admins can then split them apart later."""
    RolePermission = apps.get_model('accounts', 'RolePermission')
    for perm in RolePermission.objects.filter(module='Project Management'):
        RolePermission.objects.get_or_create(
            role=perm.role,
            module='Workforce',
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
        ('accounts', '0004_alter_rolepermission_module'),
    ]

    operations = [
        migrations.RunPython(seed_workforce_permission, noop_reverse),
    ]
