"""Link project material dispatch → inventory Stock Movement (Outward)."""
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction


def _parse_qty(value):
    try:
        return Decimal(str(value or '0').replace(',', '').strip() or '0')
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')


def resolve_inventory_item(plan):
    from .models import InventoryItem

    if plan.inventory_item_id:
        return plan.inventory_item

    name = (plan.items or '').strip()
    if name:
        exact = InventoryItem.objects.filter(is_active=True, name__iexact=name).first()
        if exact:
            return exact
        partial = InventoryItem.objects.filter(is_active=True, name__icontains=name).order_by('id').first()
        if partial:
            return partial

    return None


@transaction.atomic
def sync_inventory_for_material_dispatch(plan, user=None):
    """
    Keep a single Outward StockMovement in sync with plan.dispatched_qty.
    Returns a small status dict (never raises for missing item — only for stock rules).
    """
    from .models import StockMovement, Warehouse
    from apps.projects.models import MaterialPlan

    qty = _parse_qty(plan.dispatched_qty)
    item = resolve_inventory_item(plan)

    if not item:
        if plan.stock_movement_id:
            movement = plan.stock_movement
            MaterialPlan.objects.filter(pk=plan.pk).update(stock_movement=None)
            plan.stock_movement = None
            movement.delete()
        return {'synced': False, 'reason': 'no_inventory_item'}

    warehouse = item.warehouse or Warehouse.objects.filter(is_active=True).order_by('id').first()
    if warehouse is None:
        return {'synced': False, 'reason': 'no_warehouse'}

    project = plan.project
    project_ref = getattr(project, 'project_id', None) or f'PRJ-{plan.project_id}'
    ref_no = (plan.challan_no or '').strip() or project_ref
    notes = f'Project dispatch {project_ref} — {plan.category}'
    if plan.items:
        notes = f'{notes} / {plan.items}'

    if qty <= 0:
        if plan.stock_movement_id:
            movement = plan.stock_movement
            MaterialPlan.objects.filter(pk=plan.pk).update(stock_movement=None, inventory_item_id=item.id)
            plan.stock_movement = None
            plan.inventory_item = item
            movement.delete()
        elif plan.inventory_item_id != item.id:
            MaterialPlan.objects.filter(pk=plan.pk).update(inventory_item_id=item.id)
            plan.inventory_item = item
        return {'synced': True, 'cleared': True}

    try:
        if plan.stock_movement_id:
            movement = plan.stock_movement
            movement.item = item
            movement.quantity = qty
            movement.rate = item.rate or 0
            movement.from_warehouse = warehouse
            movement.to_warehouse = None
            movement.movement_type = 'Outward'
            movement.reference_type = 'Jobs'
            movement.reference_no = ref_no
            movement.reference = project_ref
            movement.notes = notes
            if user and not movement.created_by_id:
                movement.created_by = user
            movement.save()
            MaterialPlan.objects.filter(pk=plan.pk).update(inventory_item_id=item.id)
            plan.inventory_item = item
            return {'synced': True, 'movement_id': movement.id, 'quantity': float(qty)}

        movement = StockMovement(
            item=item,
            movement_type='Outward',
            quantity=qty,
            rate=item.rate or 0,
            from_warehouse=warehouse,
            reference_type='Jobs',
            reference_no=ref_no,
            reference=project_ref,
            notes=notes,
            created_by=user,
        )
        movement.save()
        MaterialPlan.objects.filter(pk=plan.pk).update(
            stock_movement_id=movement.id,
            inventory_item_id=item.id,
        )
        plan.stock_movement = movement
        plan.inventory_item = item
        return {'synced': True, 'movement_id': movement.id, 'quantity': float(qty)}
    except ValidationError as exc:
        raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages) from exc
