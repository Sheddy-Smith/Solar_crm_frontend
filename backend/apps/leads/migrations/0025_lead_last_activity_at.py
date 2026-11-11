from django.db import migrations, models
from django.db.models import F


def backfill_last_activity_at(apps, schema_editor):
    Lead = apps.get_model('leads', 'Lead')
    Lead.objects.filter(last_activity_at__isnull=True).update(last_activity_at=F('created_at'))


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0024_lead_project_cost'),
    ]

    operations = [
        migrations.AddField(
            model_name='lead',
            name='last_activity_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.RunPython(backfill_last_activity_at, migrations.RunPython.noop),
        migrations.AlterModelOptions(
            name='lead',
            options={'ordering': ['-last_activity_at', '-created_at']},
        ),
        migrations.AddIndex(
            model_name='lead',
            index=models.Index(fields=['is_deleted', '-last_activity_at', '-created_at'], name='lead_del_last_activity_idx'),
        ),
    ]
