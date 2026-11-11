from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts_module', '0019_vendor_ledger_manual_entry'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerledgermanualentry',
            name='payment_mode',
            field=models.CharField(blank=True, default='', max_length=60),
        ),
    ]
