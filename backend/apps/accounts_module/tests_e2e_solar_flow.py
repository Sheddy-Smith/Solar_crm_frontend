"""
Local end-to-end Solar CRM data-flow verification.

Runs the full Lead → Project → Purchase → Inventory → Material Planning →
Dispatch → Expenses → Billing → P&L chain using the real API + services.
LOCAL TEST DB ONLY (Django TestCase rolls back after each test).
"""

from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.accounts_module.category_map import ensure_recommended_coa
from apps.accounts_module.models import (
    Account,
    AccountCategoryMap,
    ChartOfAccount,
    Payment,
    PaymentVoucher,
    PurchaseChallan,
    PurchaseChallanLine,
    PurchaseInvoice,
    SellInvoice,
    Transaction,
)
from apps.accounts_module.project_financial_sync import project_pnl
from apps.accounts_module.supplier_ledger import supplier_totals
from apps.accounts_module.vendor_ledger import vendor_totals
from apps.inventory.models import InventoryItem, StockMovement, Warehouse
from apps.leads.models import Lead, LeadSiteSurvey, Quotation
from apps.projects.models import MaterialPlan, Project, ProjectExpense
from apps.workforce.models import Employee, EmployeeVoucher


def _all_perms():
    modules = [
        'Lead', 'Quotation', 'Customer', 'Project Management', 'Inventory',
        'Accounts', 'Employee', 'Supplier', 'Vendor',
    ]
    return {m: {'full_access': True} for m in modules}


def _journal_rows():
    rows = []
    for txn in Transaction.objects.select_related('debit_account', 'credit_account').order_by('id'):
        rows.append({
            'id': txn.id,
            'type': txn.transaction_type,
            'ref': txn.reference_number,
            'debit': txn.debit_account.account_code if txn.debit_account_id else '—',
            'credit': txn.credit_account.account_code if txn.credit_account_id else '—',
            'amount': float(txn.amount),
            'balanced': txn.debit_account_id and txn.credit_account_id and txn.amount > 0,
        })
    return rows


def _assert_journals_balanced(test_case, label=''):
    for row in _journal_rows():
        test_case.assertTrue(
            row['balanced'],
            f'{label} Journal {row["id"]} ({row["type"]} {row["ref"]}) not balanced: '
            f'Dr {row["debit"]} Cr {row["credit"]} ₹{row["amount"]}',
        )


