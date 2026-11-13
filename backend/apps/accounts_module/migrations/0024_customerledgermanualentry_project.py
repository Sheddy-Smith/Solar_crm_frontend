from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0039_customer_master_project_ledger'),
        ('accounts_module', '0023_customer_ledger_payment_mode_choices'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerledgermanualentry',
            name='project',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='manual_ledger_entries',
                to='projects.project',
            ),
        ),
    ]
