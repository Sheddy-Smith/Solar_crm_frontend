# Generated manually for user soft-delete

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_grant_followup_delete_sales_tele'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_deleted',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
