"""Sales Executive customer visibility — only owned leads' parties."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role, RolePermission, User
from apps.accounts_module.models import Account
from apps.leads.models import Lead


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


class SalesExecutiveCustomerScopeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        perms = {
            'Customer': {'can_view': True, 'can_add': True, 'can_edit': True},
            'Lead': {'can_view': True, 'can_add': True, 'can_edit': True},
        }
        self.se = make_user('se.scope@test.com', 'Sales Executive', perms)
        self.other = make_user('se.other@test.com', 'Sales Executive', perms)

        Lead.objects.create(
            customer_name='Mine Assigned',
            mobile_number='9111111111',
            created_by=self.other,
            assigned_to=self.se,
            status='Follow-up',
        )
        Lead.objects.create(
            customer_name='Mine Created',
            mobile_number='9222222222',
            created_by=self.se,
            assigned_to=self.se,
            status='New',
        )
        Lead.objects.create(
            customer_name='Not Mine',
            mobile_number='9333333333',
            created_by=self.other,
            assigned_to=self.other,
            status='New',
        )
        Account.objects.create(name='Mine Assigned', account_type='Customer', phone='9111111111', created_by=self.other)
        Account.objects.create(name='Mine Created', account_type='Customer', phone='9222222222', created_by=self.se)
        Account.objects.create(name='Not Mine', account_type='Customer', phone='9333333333', created_by=self.other)

    def test_customer_view_permission_allows_parties_without_accounts_module(self):
        self.client.force_authenticate(self.se)
        res = self.client.get('/api/v1/accounts/parties/', {'account_type': 'Customer', 'page_size': 50})
        self.assertEqual(res.status_code, 200, res.data)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        phones = {str(r.get('phone') or '')[-10:] for r in rows}
        self.assertIn('9111111111', phones)
        self.assertIn('9222222222', phones)
        self.assertNotIn('9333333333', phones)

    def test_customer_directory_scopes_to_owned_leads(self):
        self.client.force_authenticate(self.se)
        res = self.client.get('/api/v1/accounts/parties/customer-directory/')
        self.assertEqual(res.status_code, 200, res.data)
        phones = {str(r.get('phone') or '')[-10:] for r in res.data.get('results', [])}
        self.assertIn('9111111111', phones)
        self.assertIn('9222222222', phones)
        self.assertNotIn('9333333333', phones)
