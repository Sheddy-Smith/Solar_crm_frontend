from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts_module', '0010_account_vendor_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='account',
            name='account_type',
            field=models.CharField(
                choices=[
                    ('Customer', 'Customer'),
                    ('Vendor', 'Vendor'),
                    ('Supplier', 'Supplier'),
                    ('Partner', 'Partner'),
                ],
                default='Customer',
                max_length=20,
            ),
        ),
    ]
