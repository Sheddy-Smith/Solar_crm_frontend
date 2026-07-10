import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DailyTask',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(choices=[('factory_shutdown', 'Factory Shutdown'), ('vehicle_delivery', 'Vehicle Delivery'), ('factory_maintenance', 'Factory Maintenance'), ('stock_check', 'Stock Check')], max_length=30)),
                ('task_date', models.DateField(default=django.utils.timezone.now)),
                ('status', models.CharField(choices=[('Pending', 'Pending'), ('In Progress', 'In Progress'), ('Completed', 'Completed')], default='Pending', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('summary_text', models.CharField(blank=True, max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='daily_tasks', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-task_date', '-created_at'],
            },
        ),
    ]
