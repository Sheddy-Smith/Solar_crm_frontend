from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0021_om_field_work_permission'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='password_vault',
            field=models.TextField(blank=True, default=''),
        ),
    ]
