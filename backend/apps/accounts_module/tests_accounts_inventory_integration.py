"""Accounts ↔ Inventory ↔ Project stock integration regression tests."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from django.test import TestCase

from apps.accounts_module.models import Account, PurchaseInvoice, PurchaseInvoiceLine, SellInvoice, SellInvoiceLine
from apps.accounts_module.document_services import (
    sync_inventory_for_purchase_invoice,
    sync_inventory_for_sell_invoice,
)
from apps.inventory.models import InventoryItem, StockMovement, Warehouse
from apps.projects.models import Project


User = get_user_model()


class AccountsInventoryIntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='inv_int@test.local', password='TestPass123!', name='Inv Int',
        )
        self.user.is_superuser = True
        self.user.is_staff = True
        self.user.save(update_fields=['is_superuser', 'is_staff'])
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.wh = Warehouse.objects.create(name='Main WH', is_active=True)
        self.item = InventoryItem.objects.create(
            name='Test Panel 550W',
            category='Solar Panels',
            unit='Nos',
            rate=Decimal('10000'),
            current_stock=Decimal('100'),
            warehouse=self.wh,
            is_active=True,
        )
        self.party = Account.objects.create(name='Cust A', account_type='Customer', created_by=self.user)
        self.supplier = Account.objects.create(name='Sup A', account_type='Supplier', created_by=self.user)
        self.project = Project.objects.create(
            project_name='Inv Plant',
            customer_name='Cust A',
            capacity_kwp=Decimal('5'),
            status='Active',
            created_by=self.user,
        )

    def test_purchase_mapped_product_stock_in(self):
        inv = PurchaseInvoice.objects.create(
            invoice_date='2026-03-01', supplier=self.supplier, supplier_name='Sup A',
            status='Recorded', procurement_scope='General', created_by=self.user,
            total_amount=Decimal('20000'),
        )
        PurchaseInvoiceLine.objects.create(
            invoice=inv, inventory_item=self.item, material_name=self.item.name,
            quantity=Decimal('2'), rate=Decimal('10000'), line_total=Decimal('20000'),
        )
        before = self.item.current_stock
        sync_inventory_for_purchase_invoice(inv, self.user)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, before + Decimal('2'))
        mov = StockMovement.objects.filter(reference_type='Purchase Invoice', item=self.item).latest('id')
        self.assertEqual(mov.movement_type, 'Inward')

    def test_purchase_unmapped_physical_raises(self):
        inv = PurchaseInvoice.objects.create(
            invoice_date='2026-03-01', supplier=self.supplier, status='Recorded',
            created_by=self.user, total_amount=Decimal('1000'),
        )
        PurchaseInvoiceLine.objects.create(
            invoice=inv, material_name='Unknown Panel XYZ', quantity=1, rate=1000, line_total=1000,
        )
        with self.assertRaises(ValidationError):
            sync_inventory_for_purchase_invoice(inv, self.user)

    def test_purchase_service_line_no_stock(self):
        inv = PurchaseInvoice.objects.create(
            invoice_date='2026-03-01', supplier=self.supplier, status='Recorded',
            created_by=self.user, total_amount=Decimal('500'),
        )
        PurchaseInvoiceLine.objects.create(
            invoice=inv, material_name='Freight', category='Freight',
            quantity=1, rate=500, line_total=500,
        )
        before = self.item.current_stock
        sync_inventory_for_purchase_invoice(inv, self.user)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, before)
        self.assertFalse(StockMovement.objects.filter(reference_no__startswith='PI-').exists())

    def test_accounts_sell_mapped_stock_out(self):
        inv = SellInvoice.objects.create(
            invoice_date='2026-03-02', party=self.party, project=self.project,
            status='Issued', source='Accounts', created_by=self.user,
            total_amount=Decimal('10000'),
        )
        SellInvoiceLine.objects.create(
            invoice=inv, inventory_item=self.item, material_name=self.item.name,
            quantity=Decimal('1'), rate=Decimal('10000'), line_total=Decimal('10000'),
        )
        before = self.item.current_stock
        sync_inventory_for_sell_invoice(inv, self.user)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, before - Decimal('1'))
        mov = StockMovement.objects.get(reference_type='Sell Invoice', item=self.item)
        self.assertEqual(mov.movement_type, 'Outward')
        self.assertEqual(mov.project_id, self.project.id)

    def test_project_source_sell_skips_stock_out(self):
        inv = SellInvoice.objects.create(
            invoice_date='2026-03-02', party=self.party, project=self.project,
            status='Issued', source='Project', created_by=self.user,
            total_amount=Decimal('10000'),
        )
        SellInvoiceLine.objects.create(
            invoice=inv, inventory_item=self.item, material_name=self.item.name,
            quantity=Decimal('1'), rate=Decimal('10000'), line_total=Decimal('10000'),
        )
        before = self.item.current_stock
        sync_inventory_for_sell_invoice(inv, self.user)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, before)

    def test_stock_movement_api_blocks_invoice_linked_edit(self):
        inv = SellInvoice.objects.create(
            invoice_date='2026-03-02', party=self.party, project=self.project,
            status='Issued', source='Accounts', created_by=self.user,
            total_amount=Decimal('10000'),
        )
        line = SellInvoiceLine.objects.create(
            invoice=inv, inventory_item=self.item, material_name=self.item.name,
            quantity=Decimal('1'), rate=Decimal('10000'), line_total=Decimal('10000'),
        )
        sync_inventory_for_sell_invoice(inv, self.user)
        line.refresh_from_db()
        mov_id = line.stock_movement_id
        self.assertTrue(mov_id)
        res = self.client.patch(f'/api/v1/inventory/movements/{mov_id}/', {
            'quantity': '99',
        }, format='json')
        self.assertIn(res.status_code, (403, 400), res.content)
        res_del = self.client.delete(f'/api/v1/inventory/movements/{mov_id}/')
        self.assertIn(res_del.status_code, (403, 400), res_del.content)

    def test_project_specific_purchase_requires_project(self):
        res = self.client.post('/api/v1/accounts/purchase-invoices/', {
            'invoice_date': '2026-03-03',
            'supplier_name': 'Sup A',
            'procurement_scope': 'Project',
            'status': 'Recorded',
            'lines': [{'material_name': 'X', 'category': 'Service', 'quantity': 1, 'rate': 10}],
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn('project', res.data)

    def test_accounts_sell_blocked_when_jobs_dispatch_exists(self):
        from apps.inventory.models import StockMovement
        StockMovement.objects.create(
            item=self.item,
            movement_type='Outward',
            quantity=Decimal('1'),
            rate=self.item.rate,
            from_warehouse=self.wh,
            project=self.project,
            reference_type='Jobs',
            reference_no='DISP-1',
            notes='Prior dispatch',
            created_by=self.user,
        )
        inv = SellInvoice.objects.create(
            invoice_date='2026-03-04', party=self.party, project=self.project,
            status='Issued', source='Accounts', created_by=self.user,
            total_amount=Decimal('10000'),
        )
        SellInvoiceLine.objects.create(
            invoice=inv, inventory_item=self.item, material_name=self.item.name,
            quantity=Decimal('1'), rate=Decimal('10000'), line_total=Decimal('10000'),
        )
        with self.assertRaises(ValidationError):
            sync_inventory_for_sell_invoice(inv, self.user)

    def test_manual_stock_adjustment_still_works(self):
        res = self.client.post('/api/v1/inventory/movements/', {
            'item': self.item.id,
            'movement_type': 'Adjustment',
            'quantity': '1',
            'to_warehouse': self.wh.id,
            'reference_type': 'Manual',
            'notes': 'Cycle count',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)

    def test_manual_adjustment_requires_notes(self):
        res = self.client.post('/api/v1/inventory/movements/', {
            'item': self.item.id,
            'movement_type': 'Adjustment',
            'quantity': '1',
            'to_warehouse': self.wh.id,
            'reference_type': 'Manual',
            'notes': '',
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)

    def test_sell_resave_does_not_duplicate_movement(self):
        inv = SellInvoice.objects.create(
            invoice_date='2026-03-05', party=self.party, project=self.project,
            status='Issued', source='Accounts', created_by=self.user,
            total_amount=Decimal('10000'),
        )
        line = SellInvoiceLine.objects.create(
            invoice=inv, inventory_item=self.item, material_name=self.item.name,
            quantity=Decimal('1'), rate=Decimal('10000'), line_total=Decimal('10000'),
        )
        sync_inventory_for_sell_invoice(inv, self.user)
        line.refresh_from_db()
        mov_id = line.stock_movement_id
        self.assertTrue(mov_id)
        sync_inventory_for_sell_invoice(inv, self.user)
        line.refresh_from_db()
        self.assertEqual(line.stock_movement_id, mov_id)
        self.assertEqual(
            StockMovement.objects.filter(reference_type='Sell Invoice', item=self.item).count(),
            1,
        )

    def test_sell_cancel_reverses_stock(self):
        inv = SellInvoice.objects.create(
            invoice_date='2026-03-06', party=self.party, project=self.project,
            status='Issued', source='Accounts', created_by=self.user,
            total_amount=Decimal('10000'),
        )
        SellInvoiceLine.objects.create(
            invoice=inv, inventory_item=self.item, material_name=self.item.name,
            quantity=Decimal('2'), rate=Decimal('5000'), line_total=Decimal('10000'),
        )
        before = self.item.current_stock
        sync_inventory_for_sell_invoice(inv, self.user)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, before - Decimal('2'))
        inv.status = 'Cancelled'
        inv.save(update_fields=['status'])
        sync_inventory_for_sell_invoice(inv, self.user)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_stock, before)

    def test_stock_movements_filter_by_project(self):
        inv = SellInvoice.objects.create(
            invoice_date='2026-03-07', party=self.party, project=self.project,
            status='Issued', source='Accounts', created_by=self.user,
            total_amount=Decimal('10000'),
        )
        SellInvoiceLine.objects.create(
            invoice=inv, inventory_item=self.item, material_name=self.item.name,
            quantity=Decimal('1'), rate=Decimal('10000'), line_total=Decimal('10000'),
        )
        sync_inventory_for_sell_invoice(inv, self.user)
        res = self.client.get(f'/api/v1/inventory/movements/?project={self.project.id}')
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertTrue(any(r.get('project') == self.project.id for r in rows))

    def test_reconciliation_endpoint(self):
        res = self.client.get('/api/v1/inventory/movements/reconciliation/')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIn('summary', res.data)
        self.assertIn('findings', res.data)

    def test_project_payment_fifo_allocates_invoice(self):
        from apps.accounts_module.services import sync_project_payment_to_accounts
        from apps.accounts_module.invoice_payment_allocation import (
            invoice_outstanding, sum_active_allocations,
        )
        from apps.projects.models import ProjectPayment

        inv = SellInvoice.objects.create(
            invoice_no='SI-FIFO-1',
            invoice_date='2026-03-08',
            party=self.party,
            party_name=self.party.name,
            project=self.project,
            status='Issued',
            source='Project',
            total_amount=Decimal('50000'),
            payment_amount=Decimal('0'),
            balance_due=Decimal('50000'),
            created_by=self.user,
        )
        pp = ProjectPayment.objects.create(
            project=self.project,
            amount=Decimal('20000'),
            payment_mode='UPI',
            payment_date='2026-03-08',
            reference='FIFO-UTR',
            created_by=self.user,
        )
        payment = sync_project_payment_to_accounts(pp, self.user)
        self.assertEqual(sum_active_allocations(payment_id=payment.id), Decimal('20000'))
        self.assertEqual(invoice_outstanding(inv), Decimal('30000'))
        # Idempotent re-sync must not double-allocate
        sync_project_payment_to_accounts(pp, self.user)
        self.assertEqual(sum_active_allocations(payment_id=payment.id), Decimal('20000'))
