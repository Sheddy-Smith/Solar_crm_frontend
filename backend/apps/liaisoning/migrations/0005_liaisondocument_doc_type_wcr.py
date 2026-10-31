from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('liaisoning', '0004_liaison_pipeline'),
    ]

    operations = [
        migrations.AlterField(
            model_name='liaisondocument',
            name='doc_type',
            field=models.CharField(
                choices=[
                    ('Aadhaar Card', 'Aadhaar Card'),
                    ('PAN Card', 'PAN Card'),
                    ('Electricity Bill', 'Electricity Bill'),
                    ('Property Document', 'Property Document'),
                    ('Bank Passbook', 'Bank Passbook'),
                    ('Site Photo', 'Site Photo'),
                    ('Application Form', 'Application Form'),
                    ('Approval Letter', 'Approval Letter'),
                    ('Agreement', 'Agreement'),
                    ('Inspection Report', 'Inspection Report'),
                    ('Net Meter Certificate', 'Net Meter Certificate'),
                    ('Commissioning Report', 'Commissioning Report'),
                    ('Compliance Certificate', 'Compliance Certificate'),
                    ('WCR', 'WCR'),
                    ('Other', 'Other'),
                ],
                default='Other',
                max_length=50,
            ),
        ),
    ]
