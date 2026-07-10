from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.dashboard.services import build_unified_dashboard, get_unified_dashboard


class UnifiedDashboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user(
            'dash@test.com',
            'Dashboard User',
            {'Dashboard': {'can_view': True}},
        )
        self.client.force_authenticate(self.user)

    def test_build_unified_dashboard_structure(self):
        data = build_unified_dashboard()
        self.assertIn('overview', data)
        self.assertIn('sales', data)
        self.assertIn('projects', data)
        self.assertIn('finance', data)
        self.assertIn('alerts', data)

    def test_unified_endpoint(self):
        res = self.client.get('/api/v1/dashboard/unified/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('overview', res.data)

    def test_cached_response(self):
        params = {'date_from': '2024-01-01'}
        first = get_unified_dashboard(params)
        second = get_unified_dashboard(params)
        self.assertEqual(first['filters']['date_from'], '2024-01-01')
        self.assertEqual(second['overview']['hero']['total_leads'], first['overview']['hero']['total_leads'])
