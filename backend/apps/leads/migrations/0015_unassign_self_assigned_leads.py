from django.db import migrations
from django.db.models import F


def unassign_self_assigned(apps, schema_editor):
    """Data fix: leads used to be auto-assigned to their own creator
    (Sales/Tele Sales Executive) at creation time. That conflated "who added
    the lead" with "who owns/works the lead" and skipped the Manager/Super
    Admin triage pool entirely. Restore any lead still showing that pattern
    back to unassigned so it re-enters the pool to be explicitly assigned."""
    Lead = apps.get_model('leads', 'Lead')
    Lead.objects.filter(assigned_to_id=F('created_by_id')).exclude(created_by_id=None).update(assigned_to=None)


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0014_followup_reminder_followup_status_after'),
    ]

    operations = [
        migrations.RunPython(unassign_self_assigned, migrations.RunPython.noop),
    ]
