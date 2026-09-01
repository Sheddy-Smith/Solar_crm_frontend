from django.db import migrations, models


NEW_CHOICES = [
    ('Dashboard', 'Dashboard'),
    ('Lead', 'Lead'),
    ('Quotation', 'Quotation'),
    ('Project Management', 'Project Management'),
    ('Liaisoning & Commissioning', 'Liaisoning & Commissioning'),
    ('O&M', 'O&M'),
    ('Accounts', 'Accounts'),
    ('Customer', 'Customer'),
    ('Vendors', 'Vendors'),
    ('Inventory', 'Inventory'),
    ('Employee', 'Employee'),
    ('Insights', 'Insights'),
    ('Daily Tasks', 'Daily Tasks'),
    ('AMC & Warranty', 'AMC & Warranty'),
    ('Settings', 'Settings'),
    ('User Management', 'User Management'),
]

FLAG_FIELDS = (
    'can_view', 'can_add', 'can_edit', 'can_delete',
    'can_export', 'can_import', 'can_approve', 'full_access', 'can_assign',
)


def seed_vendors_permission(apps, schema_editor):
    RolePermission = apps.get_model('accounts', 'RolePermission')
    for perm in RolePermission.objects.filter(module='Accounts'):
        defaults = {field: getattr(perm, field, False) for field in FLAG_FIELDS if hasattr(perm, field)}
        RolePermission.objects.get_or_create(
            role=perm.role,
            module='Vendors',
            defaults=defaults,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_seed_customer_permission'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rolepermission',
            name='module',
            field=models.CharField(choices=NEW_CHOICES, max_length=40),
        ),
        migrations.RunPython(seed_vendors_permission, noop_reverse),
    ]
