# Safe backfill: set StockMovement.project only where source document link is unambiguous.

from django.db import migrations


def backfill_projects(apps, schema_editor):
    StockMovement = apps.get_model('inventory', 'StockMovement')
    SellInvoiceLine = apps.get_model('accounts_module', 'SellInvoiceLine')
    PurchaseInvoiceLine = apps.get_model('accounts_module', 'PurchaseInvoiceLine')
    SellChallanLine = apps.get_model('accounts_module', 'SellChallanLine')
    PurchaseChallanLine = apps.get_model('accounts_module', 'PurchaseChallanLine')
    MaterialPlan = apps.get_model('projects', 'MaterialPlan')

    # Invoice / challan lines with linked movement + document.project
    line_specs = [
        (SellInvoiceLine, 'invoice'),
        (PurchaseInvoiceLine, 'invoice'),
        (SellChallanLine, 'challan'),
        (PurchaseChallanLine, 'challan'),
    ]
    for LineModel, parent_attr in line_specs:
        for line in LineModel.objects.filter(
            stock_movement_id__isnull=False,
        ).select_related(parent_attr).iterator():
            parent = getattr(line, parent_attr, None)
            project_id = getattr(parent, 'project_id', None) if parent else None
            if not project_id or not line.stock_movement_id:
                continue
            StockMovement.objects.filter(
                pk=line.stock_movement_id,
                project_id__isnull=True,
            ).update(project_id=project_id)

    # Jobs / dispatch via MaterialPlan
    for plan in MaterialPlan.objects.filter(
        stock_movement_id__isnull=False,
        project_id__isnull=False,
    ).iterator():
        StockMovement.objects.filter(
            pk=plan.stock_movement_id,
            project_id__isnull=True,
        ).update(project_id=plan.project_id)


def noop_reverse(apps, schema_editor):
    # Do not clear project FKs on reverse — data may have been set intentionally later.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0009_stock_sell_invoice_project_procurement'),
        ('accounts_module', '0027_stock_sell_invoice_project_procurement'),
        ('projects', '0040_remove_job_sheet_pm_stage'),
    ]

    operations = [
        migrations.RunPython(backfill_projects, noop_reverse),
    ]
