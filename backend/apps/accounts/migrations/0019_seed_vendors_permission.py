from django.db import migrations, models


MODULE_CHOICES = [
    ('Dashboard', 'Dashboard'),
    ('Lead', 'Lead'),
    ('Quotation', 'Quotation'),
    ('Project Management', 'Project Management'),
    ('Liaisoning & Commissioning', 'Liaisoning & Commissioning'),
    ('O&M', 'O&M'),
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


def seed_vendors_permission(apps, schema_editor):
    RolePermission = apps.get_model('accounts', 'RolePermission')
    FLAG_FIELDS = (
        'can_view', 'can_add', 'can_edit', 'can_delete',
        'can_export', 'can_import', 'can_approve', 'full_access', 'can_assign',
    )
    source_qs = RolePermission.objects.filter(module__in=['Supplier', 'Accounts'])
    seen_roles = set()
    for perm in source_qs:
        if perm.role_id in seen_roles:
            continue
        seen_roles.add(perm.role_id)
        defaults = {field: getattr(perm, field, False) for field in FLAG_FIELDS if hasattr(perm, field)}
        RolePermission.objects.get_or_create(
            role_id=perm.role_id,
            module='Vendors',
            defaults=defaults,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0018_rename_vendors_to_supplier'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rolepermission',
            name='module',
            field=models.CharField(choices=MODULE_CHOICES, max_length=40),
        ),
        migrations.RunPython(seed_vendors_permission, noop_reverse),
    ]
