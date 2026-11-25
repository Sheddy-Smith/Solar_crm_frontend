"""P0/P1 ownership / IDOR regression for audit hotspots (AMC, Accounts, Dashboard, Users)."""
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role, RolePermission, User
from apps.accounts_module.models import SellInvoice
from apps.amc.models import AmcContract
from apps.daily_tasks.models import DailyTask
from apps.leads.models import Lead
from apps.projects.models import Project


def make_user(email, role_name, perms=None):
    role, _ = Role.objects.get_or_create(name=role_name)
    for module, flags in (perms or {}).items():
        perm, _ = RolePermission.objects.get_or_create(role=role, module=module)
        for flag, value in flags.items():
            setattr(perm, flag, value)
        perm.save()
    user = User.objects.create_user(email=email, password='testpass1234', name=email.split('@')[0])
    user.role = role
    user.save()
    return user


TELE_PERMS = {
    'Lead': {'can_view': True, 'can_add': True, 'can_edit': True, 'can_delete': True},
    'AMC & Warranty': {'can_view': True, 'can_add': True, 'can_edit': True},
    'Accounts': {'can_view': True, 'can_add': True, 'can_edit': True},
    'Dashboard': {'can_view': True, 'can_export': True},
    'Daily Tasks': {'can_view': True, 'can_add': True, 'can_edit': True},
    'User Management': {'can_view': True, 'can_add': True, 'can_edit': True},
}


class OwnershipBypassRegressionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tele = make_user('tele.bypass@test.com', 'Tele Sales Executive', TELE_PERMS)
        self.other = make_user('other.bypass@test.com', 'Tele Sales Executive', TELE_PERMS)
        self.super = make_user('super.bypass@test.com', 'Super Admin', TELE_PERMS)
        self.super.is_superuser = True
        self.super.save(update_fields=['is_superuser', 'updated_at'])

        self.own_lead = Lead.objects.create(
            customer_name='Own Lead',
            mobile_number='9888800001',
            created_by=self.tele,
            assigned_to=None,
            status='Won',
        )
        self.foreign_lead = Lead.objects.create(
            customer_name='Foreign Lead',
            mobile_number='9888800002',
            created_by=self.other,
            assigned_to=None,
            status='Won',
        )
        self.own_project = Project.objects.create(
            project_name='Own Project',
            customer_name='Own Lead',
            capacity_kwp=Decimal('5.00'),
            lead=self.own_lead,
            created_by=self.tele,
            status='Active',
        )
        self.foreign_project = Project.objects.create(
            project_name='Foreign Project',
            customer_name='Foreign Lead',
            capacity_kwp=Decimal('5.00'),
            lead=self.foreign_lead,
            created_by=self.other,
            status='Active',
        )
        today = date.today()
        self.own_amc = AmcContract.objects.create(
            project=self.own_project,
            customer_name='Own',
            start_date=today,
            end_date=today + timedelta(days=365),
            annual_value=Decimal('1000.00'),
            status='Active',
            created_by=self.tele,
        )
        self.foreign_amc = AmcContract.objects.create(
            project=self.foreign_project,
            customer_name='Foreign',
            start_date=today,
            end_date=today + timedelta(days=365),
            annual_value=Decimal('2000.00'),
            status='Active',
            created_by=self.other,
        )
        self.own_invoice = SellInvoice.objects.create(
            invoice_no='SI-OWN-1',
            invoice_date=today,
            party_name='Own Party',
            project=self.own_project,
            total_amount=Decimal('500.00'),
            created_by=self.tele,
        )
        self.foreign_invoice = SellInvoice.objects.create(
            invoice_no='SI-FRN-1',
            invoice_date=today,
            party_name='Foreign Party',
            project=self.foreign_project,
            total_amount=Decimal('900.00'),
            created_by=self.other,
        )
        self.own_task = DailyTask.objects.create(
            category='site_visit_log',
            status='Pending',
            task_date=today,
            summary_text='Own task',
            created_by=self.tele,
        )
        self.foreign_task = DailyTask.objects.create(
            category='site_visit_log',
            status='Pending',
            task_date=today,
            summary_text='Foreign task',
            created_by=self.other,
        )

    def test_amc_list_hides_foreign_contracts(self):
        self.client.force_authenticate(self.tele)
        res = self.client.get('/api/v1/amc/contracts/', {'page_size': 100})
        self.assertEqual(res.status_code, 200, res.data)
        ids = [row['id'] for row in res.data.get('results', res.data)]
        self.assertIn(self.own_amc.id, ids)
        self.assertNotIn(self.foreign_amc.id, ids)

    def test_sell_invoice_list_hides_foreign(self):
        self.client.force_authenticate(self.tele)
        res = self.client.get('/api/v1/accounts/sell-invoices/', {'page_size': 100})
        self.assertEqual(res.status_code, 200, res.data)
        ids = [row['id'] for row in res.data.get('results', res.data)]
        self.assertIn(self.own_invoice.id, ids)
        self.assertNotIn(self.foreign_invoice.id, ids)

    def test_daily_task_list_and_summary_scoped(self):
        self.client.force_authenticate(self.tele)
        res = self.client.get('/api/v1/daily-tasks/tasks/', {'page_size': 100})
        self.assertEqual(res.status_code, 200, res.data)
        ids = [row['id'] for row in res.data.get('results', res.data)]
        self.assertIn(self.own_task.id, ids)
        self.assertNotIn(self.foreign_task.id, ids)

        summary = self.client.get('/api/v1/daily-tasks/tasks/summary/')
        self.assertEqual(summary.status_code, 200, summary.data)
        site = summary.data.get('site_visit_log') or {}
        self.assertEqual(site.get('total'), 1)

    def test_dashboard_blocks_assigned_to_idor_for_tele(self):
        self.client.force_authenticate(self.tele)
        res = self.client.get('/api/v1/dashboard/unified/', {'assigned_to': self.other.id})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get('filters', {}).get('ownership_scoped'))
        self.assertEqual(res.data.get('sales', {}).get('total'), 1)

    def test_reports_dashboard_forbidden_for_tele(self):
        self.client.force_authenticate(self.tele)
        res = self.client.get('/api/v1/reports/dashboard/')
        self.assertEqual(res.status_code, 403, res.data)

    def test_toggle_active_requires_super_admin(self):
        self.client.force_authenticate(self.tele)
        res = self.client.post(f'/api/v1/users/{self.other.id}/toggle_active/')
        self.assertEqual(res.status_code, 403, res.data)

        self.client.force_authenticate(self.super)
        res = self.client.post(f'/api/v1/users/{self.other.id}/toggle_active/')
        self.assertEqual(res.status_code, 200, res.data)
        self.other.refresh_from_db()
        self.assertFalse(self.other.is_active)
