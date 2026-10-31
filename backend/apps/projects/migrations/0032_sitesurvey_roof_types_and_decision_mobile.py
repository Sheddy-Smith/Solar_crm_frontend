from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0031_site_survey_panel_inverter_meter'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesurvey',
            name='customer_confirmation_mobile',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AlterField(
            model_name='sitesurvey',
            name='roof_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('RCC', 'RCC'),
                    ('Coba', 'Coba'),
                    ('Tin Shade', 'Tin Shade'),
                    ('RBC', 'RBC'),
                    ('Ground Mounted', 'Ground Mounted'),
                    ('RCC Flat Roof', 'RCC Flat Roof'),
                    ('Ground mounted', 'Ground mounted'),
                    ('RBC Roof', 'RBC Roof'),
                    ('Ground Mount', 'Ground Mount'),
                    ('Tin Shed', 'Tin Shed'),
                ],
                max_length=30,
            ),
        ),
    ]
