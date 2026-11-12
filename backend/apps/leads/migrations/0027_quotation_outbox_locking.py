from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0026_normalized_mobile_and_quote_sync'),
    ]

    operations = [
        migrations.AddField(
            model_name='quotationdownstreamsync',
            name='correlation_id',
            field=models.CharField(blank=True, default='', max_length=36),
        ),
        migrations.AddField(
            model_name='quotationdownstreamsync',
            name='last_error_code',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='quotationdownstreamsync',
            name='lock_token',
            field=models.CharField(blank=True, default='', max_length=36),
        ),
        migrations.AddField(
            model_name='quotationdownstreamsync',
            name='locked_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='quotationdownstreamsync',
            name='last_error',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AlterField(
            model_name='quotationdownstreamsync',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('processing', 'Processing'),
                    ('success', 'Success'),
                    ('failed', 'Failed'),
                ],
                db_index=True,
                default='pending',
                max_length=16,
            ),
        ),
    ]
