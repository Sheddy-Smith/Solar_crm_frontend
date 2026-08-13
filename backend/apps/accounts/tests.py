from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role, RolePermission, User
from apps.crm_settings.models import UserActivityLog
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


class PermissionRegressionTests(TestCase):
    """Regression tests for the 2026-07-03 bug-fix batch."""

    def setUp(self):
        self.client = APIClient()

    def test_settings_apiview_no_500_for_non_superadmin(self):
        # HasModulePermission used to crash (AttributeError on view.action)
        # for plain APIViews when the user was not a Super Admin.
        viewer = make_user('viewer@test.com', 'Settings Viewer', {'Settings': {'can_view': True}})
        self.client.force_authenticate(viewer)
        res = self.client.get('/api/v1/settings/company/')
        self.assertEqual(res.status_code, 200)

        no_perm = make_user('noperm@test.com', 'No Perm Role')
        self.client.force_authenticate(no_perm)
        res = self.client.get('/api/v1/settings/company/')
        self.assertEqual(res.status_code, 403)

    def test_view_only_user_cannot_put_site_survey(self):
        from apps.projects.models import Project
        editor = make_user('editor@test.com', 'PM Editor', {'Project Management': {'can_view': True, 'can_edit': True}})
        viewer = make_user('pmviewer@test.com', 'PM Viewer', {'Project Management': {'can_view': True}})
        project = Project.objects.create(project_name='P1', customer_name='C1', capacity_kwp=5, created_by=editor)

        self.client.force_authenticate(viewer)
        self.assertEqual(self.client.get(f'/api/v1/projects/{project.id}/site_survey/').status_code, 200)
        res = self.client.put(f'/api/v1/projects/{project.id}/site_survey/', {'roof_type': 'RCC'}, format='json')
        self.assertEqual(res.status_code, 403)

        self.client.force_authenticate(editor)
        res = self.client.put(f'/api/v1/projects/{project.id}/site_survey/', {'roof_type': 'RCC'}, format='json')
        self.assertEqual(res.status_code, 200)

    def test_pagination_honours_page_size(self):
        user = make_user('leaduser@test.com', 'Lead Role', {'Lead': {'can_view': True}})
        for i in range(120):
            Lead.objects.create(customer_name=f'Cust {i}', mobile_number=f'9{i:09d}', created_by=user)
        self.client.force_authenticate(user)
        res = self.client.get('/api/v1/leads/?page_size=200')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['results']), 120)

    def test_dashboard_lead_stats_total_is_not_zeroed_by_month_filter(self):
        # Hero "Total Leads" must count the live pipeline. Month/year only
        # scopes created_in_period — otherwise older leads vanish from the
        # dashboard while Recent Leads still lists them.
        from datetime import timedelta
        from django.utils import timezone

        user = make_user('statsuser@test.com', 'Super Admin', {'Lead': {'can_view': True}})
        old = Lead.objects.create(customer_name='Old Lead', mobile_number='9000000001', created_by=user, status='New')
        Lead.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=60))
        Lead.objects.create(customer_name='New Lead', mobile_number='9000000002', created_by=user, status='Follow-up')

        self.client.force_authenticate(user)
        today = timezone.localdate().isoformat()
        res = self.client.get(f'/api/v1/leads/stats/?period=month&date={today}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['total'], 2)
        self.assertEqual(res.data['created_in_period'], 1)
        self.assertEqual(res.data['follow_up'], 1)

    def test_failed_login_is_logged(self):
        make_user('login@test.com', 'Any Role')
        res = self.client.post('/api/v1/auth/login/', {'email': 'login@test.com', 'password': 'wrong'}, format='json')
        self.assertEqual(res.status_code, 401)
        self.assertTrue(UserActivityLog.objects.filter(action='Login Failed').exists())

    def test_login_accepts_email_name_or_mobile(self):
        user = make_user('roshini@malwasolar.com', 'Tele Sales Executive', {'Lead': {'can_view': True}})
        user.name = 'Roshini'
        user.mobile = '9876543210'
        user.set_password('SecretPass1')
        user.save()

        # Email
        res = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'roshini@malwasolar.com', 'password': 'SecretPass1'},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn('access', res.data)

        # Display name used as username (case-insensitive)
        res = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'roshini', 'password': 'SecretPass1'},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['user']['name'], 'Roshini')

        # Mobile
        res = self.client.post(
            '/api/v1/auth/login/',
            {'email': '9876543210', 'password': 'SecretPass1'},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
