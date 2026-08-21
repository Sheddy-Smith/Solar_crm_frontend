from django.db import migrations


def unassign_tele_sales_assignees(apps, schema_editor):
    """Leads must never stay assigned_to a Tele Sales Executive — that role
    creates/nurtures leads; field hand-off is Sales Executive only. Clear any
    historical assignments so tele portals stop showing them as assigned."""
    Lead = apps.get_model('leads', 'Lead')
    Lead.objects.filter(assigned_to__role__name='Tele Sales Executive').update(assigned_to=None)


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0020_close_superseded_scheduled_followups'),
    ]

    operations = [
        migrations.RunPython(unassign_tele_sales_assignees, migrations.RunPython.noop),
    ]
