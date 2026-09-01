from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0006_inventoryitem_category_specs'),
        ('projects', '0024_materialplan_dispatch_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='materialplan',
            name='inventory_item',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='material_plan_dispatches',
                to='inventory.inventoryitem',
            ),
        ),
        migrations.AddField(
            model_name='materialplan',
            name='stock_movement',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='material_plan_links',
                to='inventory.stockmovement',
            ),
        ),
    ]
