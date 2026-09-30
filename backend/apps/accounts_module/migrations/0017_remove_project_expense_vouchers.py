from django.db import migrations


def delete_project_expense_vouchers(apps, schema_editor):
    PaymentVoucher = apps.get_model('accounts_module', 'PaymentVoucher')
    Transaction = apps.get_model('accounts_module', 'Transaction')
    vouchers = PaymentVoucher.objects.filter(project_expense__isnull=False)
    Transaction.objects.filter(source_payment_voucher__in=vouchers).delete()
    vouchers.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts_module', '0016_sell_challan_quotation_format'),
    ]

    operations = [
        migrations.RunPython(delete_project_expense_vouchers, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='paymentvoucher',
            name='project_expense',
        ),
    ]
