from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_inventorycategory_inventoryitem_item_code_and_more'),
    ]

    operations = [
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
                ],
                default='Nos',
                max_length=20,
            ),
        ),
    ]
