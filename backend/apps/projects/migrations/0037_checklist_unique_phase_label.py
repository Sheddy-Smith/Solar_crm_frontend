from django.db import migrations, models


def dedupe_checklist(apps, schema_editor):
    """Merge duplicate (project, phase, label) rows, preserving useful state.

    Prefer the earliest row as survivor. Copy is_checked / notes / checked_* from
    any later duplicate that has richer data, then delete duplicates.
    """
    ProjectChecklistItem = apps.get_model('projects', 'ProjectChecklistItem')
    survivors = {}
    # Stream ordered by id so the first sighting is the lowest PK.
    # Case/whitespace-insensitive key prevents logical duplicates under CI collations.
    for item in ProjectChecklistItem.objects.order_by('id').iterator(chunk_size=500):
        stripped = (item.label or '').strip()
        key = (item.project_id, item.phase, stripped.casefold())
        if key not in survivors:
            if (item.label or '') != stripped:
                item.label = stripped
                item.save(update_fields=['label'])
            survivors[key] = item
            continue

        keep = survivors[key]
        changed = False
        if not keep.is_checked and item.is_checked:
            keep.is_checked = True
            keep.checked_by_id = item.checked_by_id
            keep.checked_at = item.checked_at
            changed = True
        if not (keep.notes or '').strip() and (item.notes or '').strip():
            keep.notes = item.notes
            changed = True
        if changed:
            keep.save(update_fields=['is_checked', 'checked_by', 'checked_at', 'notes'])
        item.delete()


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
