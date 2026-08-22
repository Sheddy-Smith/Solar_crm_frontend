from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workforce', '0007_employee_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='duty_hours_per_day',
            field=models.DecimalField(decimal_places=2, default=Decimal('9.00'), max_digits=5),
        ),
    ]
