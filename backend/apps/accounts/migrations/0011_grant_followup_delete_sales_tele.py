from django.db import migrations


def grant_followup_delete(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    RolePermission = apps.get_model('accounts', 'RolePermission')

    for role_name in ('Sales Executive', 'Tele Sales Executive'):
        role = Role.objects.filter(name=role_name).first()
        if not role:
            continue
        perm, created = RolePermission.objects.get_or_create(
            role=role,
            module='Follow-ups',
            defaults={
                'can_view': True,
                'can_add': True,
                'can_edit': True,
                'can_delete': True,
            },
        )
        if not created:
            # Ensure assigned sales / tele staff can correct follow-up history.
            RolePermission.objects.filter(pk=perm.pk).update(
                can_view=True,
                can_add=True,
                can_edit=True,
                can_delete=True,
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_seed_tele_sales_executive_role'),
    ]

    operations = [
        migrations.RunPython(grant_followup_delete, noop_reverse),
    ]
