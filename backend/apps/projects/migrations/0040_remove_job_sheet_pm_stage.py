from django.db import migrations, models


def remap_job_sheet_stages(apps, schema_editor):
    ProjectPipelineStage = apps.get_model('projects', 'ProjectPipelineStage')
    for row in ProjectPipelineStage.objects.filter(stage='Job Sheet').iterator():
        history = list(row.history or [])
        history.append({
            'from': 'Job Sheet',
            'to': 'Dispatch',
            'action': 'legacy_remap',
            'note': 'Job Sheet removed from PM pipeline',
        })
        row.stage = 'Dispatch'
        row.history = history
        row.save(update_fields=['stage', 'history', 'updated_at'])


def noop_reverse(apps, schema_editor):
    # Irreversible remap — historical Job Sheet rows stay on Dispatch.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0039_customer_master_project_ledger'),
    ]

    operations = [
        migrations.RunPython(remap_job_sheet_stages, noop_reverse),
        migrations.AlterField(
            model_name='projectpipelinestage',
            name='stage',
            field=models.CharField(
                choices=[
                    ('Site Survey', 'Site Survey'),
                    ('Material Planning', 'Material Planning'),
                    ('Dispatch', 'Dispatch'),
                    ('Installation', 'Installation'),
                    ('Quotation', 'Quotation'),
                    ('Job Sheet', 'Job Sheet'),
                    ('Completed', 'Completed'),
                ],
                default='Site Survey',
                max_length=30,
            ),
        ),
    ]
