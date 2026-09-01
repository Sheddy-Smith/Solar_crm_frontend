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
    ('Supplier', 'Supplier'),
    ('Inventory', 'Inventory'),
    ('Employee', 'Employee'),
    ('Insights', 'Insights'),
    ('Daily Tasks', 'Daily Tasks'),
    ('AMC & Warranty', 'AMC & Warranty'),
    ('Settings', 'Settings'),
    ('User Management', 'User Management'),
]


def rename_vendors_module(apps, schema_editor):
    RolePermission = apps.get_model('accounts', 'RolePermission')
    RolePermission.objects.filter(module='Vendors').update(module='Supplier')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0017_seed_vendors_permission'),
    ]

    operations = [
        migrations.RunPython(rename_vendors_module, noop_reverse),
        migrations.AlterField(
            model_name='rolepermission',
            name='module',
            field=models.CharField(choices=MODULE_CHOICES, max_length=40),
        ),
    ]
