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
        user = make_user('leaduser@test.com', 'Lead Role', {'Leads': {'can_view': True}})
        for i in range(120):
            Lead.objects.create(customer_name=f'Cust {i}', mobile_number=f'9{i:09d}', created_by=user)
        self.client.force_authenticate(user)
        res = self.client.get('/api/v1/leads/?page_size=200')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['results']), 120)

    def test_failed_login_is_logged(self):
        make_user('login@test.com', 'Any Role')
        res = self.client.post('/api/v1/auth/login/', {'email': 'login@test.com', 'password': 'wrong'}, format='json')
        self.assertEqual(res.status_code, 401)
        self.assertTrue(UserActivityLog.objects.filter(action='Login Failed').exists())
