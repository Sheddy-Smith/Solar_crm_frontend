from django.db import migrations, models
import django.db.models.deletion


def remap_stages(apps, schema_editor):
    LiaisonProjectStage = apps.get_model('liaisoning', 'LiaisonProjectStage')
    ProjectPipelineStage = apps.get_model('projects', 'ProjectPipelineStage')

    # Inspection Placed → Inspection (new post-commissioning slot).
    LiaisonProjectStage.objects.filter(stage='Inspection Placed').update(stage='Inspection')

    # Quotation removed from PM pipeline → treat as Site Survey (same as advance remap).
    ProjectPipelineStage.objects.filter(stage='Quotation').update(stage='Site Survey')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('liaisoning', '0007_inspection_placed_stage'),
        ('workforce', '0010_developer_mode_tools'),
        ('daily_tasks', '0004_dailytask_commissioning_category'),
        ('projects', '0036_remove_pm_sales_challan_invoice'),
    ]

    operations = [
        migrations.AddField(
            model_name='liaisoncommissioning',
            name='assigned_employee',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='lc_commissionings', to='workforce.employee',
            ),
        ),
        migrations.AddField(
            model_name='liaisoncommissioning',
            name='daily_task',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='lc_commissionings', to='daily_tasks.dailytask',
            ),
        ),
        migrations.AddField(
            model_name='liaisoncommissioning',
            name='staff_task',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='lc_commissionings', to='daily_tasks.staffdailytask',
            ),
        ),
        migrations.AlterField(
            model_name='liaisoncommissioning',
            name='status',
            field=models.CharField(
                choices=[
                    ('Scheduled', 'Scheduled'),
                    ('In Progress', 'In Progress'),
                    ('Completed', 'Completed'),
                    ('Cancelled', 'Cancelled'),
                ],
                default='Scheduled', max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='liaisonprojectstage',
            name='stage',
            field=models.CharField(
                choices=[
                    ('Documents', 'Documents'),
                    ('Application', 'Application'),
                    ('Loan Process', 'Loan Process'),
                    ('Agreement', 'Agreement'),
                    ('Net Meter', 'Net Meter'),
                    ('Commissioning', 'Commissioning'),
                    ('Inspection', 'Inspection'),
                    ('Subsidy', 'Subsidy'),
                    ('Inspection Placed', 'Inspection Placed'),
                    ('Completed', 'Completed'),
                ],
                default='Documents', max_length=20,
            ),
        ),
        migrations.RunPython(remap_stages, noop_reverse),
    ]
