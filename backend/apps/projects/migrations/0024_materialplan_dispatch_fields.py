from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0023_project_soft_delete'),
    ]

    operations = [
        migrations.AddField(
            model_name='materialplan',
            name='dispatched_qty',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='materialplan',
            name='dispatch_status',
            field=models.CharField(
                choices=[('Pending', 'Pending'), ('Partial', 'Partial'), ('Dispatched', 'Dispatched')],
                default='Pending',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='materialplan',
            name='dispatch_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='materialplan',
            name='vehicle_no',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='materialplan',
            name='challan_no',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='materialplan',
            name='dispatch_notes',
            field=models.TextField(blank=True, default=''),
        ),
    ]
