from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm_settings', '0003_developer_mode_tools'),
    ]

    operations = [
        migrations.AddField(
            model_name='bugreport',
            name='source',
            field=models.CharField(
                choices=[('user', 'User'), ('auto', 'Auto pick')],
                db_index=True,
                default='user',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='bugreport',
            name='fingerprint',
            field=models.CharField(blank=True, db_index=True, max_length=80),
        ),
        migrations.AddField(
            model_name='bugreport',
            name='occurrence_count',
            field=models.PositiveIntegerField(default=1),
        ),
    ]
