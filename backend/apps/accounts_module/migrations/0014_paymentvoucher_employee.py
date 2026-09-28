import django.db.models.deletion
from django.db import migrations, models


def link_workforce_vouchers(apps, schema_editor):
    PaymentVoucher = apps.get_model('accounts_module', 'PaymentVoucher')
    for voucher in PaymentVoucher.objects.filter(employee_voucher__isnull=False).select_related('employee_voucher'):
        voucher.employee_id = voucher.employee_voucher.employee_id
        voucher.entry_type = 'Voucher'
        voucher.save(update_fields=['employee', 'entry_type'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts_module', '0013_invoice_line_inventory_link'),
        ('workforce', '0009_alter_employeedocument_file'),
    ]

    operations = [
        migrations.AddField(
            model_name='paymentvoucher',
            name='employee',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='accounts_vouchers',
                to='workforce.employee',
            ),
        ),
        migrations.RunPython(link_workforce_vouchers, migrations.RunPython.noop),
    ]
