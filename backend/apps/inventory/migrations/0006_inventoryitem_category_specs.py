from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_inventoryitem_structure_units'),
    ]

    operations = [
        migrations.AddField(
            model_name='inventoryitem',
            name='product_type',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='inventoryitem',
            name='capacity',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='inventoryitem',
            name='panel_wp',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='inventoryitem',
            name='panel_count',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AlterField(
            model_name='inventoryitem',
            name='unit',
            field=models.CharField(
                choices=[
                    ('Nos', 'Nos'),
                    ('pcs', 'pcs'),
                    ('Meter', 'Meter'),
                    ('Kg', 'Kg'),
                    ('kg', 'kg'),
                    ('Ltr', 'Ltr'),
                    ('ltr', 'ltr'),
                    ('Roll', 'Roll'),
                    ('Set', 'Set'),
                    ('Unit', 'Unit'),
                    ('Packet', 'Packet'),
                    ('Bundels', 'Bundels'),
                    ('kW', 'kW'),
                ],
                default='Nos',
                max_length=20,
            ),
        ),
    ]
