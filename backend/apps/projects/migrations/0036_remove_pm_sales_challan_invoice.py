from django.db import migrations, models


REMOVED_STAGES = ('Sales Challan', 'Invoice')


def forwards(apps, schema_editor):
    ProjectPipelineStage = apps.get_model('projects', 'ProjectPipelineStage')
    ProjectPipelineStage.objects.filter(stage__in=REMOVED_STAGES).update(stage='Completed')


def backwards(apps, schema_editor):
    # Cannot restore previous Sales Challan / Invoice stage values.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0035_project_status_list_indexes'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name='projectpipelinestage',
            name='stage',
            field=models.CharField(
                choices=[
                    ('Site Survey', 'Site Survey'),
                    ('Quotation', 'Quotation'),
                    ('Material Planning', 'Material Planning'),
                    ('Job Sheet', 'Job Sheet'),
                    ('Dispatch', 'Dispatch'),
                    ('Installation', 'Installation'),
                    ('Completed', 'Completed'),
                ],
                default='Site Survey',
                max_length=30,
            ),
        ),
    ]
