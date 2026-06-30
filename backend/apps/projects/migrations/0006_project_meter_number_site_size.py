from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0005_add_access_level_to_team_member'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='meter_number',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='project',
            name='site_size',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
