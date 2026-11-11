from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0023_remove_followup_lead_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='lead',
            name='project_cost',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True),
        ),
    ]
