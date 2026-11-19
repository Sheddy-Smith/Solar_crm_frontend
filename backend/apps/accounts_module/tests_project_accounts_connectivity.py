"""Regression tests for Project ↔ Accounts connectivity (Phase 1–3)."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts_module.models import Payment, PaymentVoucher, SellInvoice
from apps.accounts_module.project_financial_sync import project_pnl
from apps.accounts_module.services import sync_project_payment_to_accounts
from apps.projects.models import Project, ProjectPayment


User = get_user_model()


class ProjectAccountsConnectivityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='acct_conn@test.local',
            password='TestPass123!',
            name='Acct Conn',
        )
        # Superuser bypasses module permission gates in many local setups.
        self.user.is_superuser = True
        self.user.is_staff = True
        self.user.save(update_fields=['is_superuser', 'is_staff'])
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.project = Project.objects.create(
            project_name='Conn Test Plant',
            customer_name='Conn Customer',
            capacity_kwp=Decimal('5.00'),
            total_value=Decimal('200000.00'),
            status='Active',
            created_by=self.user,
        )

    def test_sell_invoice_requires_project(self):
        res = self.client.post('/api/v1/accounts/sell-invoices/', {
            'invoice_date': '2026-01-15',
            'party_name': 'Conn Customer',
            'status': 'Issued',
            'lines': [{'material_name': 'Panel', 'quantity': 1, 'rate': 1000}],
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn('project', res.data)

    def test_sell_invoice_with_project_ok(self):
        # Service/non-stock line — physical products require inventory_item (Phase A).
        res = self.client.post('/api/v1/accounts/sell-invoices/', {
            'invoice_date': '2026-01-15',
            'party_name': 'Conn Customer',
            'project': self.project.id,
            'status': 'Issued',
            'source': 'Project',
            'lines': [{'material_name': 'EPC Billing', 'category': 'Service', 'quantity': 2, 'rate': 5000}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        inv = SellInvoice.objects.get(id=res.data['id'])
        self.assertEqual(inv.project_id, self.project.id)

    def test_voucher_project_included_in_pnl_labour(self):
        PaymentVoucher.objects.create(
            voucher_date='2026-01-20',
            entry_type='Voucher',
            payee_type='Labour',
            payee_name='Worker One',
            category='Labour',
            amount=Decimal('2500.00'),
            payment_mode='Cash',
            status='Completed',
            project=self.project,
            created_by=self.user,
        )
        pnl = project_pnl(self.project)
        self.assertGreaterEqual(Decimal(str(pnl['costs']['labour_cost'])), Decimal('2500.00'))

    def test_project_payment_sync_idempotent(self):
        pp = ProjectPayment.objects.create(
            project=self.project,
            amount=Decimal('10000.00'),
            payment_mode='UPI',
            payment_date='2026-01-21',
            reference='UTR-1',
            created_by=self.user,
        )
        p1 = sync_project_payment_to_accounts(pp, self.user)
        p2 = sync_project_payment_to_accounts(pp, self.user)
        self.assertEqual(p1.id, p2.id)
        self.assertEqual(Payment.objects.filter(project_payment=pp).count(), 1)
        self.assertEqual(p1.project_id, self.project.id)

    def test_accounts_summary_endpoint(self):
        res = self.client.get(f'/api/v1/projects/{self.project.id}/accounts-summary/')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIn('billing', res.data)
        self.assertIn('costs', res.data)
        self.assertIn('profit_margin_percent', res.data)
