"""Align RolePermission modules with CRM sidebar names.

Renames:
  Leads → Lead, Workforce → Employee, Reports → Insights
Merges into Lead (then deletes):
  Follow-ups, IVRS Management, Approvals
Adds:
  Quotation (copied from Lead flags per role)
"""

from django.db import migrations, models


FLAG_FIELDS = (
    'can_view', 'can_add', 'can_edit', 'can_delete',
    'can_export', 'can_import', 'can_approve', 'full_access',
)

MERGE_INTO_LEADS = ('Follow-ups', 'IVRS Management', 'Approvals')

RENAMES = {
    'Leads': 'Lead',
    'Workforce': 'Employee',
    'Reports': 'Insights',
}

NEW_CHOICES = [
    ('Dashboard', 'Dashboard'),
    ('Lead', 'Lead'),
    ('Quotation', 'Quotation'),
    ('Project Management', 'Project Management'),
    ('Liaisoning & Commissioning', 'Liaisoning & Commissioning'),
    ('O&M', 'O&M'),
    ('Accounts', 'Accounts'),
    ('Inventory', 'Inventory'),
    ('Employee', 'Employee'),
    ('Insights', 'Insights'),
    ('Daily Tasks', 'Daily Tasks'),
    ('AMC & Warranty', 'AMC & Warranty'),
    ('Settings', 'Settings'),
    ('User Management', 'User Management'),
]


def align_modules(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    RolePermission = apps.get_model('accounts', 'RolePermission')

    for role in Role.objects.all():
        lead = RolePermission.objects.filter(role=role, module='Leads').first()
        if not lead:
            lead = RolePermission.objects.create(role=role, module='Leads')

        for mod in MERGE_INTO_LEADS:
            other = RolePermission.objects.filter(role=role, module=mod).first()
            if not other:
                continue
            for field in FLAG_FIELDS:
                if getattr(other, field):
                    setattr(lead, field, True)
            other.delete()
        lead.save()

    for old_name, new_name in RENAMES.items():
        for rp in list(RolePermission.objects.filter(module=old_name)):
            existing = RolePermission.objects.filter(role_id=rp.role_id, module=new_name).first()
            if existing:
                for field in FLAG_FIELDS:
                    if getattr(rp, field):
                        setattr(existing, field, True)
                existing.save()
                rp.delete()
            else:
                rp.module = new_name
                rp.save(update_fields=['module'])

    for role in Role.objects.all():
        if RolePermission.objects.filter(role=role, module='Quotation').exists():
            continue
        lead = RolePermission.objects.filter(role=role, module='Lead').first()
        defaults = {field: bool(getattr(lead, field)) if lead else False for field in FLAG_FIELDS}
        RolePermission.objects.create(role=role, module='Quotation', **defaults)

    # Drop any leftover obsolete module rows
    RolePermission.objects.filter(
        module__in=('Leads', 'Follow-ups', 'IVRS Management', 'Approvals', 'Workforce', 'Reports')
    ).delete()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0013_branch_manager_full_access'),
    ]

    operations = [
        migrations.RunPython(align_modules, noop_reverse),
        migrations.AlterField(
            model_name='rolepermission',
            name='module',
            field=models.CharField(choices=NEW_CHOICES, max_length=40),
        ),
    ]
