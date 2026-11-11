from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('daily_tasks', '0003_staffdailytask'),
    ]

    operations = [
        migrations.AlterField(
            model_name='dailytask',
            name='category',
            field=models.CharField(
                choices=[
                    ('site_visit_log', 'Site Visit Log'),
                    ('installation_progress', 'Installation Progress'),
                    ('material_dispatch', 'Material Dispatch'),
                    ('stock_check', 'Stock Check'),
                    ('commissioning', 'Commissioning Task'),
                ],
                max_length=30,
            ),
        ),
    ]
