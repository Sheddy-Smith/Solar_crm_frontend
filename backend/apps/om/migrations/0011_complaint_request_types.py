# Task 15 — expand complaint/request type choices (no data deletion).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('om', '0010_existing_plant_registration'),
    ]

    operations = [
        migrations.AlterField(
            model_name='ombreakdownticket',
            name='complaint_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('Customer Complaint', 'Customer Complaint'),
                    ('General Service Request', 'General Service Request'),
                    ('Technical Fault', 'Technical Fault'),
                    ('Emergency Service', 'Emergency Service'),
                    ('Inverter Error', 'Inverter Error'),
                    ('Low Generation', 'Low Generation'),
                    ('No Generation', 'No Generation'),
                    ('Panel Damage', 'Panel Damage'),
                    ('Panel Cleaning', 'Panel Cleaning'),
                    ('Wiring / Cable', 'Wiring / Cable'),
                    ('Earthing', 'Earthing'),
                    ('Meter / Net Meter', 'Meter / Net Meter'),
                    ('Structure', 'Structure'),
                    ('Monitoring / App', 'Monitoring / App'),
                    ('Plant Not Working', 'Plant Not Working'),
                    ('Other', 'Other'),
                ],
                max_length=30,
            ),
        ),
    ]
