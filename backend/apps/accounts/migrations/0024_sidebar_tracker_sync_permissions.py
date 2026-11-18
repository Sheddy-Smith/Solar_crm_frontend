from django.db import migrations, models


MODULE_CHOICES = [
    ('Dashboard', 'Dashboard'),
    ('Lead', 'Lead'),
    ('Quotation', 'Quotation'),
    ('Customer', 'Customer'),
    ('Vendors', 'Vendors'),
    ('Project Management', 'Project Management'),
    ('Liaisoning & Commissioning', 'Liaisoning & Commissioning'),
    ('O&M', 'O&M'),
    ('O&M Field Work', 'O&M Field Work'),
    ('Tracker', 'Tracker'),
    ('Accounts', 'Accounts'),
    ('Inventory', 'Inventory'),
    ('Employee', 'Employee'),
    ('Supplier', 'Supplier'),
    ('Insights', 'Insights'),
    ('Daily Tasks', 'Daily Tasks'),
    ('AMC & Warranty', 'AMC & Warranty'),
    ('Sync, Share & Backup', 'Sync, Share & Backup'),
    ('Settings', 'Settings'),
    ('User Management', 'User Management'),
]

FLAG_FIELDS = (
    'can_view', 'can_add', 'can_edit', 'can_delete',
    'can_export', 'can_import', 'can_approve', 'full_access', 'can_assign',
)


def seed_sidebar_modules(apps, schema_editor):
    """Ensure every role has Tracker + Sync, Share & Backup rows.

    Tracker inherits O&M flags; Sync inherits Settings flags so existing
    roles keep the same sidebar visibility after deploy.
    """
    Role = apps.get_model('accounts', 'Role')
    RolePermission = apps.get_model('accounts', 'RolePermission')

    for role in Role.objects.all():
        om = RolePermission.objects.filter(role=role, module='O&M').first()
        settings = RolePermission.objects.filter(role=role, module='Settings').first()

        tracker_defaults = {f: getattr(om, f, False) if om else False for f in FLAG_FIELDS}
        RolePermission.objects.get_or_create(
            role=role, module='Tracker', defaults=tracker_defaults,
        )

        sync_defaults = {f: getattr(settings, f, False) if settings else False for f in FLAG_FIELDS}
        RolePermission.objects.get_or_create(
            role=role, module='Sync, Share & Backup', defaults=sync_defaults,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0023_clear_password_vault'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rolepermission',
            name='module',
            field=models.CharField(choices=MODULE_CHOICES, max_length=40),
        ),
        migrations.RunPython(seed_sidebar_modules, noop_reverse),
    ]
