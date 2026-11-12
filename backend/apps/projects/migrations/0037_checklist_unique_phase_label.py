from django.db import migrations, models


def dedupe_checklist(apps, schema_editor):
    ProjectChecklistItem = apps.get_model('projects', 'ProjectChecklistItem')
    seen = set()
    # Keep lowest pk per (project, phase, label); drop duplicates.
    for item in ProjectChecklistItem.objects.order_by('id').iterator(chunk_size=500):
        key = (item.project_id, item.phase, item.label)
        if key in seen:
            item.delete()
        else:
            seen.add(key)


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0036_remove_pm_sales_challan_invoice'),
    ]

    operations = [
        migrations.RunPython(dedupe_checklist, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='projectchecklistitem',
            constraint=models.UniqueConstraint(
                fields=('project', 'phase', 'label'),
                name='uniq_project_checklist_phase_label',
            ),
        ),
    ]
