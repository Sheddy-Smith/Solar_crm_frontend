from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('crm_settings', '0004_bugreport_source'),
    ]

    operations = [
        migrations.AlterField(
            model_name='bugreport',
            name='body',
            field=models.TextField(blank=True),
        ),
        migrations.CreateModel(
            name='BugReportAttachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='bug_reports/%Y/%m/')),
                ('original_name', models.CharField(blank=True, max_length=255)),
                ('kind', models.CharField(choices=[('image', 'Image'), ('video', 'Video')], default='image', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('report', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='crm_settings.bugreport')),
            ],
            options={
                'ordering': ['id'],
            },
        ),
    ]
