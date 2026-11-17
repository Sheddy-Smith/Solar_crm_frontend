from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('om', '0008_commissioning_om_credentials_warranty'),
    ]

    operations = [
        migrations.AlterField(
            model_name='omplant',
            name='om_status',
            field=models.CharField(
                choices=[
                    ('Commissioning Pending', 'Commissioning Pending'),
                    ('Free Service Active', 'Free Service Active'),
                    ('Free Service Expiring Soon', 'Free Service Expiring Soon'),
                    ('Free Service Expired', 'Free Service Expired'),
                    ('Paid O&M', 'Paid O&M'),
                    ('AMC Active', 'AMC Active'),
                    ('AMC Expired', 'AMC Expired'),
                ],
                db_index=True,
                default='Free Service Active',
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name='ommaintenancetask',
            name='source',
            field=models.CharField(
                choices=[
                    ('Quarterly', 'Quarterly'),
                    ('Ticket', 'Ticket'),
                    ('Manual', 'Manual'),
                    ('Plan', 'Plan'),
                    ('Cleaning', 'Cleaning'),
                ],
                db_index=True,
                default='Manual',
                max_length=20,
            ),
        ),
    ]