class SolarE2EFlowTests(TestCase):
    """Complete local E2E scenario with identifiable TEST records."""

    @classmethod
    def setUpTestData(cls):
        ensure_recommended_coa()
        cls.user = make_user('e2e@test.com', 'E2E Admin', _all_perms())
        cls.warehouse = Warehouse.objects.create(name='TEST Main WH', location='Indore')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.today = date(2026, 9, 1)

    # ── Phase 3: COA / category maps ────────────────────────────────────────

    def test_01_coa_and_category_maps(self):
        res = self.client.post('/api/v1/accounts/category-maps/seed-defaults/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get('ok'))

        for code in ('4000', '4100', '5000', '5210', '5310', '5320', '5410', '1130', '1200', '2110'):
            self.assertTrue(
                ChartOfAccount.objects.filter(account_code=code).exists(),
                f'Missing COA {code}',
            )
        self.assertTrue(
            AccountCategoryMap.objects.filter(business_module='Labour').exists(),
        )

    # ── Phases 4–14: Full business flow ─────────────────────────────────────

    def test_02_full_solar_crm_data_flow(self):
        # Supplier
        supplier = Account.objects.create(
            name='TEST Solar Supplier',
            account_type='Supplier',
            phone='9100000001',
            status='Active',
        )

        # Inventory product — opening stock 0, cost ₹10,000
        item_res = self.client.post('/api/v1/inventory/items/', {
            'name': 'TEST Solar Panel 550W',
            'category': 'Solar Panels',
            'unit': 'Nos',
            'rate': '10000.00',
            'selling_price': '13000.00',
            'current_stock': '0',
            'warehouse': self.warehouse.id,
            'is_active': True,
        }, format='json')
        self.assertEqual(item_res.status_code, 201, item_res.data)
        item_id = item_res.data['id']
        item = InventoryItem.objects.get(pk=item_id)
        self.assertEqual(item.rate, Decimal('10000.00'))
        self.assertEqual(item.current_stock, Decimal('0'))

        # Purchase Invoice — 10 × ₹10,000
        pi_res = self.client.post('/api/v1/accounts/purchase-invoices/', {
            'invoice_date': self.today.isoformat(),
            'supplier': supplier.id,
            'supplier_name': supplier.name,
            'status': 'Recorded',
            'payment_mode': 'Other',
            'gst_type': 'CGST_SGST',
            'cgst_percent': '0',
            'sgst_percent': '0',
            'lines': [{
                'inventory_item': item_id,
                'material_name': 'TEST Solar Panel 550W',
                'category': 'Solar Panels',
                'quantity': '10',
                'unit': 'Nos',
                'rate': '10000.00',
            }],
        }, format='json')
        self.assertEqual(pi_res.status_code, 201, pi_res.data)
        pi_id = pi_res.data['id']
        invoice = PurchaseInvoice.objects.get(pk=pi_id)

        item.refresh_from_db()
        self.assertEqual(item.current_stock, Decimal('10.00'))
        self.assertEqual(item.rate, Decimal('10000.00'), 'Inventory rate must not change from planning price')

        pi_line = invoice.lines.first()
        self.assertIsNotNone(pi_line.stock_movement_id)
        mov_in = StockMovement.objects.get(pk=pi_line.stock_movement_id)
        self.assertEqual(mov_in.movement_type, 'Inward')
        self.assertEqual(mov_in.reference_type, 'Purchase Invoice')

        pi_journal = Transaction.objects.filter(
            reference_number=invoice.invoice_no,
            transaction_type='Purchase Invoice',
        ).first()
        self.assertIsNotNone(pi_journal)
        self.assertEqual(pi_journal.debit_account.account_code, '1200')
        self.assertEqual(pi_journal.credit_account.account_code, '2110')
        self.assertEqual(pi_journal.amount, Decimal('100000.00'))

        sup_totals = supplier_totals(supplier)
        self.assertGreaterEqual(sup_totals['credit'], Decimal('100000'))

        # Lead → Site Survey → Quotation → Won → Project
        lead = Lead.objects.create(
            customer_name='TEST Solar Customer',
            mobile_number='9200000002',
            project_name='TEST 10kW Solar Project',
            estimated_capacity='10',
            status='New',
            created_by=self.user,
        )
        LeadSiteSurvey.objects.create(
            lead=lead,
            site_address='TEST Site Indore',
            site_size_sqft='1200',
            mounting_type='RCC',
            survey_date=self.today,
            surveyed_by=self.user,
        )
        quote = Quotation.objects.create(
            lead=lead,
            template='Residential Non-Subsidy',
            status='Sent',
            subtotal=Decimal('160000.00'),
            grand_total=Decimal('160000.00'),
            created_by=self.user,
        )

        lead.status = 'Won'
        lead.save()
        lead.status = 'Won'
        lead.save()  # idempotency — must not duplicate project

        project = Project.objects.get(lead=lead)
        self.assertEqual(project.project_name, 'TEST 10kW Solar Project')
        self.assertEqual(project.total_value, Decimal('160000.00'))
        self.assertEqual(Project.objects.filter(lead=lead).count(), 1)

        customer = Account.objects.filter(name='TEST Solar Customer', account_type='Customer').first()
        self.assertIsNotNone(customer)

        # Material Plan — planning price ₹13,000 (inventory cost stays ₹10,000)
        mp_res = self.client.post('/api/v1/material-plans/', {
            'project': project.id,
            'category': 'Solar Panels',
            'items': 'TEST Solar Panel 550W',
            'planned_qty': '10',
            'planning_unit_price': '13000.00',
            'inventory_item': item_id,
        }, format='json')
        self.assertEqual(mp_res.status_code, 201, mp_res.data)
        self.assertEqual(mp_res.data['inventory_unit_cost'], 10000.0)
        self.assertEqual(mp_res.data['planning_unit_price_display'], 13000.0)
        self.assertEqual(mp_res.data['unit_difference'], 3000.0)
        self.assertEqual(mp_res.data['planning_total_value'], 130000.0)
        self.assertEqual(mp_res.data['planning_difference_total'], 30000.0)

        item.refresh_from_db()
        self.assertEqual(item.rate, Decimal('10000.00'))

        # No journal for planning difference (5410 is report-only)
        diff_journals = Transaction.objects.filter(
            debit_account__account_code='5410',
        ).count() + Transaction.objects.filter(
            credit_account__account_code='5410',
        ).count()
        self.assertEqual(diff_journals, 0)

        plan_id = mp_res.data['id']
        stock_before = item.current_stock

        # Dispatch all 10 panels
        disp_res = self.client.patch(f'/api/v1/material-plans/{plan_id}/', {
            'dispatched_qty': '10',
            'dispatch_status': 'Dispatched',
            'dispatch_date': self.today.isoformat(),
        }, format='json')
        self.assertEqual(disp_res.status_code, 200, disp_res.data)

        item.refresh_from_db()
        self.assertEqual(stock_before, Decimal('10.00'))
        self.assertEqual(item.current_stock, Decimal('0.00'))

        plan = MaterialPlan.objects.get(pk=plan_id)
        self.assertIsNotNone(plan.stock_movement_id)
        mov_out = plan.stock_movement
        self.assertEqual(mov_out.movement_type, 'Outward')
        self.assertEqual(mov_out.reference_type, 'Jobs')

        mat_voucher = PaymentVoucher.objects.get(material_plan=plan)
        self.assertEqual(mat_voucher.amount, Decimal('100000.00'))
        mat_journal = Transaction.objects.get(source_payment_voucher=mat_voucher)
        self.assertEqual(mat_journal.debit_account.account_code, '5210')
        self.assertNotEqual(mat_journal.amount, Decimal('130000.00'))

        # Employee voucher — ₹5,000 labour
        emp = Employee.objects.create(
            name='TEST Solar Technician',
            daily_rate=Decimal('800'),
            skill_trade='Electrician',
        )
        ev = EmployeeVoucher.objects.create(
            employee=emp,
            voucher_date=self.today,
            amount=Decimal('5000.00'),
            payment_mode='Cash',
        )
        ev_pv = PaymentVoucher.objects.get(employee_voucher=ev)
        self.assertEqual(ev_pv.amount, Decimal('5000.00'))
        self.assertIsNone(ev_pv.project_id, 'EmployeeVoucher has no project FK — labour not auto-linked to project')
        ev_journal = Transaction.objects.get(source_payment_voucher=ev_pv)
        self.assertEqual(ev_journal.debit_account.account_code, '5310')

        # Project expense — Transport ₹2,000
        exp_res = self.client.post('/api/v1/project-expenses/', {
            'project': project.id,
            'category': 'Transport',
            'description': 'TEST transport to site',
            'amount': '2000.00',
            'date': self.today.isoformat(),
            'payment_mode': 'Cash',
            'status': 'Paid',
        }, format='json')
        self.assertEqual(exp_res.status_code, 201, exp_res.data)
        expense = ProjectExpense.objects.get(pk=exp_res.data['id'])
        exp_pv = PaymentVoucher.objects.get(project_expense=expense)
        self.assertEqual(exp_pv.amount, Decimal('2000.00'))
        exp_journal = Transaction.objects.get(source_payment_voucher=exp_pv)
        self.assertEqual(exp_journal.debit_account.account_code, '5320')

        # Update expense — idempotent voucher
        upd_res = self.client.patch(f'/api/v1/project-expenses/{expense.id}/', {
            'amount': '2500.00',
        }, format='json')
        self.assertEqual(upd_res.status_code, 200)
        self.assertEqual(PaymentVoucher.objects.filter(project_expense=expense).count(), 1)
        exp_pv.refresh_from_db()
        self.assertEqual(exp_pv.amount, Decimal('2500.00'))

        # Sell Invoice — ₹1,60,000
        si_res = self.client.post('/api/v1/accounts/sell-invoices/', {
            'invoice_date': self.today.isoformat(),
            'party': customer.id,
            'party_name': customer.name,
            'project': project.id,
            'status': 'Issued',
            'payment_mode': 'Other',
            'gst_type': 'CGST_SGST',
            'cgst_percent': '0',
            'sgst_percent': '0',
            'lines': [{
                'material_name': '10kW Solar EPC Package',
                'category': 'Service',
                'quantity': '1',
                'unit': 'Job',
                'rate': '160000.00',
            }],
        }, format='json')
        self.assertEqual(si_res.status_code, 201, si_res.data)
        sell = SellInvoice.objects.get(pk=si_res.data['id'])
        si_journal = Transaction.objects.filter(
            reference_number=sell.invoice_no,
            transaction_type='Sell Invoice',
        ).first()
        self.assertIsNotNone(si_journal)
        self.assertEqual(si_journal.debit_account.account_code, '1130')
        self.assertEqual(si_journal.credit_account.account_code, '4100')
        self.assertEqual(si_journal.amount, Decimal('160000.00'))

        # Customer payment — ₹50,000
        pay_res = self.client.post('/api/v1/project-payments/', {
            'project': project.id,
            'amount': '50000.00',
            'payment_mode': 'NEFT',
            'payment_date': self.today.isoformat(),
            'reference': 'TEST-RCPT-001',
        }, format='json')
        self.assertEqual(pay_res.status_code, 201, pay_res.data)
        payment = Payment.objects.get(project_payment_id=pay_res.data['id'])
        pay_journal = Transaction.objects.get(source_payment=payment)
        self.assertEqual(pay_journal.debit_account.account_code, '1120')  # NEFT → bank
        self.assertEqual(pay_journal.credit_account.account_code, '1130')
        self.assertEqual(payment.amount, Decimal('50000.00'))

        # Vendor service — NOT supplier, no inventory
        vendor = Account.objects.create(
            name='TEST Solar Transport Vendor',
            account_type='Vendor',
            phone='9300000003',
            status='Active',
        )
        vch_res = self.client.post('/api/v1/accounts/vouchers/', {
            'voucher_date': self.today.isoformat(),
            'entry_type': 'Expense',
            'payee_type': 'Vendor',
            'payee_name': vendor.name,
            'category': 'Transport',
            'particulars': 'TEST vendor transport service',
            'payment_mode': 'Cash',
            'amount': '5000.00',
            'project': project.id,
            'status': 'Completed',
        }, format='json')
        self.assertEqual(vch_res.status_code, 201, vch_res.data)
        v_totals = vendor_totals(vendor)
        self.assertGreater(v_totals['credit'], 0)
        stock_after_vendor = item.current_stock
        self.assertEqual(stock_after_vendor, Decimal('0.00'), 'Vendor service must not create stock IN')

        # P&L API
        pnl_res = self.client.get(f'/api/v1/projects/{project.id}/pnl/')
        self.assertEqual(pnl_res.status_code, 200)
        pnl = pnl_res.data
        self.assertEqual(pnl['costs']['actual_material_cost'], 100000.0)
        self.assertEqual(pnl['material_planning']['planning_value'], 130000.0)
        self.assertEqual(pnl['material_planning']['planning_difference'], 30000.0)
        self.assertEqual(pnl['costs']['transport_cost'], 2500.0)
        self.assertNotEqual(
            pnl['costs']['actual_material_cost'],
            pnl['material_planning']['planning_value'],
        )
        # Revenue = Sell Invoice (accrual); payment reduces AR only
        self.assertEqual(pnl['revenue'], 160000.0)
        self.assertEqual(pnl['billing']['revenue_from_sell_invoices'], 160000.0)
        self.assertEqual(pnl['billing']['collected_from_customer'], 50000.0)
        self.assertEqual(pnl['billing']['outstanding_receivable'], 110000.0)
        self.assertEqual(pnl['actual_profit'], 57500.0)  # 160k − 100k material − 2.5k transport
        self.assertEqual(pnl['costs']['labour_cost'], 0.0)  # employee voucher not project-linked

        # Stock history: +10 purchase, -10 dispatch = 0
        movements = StockMovement.objects.filter(item_id=item_id).order_by('id')
        inward = sum(m.quantity for m in movements if m.movement_type == 'Inward')
        outward = sum(m.quantity for m in movements if m.movement_type == 'Outward')
        self.assertEqual(inward - outward, item.current_stock)

        _assert_journals_balanced(self, 'E2E')

        # Cleanup expense delete
        del_res = self.client.delete(f'/api/v1/project-expenses/{expense.id}/')
        self.assertIn(del_res.status_code, (204, 200))
        self.assertFalse(PaymentVoucher.objects.filter(project_expense_id=expense.id).exists())

        # Store IDs for idempotency test
        self._e2e_ids = {
            'plan_id': plan_id,
            'pi_id': pi_id,
            'expense_deleted': True,
        }

    # ── Phase 17: Idempotency ─────────────────────────────────────────────────

    def test_03_idempotency_resync(self):
        """Re-save key records — no duplicate vouchers/journals/movements."""
        self.test_02_full_solar_crm_data_flow()

        plan = MaterialPlan.objects.order_by('-id').first()
        invoice = PurchaseInvoice.objects.order_by('-id').first()
        ev = EmployeeVoucher.objects.order_by('-id').first()

        j_before = Transaction.objects.count()
        pv_before = PaymentVoucher.objects.count()
        sm_before = StockMovement.objects.count()

        self.client.patch(f'/api/v1/material-plans/{plan.id}/', {
            'dispatch_notes': 'Re-sync test',
        }, format='json')

        self.client.patch(f'/api/v1/accounts/purchase-invoices/{invoice.id}/', {
            'remarks': 'Re-sync test',
        }, format='json')

        from apps.accounts_module.services import sync_payment_voucher_for_employee_voucher
        sync_payment_voucher_for_employee_voucher(ev, user=self.user)
        sync_payment_voucher_for_employee_voucher(ev, user=self.user)

        self.assertEqual(Transaction.objects.count(), j_before)
        self.assertEqual(PaymentVoucher.objects.count(), pv_before)
        self.assertEqual(StockMovement.objects.count(), sm_before)

    # ── Phase 18: Atomicity — over-dispatch must fail without partial state ───

    def test_04_atomicity_over_dispatch_fails(self):
        item = InventoryItem.objects.create(
            name='TEST Atomic Panel',
            category='Solar Panels',
            unit='Nos',
            rate=Decimal('10000'),
            current_stock=Decimal('5'),
            warehouse=self.warehouse,
        )
        project = Project.objects.create(
            project_name='TEST Atomic Project',
            customer_name='TEST Atomic Customer',
            capacity_kwp=Decimal('5'),
            status='Active',
            created_by=self.user,
        )
        plan = MaterialPlan.objects.create(
            project=project,
            category='Solar Panels',
            items='TEST Atomic Panel',
            planned_qty='10',
            planning_unit_price=Decimal('13000'),
            inventory_item=item,
            dispatched_qty='0',
        )
        plan.dispatched_qty = '10'
        plan.dispatch_status = 'Dispatched'
        plan.save(update_fields=['dispatched_qty', 'dispatch_status'])

        from apps.inventory.dispatch_sync import sync_inventory_for_material_dispatch

        sm_before = StockMovement.objects.count()
        pv_before = PaymentVoucher.objects.count()

        with self.assertRaises(ValidationError):
            sync_inventory_for_material_dispatch(plan, user=self.user)

        item.refresh_from_db()
        self.assertEqual(item.current_stock, Decimal('5'))
        self.assertEqual(StockMovement.objects.count(), sm_before)
        self.assertEqual(PaymentVoucher.objects.count(), pv_before)

    # ── Purchase Challan GRN path ───────────────────────────────────────────

    def test_05_purchase_challan_grn_stock_in(self):
        supplier = Account.objects.create(
            name='TEST GRN Supplier',
            account_type='Supplier',
            status='Active',
        )
        item = InventoryItem.objects.create(
            name='TEST GRN Panel',
            category='Solar Panels',
            unit='Nos',
            rate=Decimal('8000'),
            current_stock=Decimal('0'),
            warehouse=self.warehouse,
        )
        challan = PurchaseChallan.objects.create(
            challan_date=self.today,
            supplier=supplier,
            supplier_name=supplier.name,
            status='Received',
            created_by=self.user,
        )
        PurchaseChallanLine.objects.create(
            challan=challan,
            inventory_item=item,
            material_name=item.name,
            quantity=Decimal('5'),
            rate=Decimal('8000'),
            line_total=Decimal('40000'),
        )
        from apps.accounts_module.document_services import sync_inventory_for_purchase_challan
        sync_inventory_for_purchase_challan(challan, user=self.user)

        item.refresh_from_db()
        self.assertEqual(item.current_stock, Decimal('5'))
        line = challan.lines.first()
        self.assertIsNotNone(line.stock_movement_id)
        self.assertEqual(line.stock_movement.reference_type, 'Purchase Challan')
