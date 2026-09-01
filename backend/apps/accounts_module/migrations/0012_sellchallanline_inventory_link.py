from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0007_inventorycategory_form_designer'),
        ('accounts_module', '0011_account_type_supplier'),
    ]

    operations = [
        migrations.AddField(
            model_name='sellchallanline',
            name='inventory_item',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='sell_challan_lines',
                to='inventory.inventoryitem',
            ),
        ),
        migrations.AddField(
            model_name='sellchallanline',
            name='stock_movement',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='sell_challan_line',
                to='inventory.stockmovement',
            ),
        ),
    ]
