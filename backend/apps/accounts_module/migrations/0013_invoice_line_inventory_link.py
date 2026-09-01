from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0007_inventorycategory_form_designer'),
        ('accounts_module', '0012_sellchallanline_inventory_link'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseinvoiceline',
            name='inventory_item',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='purchase_invoice_lines',
                to='inventory.inventoryitem',
            ),
        ),
        migrations.AddField(
            model_name='purchaseinvoiceline',
            name='stock_movement',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='purchase_invoice_line',
                to='inventory.stockmovement',
            ),
        ),
        migrations.AddField(
            model_name='sellinvoiceline',
            name='inventory_item',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='sell_invoice_lines',
                to='inventory.inventoryitem',
            ),
        ),
        migrations.AddField(
            model_name='sellinvoiceline',
            name='stock_movement',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='sell_invoice_line',
                to='inventory.stockmovement',
            ),
        ),
        migrations.AlterField(
            model_name='paymentvoucher',
            name='payee_type',
            field=models.CharField(
                choices=[
                    ('Supplier', 'Supplier'),
                    ('Vendor', 'Vendor'),
                    ('Labour', 'Labour'),
                    ('Customer', 'Customer'),
                    ('Other', 'Other'),
                ],
                default='Other',
                max_length=20,
            ),
        ),
    ]
