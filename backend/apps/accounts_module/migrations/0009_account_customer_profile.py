from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts_module', '0008_financial_interop_category_map'),
    ]

    operations = [
        migrations.AddField(
            model_name='account',
            name='company',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='account',
            name='address',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='account',
            name='gstin',
            field=models.CharField(blank=True, max_length=15),
        ),
        migrations.AddField(
            model_name='account',
            name='vehicle_number',
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name='account',
            name='credit_limit',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name='account',
            name='credit_days',
            field=models.PositiveSmallIntegerField(default=30),
        ),
        migrations.AddField(
            model_name='account',
            name='relation',
            field=models.CharField(
                blank=True,
                choices=[('Good', 'Good'), ('Ok', 'Ok'), ('Poor', 'Poor'), ('Bad', 'Bad')],
                max_length=10,
            ),
        ),
    ]
