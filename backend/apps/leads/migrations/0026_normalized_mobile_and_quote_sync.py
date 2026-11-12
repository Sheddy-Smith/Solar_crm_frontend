from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_normalized_mobile(apps, schema_editor):
    Lead = apps.get_model('leads', 'Lead')
    for lead in Lead.objects.all().only('id', 'mobile_number', 'normalized_mobile').iterator(chunk_size=500):
        digits = ''.join(ch for ch in str(lead.mobile_number or '') if ch.isdigit())
        normalized = digits[-10:] if len(digits) >= 10 else digits
        if lead.normalized_mobile != normalized:
            Lead.objects.filter(pk=lead.pk).update(normalized_mobile=normalized)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('leads', '0025_lead_last_activity_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='lead',
            name='normalized_mobile',
            field=models.CharField(blank=True, db_index=True, default='', max_length=10),
        ),
        migrations.AddIndex(
            model_name='lead',
            index=models.Index(
                fields=['is_deleted', 'status', 'normalized_mobile'],
                name='lead_norm_mobile_idx',
            ),
        ),
        migrations.CreateModel(
            name='QuotationDownstreamSync',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('success', 'Success'), ('failed', 'Failed')],
                    db_index=True,
                    default='pending',
                    max_length=16,
                )),
                ('attempts', models.PositiveIntegerField(default=0)),
                ('last_error', models.TextField(blank=True, default='')),
                ('last_synced_at', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('quotation', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='downstream_sync',
                    to='leads.quotation',
                )),
                ('requested_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='quotation_sync_requests',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.AddIndex(
            model_name='quotationdownstreamsync',
            index=models.Index(fields=['status', '-updated_at'], name='quote_sync_upd_idx'),
        ),
        migrations.RunPython(backfill_normalized_mobile, migrations.RunPython.noop),
    ]
