from decimal import Decimal, InvalidOperation

from django.db import migrations, models


def _qty(value):
    try:
        return Decimal(str(value or '0').replace(',', '').strip() or '0')
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')


def backfill(apps, schema_editor):
    Project = apps.get_model('projects', 'Project')
    MaterialPlan = apps.get_model('projects', 'MaterialPlan')

    for project in Project.objects.filter(status='Completed').only('id', 'actual_completion'):
        Project.objects.filter(pk=project.pk).update(
            installation_status='Done', installation_done_on=project.actual_completion,
        )

    for plan in MaterialPlan.objects.only('id', 'planned_qty', 'dispatched_qty', 'dispatch_status').iterator():
        planned, dispatched = _qty(plan.planned_qty), _qty(plan.dispatched_qty)
        if dispatched <= 0:
            status = 'Pending'
        elif planned > 0 and dispatched >= planned:
            status = 'Dispatched'
        else:
            status = 'Partial'
        if status != plan.dispatch_status:
            MaterialPlan.objects.filter(pk=plan.pk).update(dispatch_status=status)


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0028_remove_project_expenses'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='installation_status',
            field=models.CharField(
                choices=[('Not Done', 'Not Done'), ('Done', 'Done')], db_index=True,
                default='Not Done', max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='project',
            name='installation_done_on',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='materialplan',
            name='packed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='materialplan',
            name='dispatch_status',
            field=models.CharField(
                choices=[('Pending', 'Pending'), ('Packed', 'Packed'), ('Partial', 'Partial'), ('Dispatched', 'Dispatched')],
                default='Pending', max_length=20,
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
