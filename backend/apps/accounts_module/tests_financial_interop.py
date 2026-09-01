"""Tests for Category→COA map, employee voucher journal, project expense sync,
material dispatch cost, and planning price difference."""

from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.accounts_module.category_map import ensure_recommended_coa, resolve_labour_coa
from apps.accounts_module.models import Account, AccountCategoryMap, ChartOfAccount, PaymentVoucher, SellInvoice, Transaction
from apps.accounts_module.project_financial_sync import (
    material_plan_pricing as pricing_fn,
    project_pnl,
    sync_accounts_for_material_dispatch,
    sync_accounts_for_project_expense,
)
from apps.accounts_module.services import sync_payment_voucher_for_employee_voucher
from apps.inventory.models import InventoryItem, Warehouse
from apps.projects.models import MaterialPlan, Project, ProjectExpense, ProjectPayment
from apps.workforce.models import Employee, EmployeeVoucher


class FinancialInteropTests(TestCase):
    def setUp(self):
        ensure_recommended_coa()
        self.user = make_user(
            'finance@test.com',
            'Finance Admin',
            {
                'Accounts': {'full_access': True},
                'Project Management': {'full_access': True},
                'Inventory': {'full_access': True},
                'Employee': {'full_access': True},
            },
        )
        self.warehouse = Warehouse.objects.create(name='Main WH')
        self.item = InventoryItem.objects.create(
            name='Solar Panel 550W',
            category='Panel',
            unit='Nos',
            rate=Decimal('10000.00'),
            selling_price=Decimal('13000.00'),
            current_stock=Decimal('100'),
            warehouse=self.warehouse,
        )
        self.project = Project.objects.create(
            project_name='Test Site',
            customer_name='Test Customer',
            capacity_kwp=Decimal('5.00'),
            total_value=Decimal('200000.00'),
            status='Active',
            created_by=self.user,
        )

    def test_seed_recommended_coa_and_maps(self):
        self.assertTrue(ChartOfAccount.objects.filter(account_code='5210').exists())
        self.assertTrue(ChartOfAccount.objects.filter(account_code='5410').exists())
        self.assertTrue(
            AccountCategoryMap.objects.filter(
                business_module='Labour', business_category='Labour',
            ).exists()
        )
        labour = resolve_labour_coa()
        self.assertEqual(labour.account_code, '5310')

    def test_employee_voucher_creates_payment_voucher_and_journal(self):
        emp = Employee.objects.create(name='Ramesh', daily_rate=Decimal('800'), skill_trade='Electrician')
        voucher = EmployeeVoucher.objects.create(
            employee=emp,
            voucher_date=date(2026, 8, 1),
            amount=Decimal('5000.00'),
            payment_mode='Cash',
        )
        # Signal already synced; verify idempotent re-sync
        sync_payment_voucher_for_employee_voucher(voucher, user=self.user)
        sync_payment_voucher_for_employee_voucher(voucher, user=self.user)

        pv = PaymentVoucher.objects.filter(employee_voucher=voucher)
        self.assertEqual(pv.count(), 1)
        self.assertEqual(pv.first().amount, Decimal('5000.00'))
        journals = Transaction.objects.filter(source_payment_voucher=pv.first())
        self.assertEqual(journals.count(), 1)
        self.assertEqual(journals.first().debit_account.account_code, '5310')
        self.assertEqual(journals.first().amount, Decimal('5000.00'))

    def test_project_expense_sync_journal(self):
        expense = ProjectExpense.objects.create(
            project=self.project,
            category='Transport',
            description='Lorry hire',
            amount=Decimal('2000.00'),
            date=date(2026, 8, 2),
            payment_mode='Cash',
            status='Paid',
            created_by=self.user,
        )
        sync_accounts_for_project_expense(expense, user=self.user)
        sync_accounts_for_project_expense(expense, user=self.user)  # idempotent

        pv = PaymentVoucher.objects.filter(project_expense=expense)
        self.assertEqual(pv.count(), 1)
        journal = Transaction.objects.get(source_payment_voucher=pv.first())
        self.assertEqual(journal.debit_account.account_code, '5320')
        self.assertEqual(journal.amount, Decimal('2000.00'))

    def test_material_dispatch_uses_inventory_cost_not_planning_price(self):
        plan = MaterialPlan.objects.create(
            project=self.project,
            category='Panel',
            items='Solar Panel 550W',
            planned_qty='10',
            planning_unit_price=Decimal('13000.00'),
            planned_value='130000',
            inventory_item=self.item,
            dispatched_qty='10',
            dispatch_status='Dispatched',
            dispatch_date=date(2026, 8, 3),
        )
        result = sync_accounts_for_material_dispatch(plan, user=self.user)
        self.assertTrue(result.get('synced'))
        self.assertEqual(result.get('actual_material_cost'), 100000.0)  # 10 × 10000

        pv = PaymentVoucher.objects.get(material_plan=plan)
        self.assertEqual(pv.amount, Decimal('100000.00'))
        journal = Transaction.objects.get(source_payment_voucher=pv)
        self.assertEqual(journal.debit_account.account_code, '5210')

        pricing = pricing_fn(plan)
        self.assertEqual(pricing['inventory_unit_cost'], Decimal('10000.00'))
        self.assertEqual(pricing['planning_unit_price'], Decimal('13000.00'))
        self.assertEqual(pricing['unit_difference'], Decimal('3000.00'))
        self.assertEqual(pricing['planning_difference_total'], Decimal('30000.00'))

    def test_project_pnl_separates_planning_difference(self):
        MaterialPlan.objects.create(
            project=self.project,
            category='Panel',
            items='Solar Panel 550W',
            planned_qty='10',
            planning_unit_price=Decimal('13000.00'),
            planned_value='130000',
            inventory_item=self.item,
            dispatched_qty='10',
            dispatch_status='Dispatched',
        )
        sync_accounts_for_material_dispatch(
            MaterialPlan.objects.get(project=self.project), user=self.user,
        )
        customer = Account.objects.create(
            name='Test Customer',
            account_type='Customer',
            status='Active',
        )
        SellInvoice.objects.create(
            invoice_date=date(2026, 8, 4),
            party=customer,
            party_name=customer.name,
            project=self.project,
            status='Issued',
            subtotal=Decimal('150000.00'),
            total_amount=Decimal('150000.00'),
            balance_due=Decimal('150000.00'),
            created_by=self.user,
        )
        ProjectPayment.objects.create(
            project=self.project,
            amount=Decimal('150000.00'),
            payment_mode='NEFT',
            payment_date=date(2026, 8, 5),
            created_by=self.user,
        )
        # Sync payment to accounts via service
        from apps.accounts_module.services import sync_project_payment_to_accounts
        sync_project_payment_to_accounts(self.project.payments.first(), self.user)

        pnl = project_pnl(self.project)
        self.assertEqual(pnl['revenue'], 150000.0)
        self.assertEqual(pnl['billing']['revenue_from_sell_invoices'], 150000.0)
        self.assertEqual(pnl['billing']['collected_from_customer'], 150000.0)
        self.assertEqual(pnl['billing']['outstanding_receivable'], 0.0)
        self.assertEqual(pnl['costs']['actual_material_cost'], 100000.0)
        self.assertEqual(pnl['material_planning']['planning_value'], 130000.0)
        self.assertEqual(pnl['material_planning']['planning_difference'], 30000.0)
        # Difference must NOT be added into actual material cost
        self.assertNotEqual(
            pnl['costs']['actual_material_cost'],
            pnl['material_planning']['planning_value'],
        )

    def test_category_maps_api_seed(self):
        client = APIClient()
        client.force_authenticate(self.user)
        res = client.post('/api/v1/accounts/category-maps/seed-defaults/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get('ok'))
