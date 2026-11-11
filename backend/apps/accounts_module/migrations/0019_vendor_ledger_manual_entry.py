from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('accounts_module', '0018_customer_ledger_manual_entry'),
    ]

    operations = [
        migrations.CreateModel(
            name='VendorLedgerManualEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entry_date', models.DateField()),
                ('vehicle_no', models.CharField(blank=True, max_length=40)),
                ('wheeler', models.CharField(blank=True, max_length=40)),
                ('owner_name', models.CharField(blank=True, max_length=200)),
                ('work', models.TextField(blank=True)),
                ('debit', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('credit', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='vendor_manual_ledger_entries_created', to=settings.AUTH_USER_MODEL,
                )),
                ('party', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='vendor_manual_ledger_entries', to='accounts_module.account',
                )),
            ],
            options={
                'verbose_name': 'Vendor ledger manual entry',
                'verbose_name_plural': 'Vendor ledger manual entries',
                'ordering': ['-entry_date', '-created_at'],
            },
        ),
    ]
