from django.db import migrations


def unassign_tele_sales_assignees(apps, schema_editor):
    """Historical one-shot: cleared Tele Sales assignees for Sales hand-off.

    Do NOT reverse or re-run without explicit approval. Tele visibility is now
    via created_by OR assigned_to in lead_owner_q — unassigned created leads
    remain visible to their Tele creator without reassignment.
    """
    Lead = apps.get_model('leads', 'Lead')
    Lead.objects.filter(assigned_to__role__name='Tele Sales Executive').update(assigned_to=None)


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0020_close_superseded_scheduled_followups'),
    ]

    operations = [
        migrations.RunPython(unassign_tele_sales_assignees, migrations.RunPython.noop),
    ]
