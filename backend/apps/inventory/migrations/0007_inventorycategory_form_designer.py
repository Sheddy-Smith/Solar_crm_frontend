from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0006_inventoryitem_category_specs'),
    ]

    operations = [
        migrations.AddField(
            model_name='inventorycategory',
            name='form_template',
            field=models.CharField(
                blank=True,
                choices=[
                    ('Generic', 'Generic'),
                    ('Structure', 'Structure (Unit/Packet/Bundels)'),
                    ('Electrical', 'Electrical (Unit/Packet/Bundels)'),
                    ('Invertor', 'Invertor'),
                    ('Panel', 'Panel'),
                    ('Battery', 'Battery'),
                    ('Custom', 'Custom fields'),
                ],
                default='Generic',
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name='inventorycategory',
            name='form_fields',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
