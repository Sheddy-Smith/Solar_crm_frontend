from django.db import migrations, models


MODULE_CHOICES = [
    ('Dashboard', 'Dashboard'),
    ('Lead', 'Lead'),
    ('Quotation', 'Quotation'),
    ('Project Management', 'Project Management'),
    ('Liaisoning & Commissioning', 'Liaisoning & Commissioning'),
    ('O&M', 'O&M'),
    ('O&M Field Work', 'O&M Field Work'),
    ('Accounts', 'Accounts'),
    ('Customer', 'Customer'),
    ('Vendors', 'Vendors'),
    ('Supplier', 'Supplier'),
    ('Inventory', 'Inventory'),
    ('Employee', 'Employee'),
    ('Insights', 'Insights'),
    ('Daily Tasks', 'Daily Tasks'),
    ('AMC & Warranty', 'AMC & Warranty'),
    ('Settings', 'Settings'),
    ('User Management', 'User Management'),
]


def seed_field_work_permission(apps, schema_editor):
    RolePermission = apps.get_model('accounts', 'RolePermission')
    flag_fields = (
        'can_view', 'can_add', 'can_edit', 'can_delete',
        'can_export', 'can_import', 'can_approve', 'full_access', 'can_assign',
    )
    for perm in RolePermission.objects.filter(module='O&M'):
        defaults = {field: getattr(perm, field, False) for field in flag_fields}
        RolePermission.objects.get_or_create(role_id=perm.role_id, module='O&M Field Work', defaults=defaults)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0020_user_language_preferences'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rolepermission',
            name='module',
            field=models.CharField(choices=MODULE_CHOICES, max_length=40),
        ),
        migrations.RunPython(seed_field_work_permission, noop_reverse),
    ]
