from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0003_alter_lead_ivrs_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='adminapproval',
            name='requested_customer_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='adminapproval',
            name='requested_mobile_number',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='adminapproval',
            name='requested_payload',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='adminapproval',
            name='requested_project_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='adminapproval',
            name='requested_project_type',
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
