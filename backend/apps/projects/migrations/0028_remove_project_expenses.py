from django.db import migrations


def delete_expense_files(apps, schema_editor):
    ProjectExpenseDocument = apps.get_model('projects', 'ProjectExpenseDocument')
    for doc in ProjectExpenseDocument.objects.exclude(file='').iterator():
        try:
            doc.file.delete(save=False)
        except Exception:
            pass


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0027_job_sheet'),
        ('accounts_module', '0017_remove_project_expense_vouchers'),
    ]

    operations = [
        migrations.RunPython(delete_expense_files, migrations.RunPython.noop),
        migrations.DeleteModel(name='ProjectExpenseDocument'),
        migrations.DeleteModel(name='ProjectExpense'),
    ]
