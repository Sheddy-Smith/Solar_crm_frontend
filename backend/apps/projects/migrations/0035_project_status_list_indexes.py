from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('projects', '0034_sitesurvey_legacy_supply_voltage'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='project',
            index=models.Index(
                fields=['is_deleted', 'status', '-created_at'],
                name='project_del_status_created_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='sitesurvey',
            index=models.Index(
                fields=['status', '-survey_date'],
                name='survey_status_date_idx',
            ),
        ),
    ]
