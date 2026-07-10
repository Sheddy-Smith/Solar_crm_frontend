from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.inventory.models import InventoryItem
from apps.om.models import OmSparePart


class OmSparePartInventorySyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user(
            'om@test.com',
            'OM Editor',
            {'O&M': {'can_view': True, 'can_edit': True}},
        )
        self.client.force_authenticate(self.user)
        self.inventory_item = InventoryItem.objects.create(
            name='MC4 Connector',
            category='Other',
            current_stock=Decimal('5'),
        )
        self.spare_part = OmSparePart.objects.create(
            name='MC4 Connector',
            stock_qty=5,
            linked_inventory_item=self.inventory_item,
            created_by=self.user,
        )

    def test_spare_part_exposes_linked_inventory_item(self):
        res = self.client.get(f'/api/v1/om/spare-parts/{self.spare_part.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['linked_inventory_item'], self.inventory_item.id)
        self.assertEqual(res.data['linked_inventory_item_name'], 'MC4 Connector')

    def test_sync_inventory_updates_linked_item_when_requested(self):
        res = self.client.patch(
            f'/api/v1/om/spare-parts/{self.spare_part.id}/',
            {'stock_qty': 12, 'sync_inventory': True},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.inventory_item.refresh_from_db()
        self.assertEqual(self.inventory_item.current_stock, Decimal('12'))

    def test_stock_change_without_sync_flag_leaves_inventory_unchanged(self):
        res = self.client.patch(
            f'/api/v1/om/spare-parts/{self.spare_part.id}/',
            {'stock_qty': 20},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.inventory_item.refresh_from_db()
        self.assertEqual(self.inventory_item.current_stock, Decimal('5'))
