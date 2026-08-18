from django.db import migrations, models


def grant_assign_to_existing_managers(apps, schema_editor):
    """Preserve prior behaviour: Admin / Branch Manager (and any Lead
    full_access row) could assign leads before can_assign existed."""
    RolePermission = apps.get_model('accounts', 'RolePermission')
    Role = apps.get_model('accounts', 'Role')

    RolePermission.objects.filter(module='Lead', full_access=True).update(can_assign=True)

    for role_name in ('Admin', 'Branch Manager', 'Super Admin'):
        role = Role.objects.filter(name=role_name).first()
        if not role:
            continue
        RolePermission.objects.filter(role=role, module='Lead').update(can_assign=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0014_sidebar_aligned_permission_modules'),
    ]

    operations = [
        migrations.AddField(
            model_name='rolepermission',
            name='can_assign',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(grant_assign_to_existing_managers, noop_reverse),
    ]
