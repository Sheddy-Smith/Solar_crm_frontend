from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts_module', '0009_account_customer_profile'),
    ]

    operations = [
        migrations.AddField(
            model_name='account',
            name='vendor_type',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
