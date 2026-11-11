from django.db import migrations, models


def forwards(apps, schema_editor):
    Lead = apps.get_model('leads', 'Lead')
    for lead in Lead.objects.filter(status='Follow-up').iterator(chunk_size=200):
        category = (lead.category or '').strip()
        priority = (lead.priority or '').strip()
        if category == 'Hot' and priority not in ('High', 'Low'):
            lead.priority = 'High'
        elif category == 'Cool' and priority not in ('High', 'Low'):
            lead.priority = 'Low'
        elif not category and priority not in ('High', 'Low'):
            lead.category = 'Warm'
        lead.status = 'New'
        lead.save(update_fields=['status', 'category', 'priority'])


def backwards(apps, schema_editor):
    Lead = apps.get_model('leads', 'Lead')
    Lead.objects.filter(status='New', category__in=['Hot', 'Cool', 'Warm']).update(status='Follow-up')


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0022_lead_followup_query_indexes'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name='lead',
            name='status',
            field=models.CharField(
                choices=[
                    ('New', 'New'),
                    ('Quotation', 'Quotation'),
                    ('Won', 'Won'),
                    ('Lost', 'Lost'),
                ],
                default='New',
                max_length=20,
            ),
        ),
    ]
