import django.db.models.deletion
from django.db import migrations, models


def map_legacy_categories(apps, schema_editor):
    DailyTask = apps.get_model('daily_tasks', 'DailyTask')
    mapping = {
        'factory_shutdown': 'site_visit_log',
        'vehicle_delivery': 'material_dispatch',
        'factory_maintenance': 'installation_progress',
        'stock_check': 'stock_check',
    }
    for old, new in mapping.items():
        DailyTask.objects.filter(category=old).update(category=new)


class Migration(migrations.Migration):

    dependencies = [
        ('workforce', '0006_bug_fixes'),
        ('daily_tasks', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='dailytask',
            name='assigned_to',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='daily_tasks',
                to='workforce.employee',
            ),
        ),
        migrations.AlterField(
            model_name='dailytask',
            name='category',
            field=models.CharField(
                choices=[
                    ('site_visit_log', 'Site Visit Log'),
                    ('installation_progress', 'Installation Progress'),
                    ('material_dispatch', 'Material Dispatch'),
                    ('stock_check', 'Stock Check'),
                ],
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name='dailytask',
            name='created_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='daily_tasks_created',
                to='accounts.user',
            ),
        ),
        migrations.RunPython(map_legacy_categories, migrations.RunPython.noop),
    ]
