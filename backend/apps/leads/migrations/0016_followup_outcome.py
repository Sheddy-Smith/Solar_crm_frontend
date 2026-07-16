from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0015_unassign_self_assigned_leads'),
    ]

    operations = [
        migrations.AddField(
            model_name='followup',
            name='outcome',
            field=models.CharField(blank=True, max_length=40),
        ),
    ]
