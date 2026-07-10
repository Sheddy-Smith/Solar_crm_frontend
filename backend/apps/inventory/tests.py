from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.inventory.models import InventoryItem, StockMovement, Warehouse
from apps.inventory.services import next_item_code


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


class InventoryApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user(
            'inv@test.com',
            'Inventory Editor',
            {'Inventory': {'can_view': True, 'can_add': True, 'can_edit': True, 'can_delete': True}},
        )
        self.client.force_authenticate(self.user)
        self.warehouse = Warehouse.objects.create(name='Main WH', location='Indore')

    def test_next_item_code_skips_existing_ids(self):
        InventoryItem.objects.create(name='Legacy', item_code='ITEM-0010', warehouse=self.warehouse)
        code = next_item_code()
        self.assertTrue(code.startswith('ITEM-'))
        self.assertNotEqual(code, 'ITEM-0010')

    def test_quick_adjust_requires_warehouse(self):
        item = InventoryItem.objects.create(name='No WH', current_stock=Decimal('5'))
        res = self.client.post(
            f'/api/v1/inventory/items/{item.id}/quick-adjust/',
            {'quantity': '2', 'direction': 'add'},
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_quick_adjust_updates_stock(self):
        item = InventoryItem.objects.create(
            name='Panel', current_stock=Decimal('5'), warehouse=self.warehouse,
        )
        res = self.client.post(
            f'/api/v1/inventory/items/{item.id}/quick-adjust/',
            {'quantity': '3', 'direction': 'add'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.current_stock, Decimal('8.00'))

    def test_initial_stock_requires_warehouse(self):
        res = self.client.post(
            '/api/v1/inventory/items/',
            {'name': 'New Item', 'initial_stock': '10', 'warehouse': None},
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_stock_status_filter(self):
        InventoryItem.objects.create(
            name='Low', current_stock=Decimal('2'), minimum_stock=Decimal('5'),
            warehouse=self.warehouse,
        )
        InventoryItem.objects.create(
            name='OK', current_stock=Decimal('20'), minimum_stock=Decimal('5'),
            warehouse=self.warehouse,
        )
        res = self.client.get('/api/v1/inventory/items/?stock_status=Low Stock')
        self.assertEqual(res.status_code, 200)
        names = [r['name'] for r in res.data['results']]
        self.assertEqual(names, ['Low'])
