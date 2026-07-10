from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.inventory.models import InventoryItem, StockMovement, Warehouse


class StockMovementTests(TestCase):
    def setUp(self):
        self.warehouse = Warehouse.objects.create(name='Test Warehouse', location='Indore')
        self.item = InventoryItem.objects.create(
            name='Test Panel',
            category='Solar Panel',
            unit='Nos',
            current_stock=Decimal('10'),
            warehouse=self.warehouse,
        )

    def test_stock_movement_edit_applies_only_quantity_difference(self):
        movement = StockMovement.objects.create(
            item=self.item,
            movement_type='Inward',
            quantity=Decimal('5'),
            to_warehouse=self.warehouse,
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, Decimal('15.00'))

        movement.notes = 'Only note changed'
        movement.save()
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, Decimal('15.00'))

        movement.quantity = Decimal('7')
        movement.save()
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, Decimal('17.00'))

    def test_stock_movement_delete_reverses_stock_delta(self):
        movement = StockMovement.objects.create(
            item=self.item,
            movement_type='Outward',
            quantity=Decimal('3'),
            from_warehouse=self.warehouse,
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, Decimal('7.00'))

        movement.delete()
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, Decimal('10.00'))

    def test_outward_movement_cannot_make_stock_negative(self):
        with self.assertRaises(ValidationError):
            StockMovement.objects.create(
                item=self.item,
                movement_type='Outward',
                quantity=Decimal('99'),
                from_warehouse=self.warehouse,
            )

    def test_transfer_movement_updates_item_warehouse(self):
        other_warehouse = Warehouse.objects.create(name='East Warehouse', location='Bhopal')
        self.assertEqual(self.item.warehouse_id, self.warehouse.id)

        StockMovement.objects.create(
            item=self.item,
            movement_type='Transfer',
            quantity=Decimal('3'),
            from_warehouse=self.warehouse,
            to_warehouse=other_warehouse,
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.warehouse_id, other_warehouse.id)
        self.assertEqual(self.item.current_stock, Decimal('10.00'))

    def test_transfer_delete_reverts_warehouse_when_no_later_transfer(self):
        other_warehouse = Warehouse.objects.create(name='East Warehouse', location='Bhopal')
        movement = StockMovement.objects.create(
            item=self.item,
            movement_type='Transfer',
            quantity=Decimal('3'),
            from_warehouse=self.warehouse,
            to_warehouse=other_warehouse,
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.warehouse_id, other_warehouse.id)

        movement.delete()
        self.item.refresh_from_db()
        self.assertEqual(self.item.warehouse_id, self.warehouse.id)
