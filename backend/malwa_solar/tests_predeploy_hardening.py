"""Unit coverage for pre-deploy hardening (cache bust, export broker safety)."""
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.tests import make_user
from apps.dashboard.services import (
    CACHE_GEN_KEY,
    get_unified_dashboard,
    invalidate_unified_dashboard_cache,
)
from apps.leads.models import Lead
from apps.reports.views import _queue_or_503


class DashboardCacheInvalidationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user('cache-admin@test.com', 'Cache Admin', {'Dashboard': {'can_view': True}, 'Lead': {'can_view': True, 'can_add': True, 'can_edit': True}})

    def test_generation_bump_changes_cache_key_payload_path(self):
        first = get_unified_dashboard({'date_from': '2024-01-01'})
        g0 = cache.get(CACHE_GEN_KEY) or 0
        invalidate_unified_dashboard_cache(reason='test')
        g1 = cache.get(CACHE_GEN_KEY) or 0
        self.assertGreater(int(g1), int(g0 or 0))
        # After invalidate, a rebuild must still succeed (miss → rebuild).
        second = get_unified_dashboard({'date_from': '2024-01-01'})
        self.assertEqual(first['filters']['date_from'], second['filters']['date_from'])

    def test_lead_write_invalidates_dashboard_cache(self):
        get_unified_dashboard({})
        before = int(cache.get(CACHE_GEN_KEY) or 0)
        Lead.objects.create(
            customer_name='Cache Probe',
            mobile_number='9990001111',
            created_by=self.user,
            status='New',
        )
        after = int(cache.get(CACHE_GEN_KEY) or 0)
        self.assertGreater(after, before)

    def test_cache_scope_marker_present_in_key_builder(self):
        from apps.dashboard.services import CACHE_SCOPE, _cache_key
        key = _cache_key({})
        self.assertIn(CACHE_SCOPE, key)
        self.assertIn(':shared:', key)


class ExportBrokerSafetyTests(SimpleTestCase):
    def test_broker_exception_returns_503_not_queued(self):
        class Boom:
            @staticmethod
            def delay(*args, **kwargs):
                raise ConnectionError('broker down')

        with override_settings(CELERY_TASK_ALWAYS_EAGER=False, ALLOW_EAGER_EXPORTS=False):
            resp = _queue_or_503(Boom, 'export_leads_csv', 1, (1, {}))
        self.assertEqual(resp.status_code, 503)
        self.assertEqual(resp.data.get('status'), 'unavailable')
        self.assertIs(resp.data.get('queued'), False)
        self.assertNotIn('task_id', resp.data)

    def test_eager_refuse_returns_503(self):
        class Never:
            @staticmethod
            def delay(*args, **kwargs):
                raise AssertionError('must not queue')

        with override_settings(CELERY_TASK_ALWAYS_EAGER=True, ALLOW_EAGER_EXPORTS=False):
            resp = _queue_or_503(Never, 'export_leads_csv', 1, (1, {}))
        self.assertEqual(resp.status_code, 503)
        self.assertEqual(resp.data.get('status'), 'unavailable')

    def test_dedupe_returns_same_task_id(self):
        cache.clear()
        calls = {'n': 0}

        class FakeResult:
            def __init__(self, tid):
                self.id = tid

        class Ok:
            @staticmethod
            def delay(*args, **kwargs):
                calls['n'] += 1
                return FakeResult(f'task-{calls["n"]}')

        with override_settings(CELERY_TASK_ALWAYS_EAGER=False, ALLOW_EAGER_EXPORTS=False):
            r1 = _queue_or_503(Ok, 'export_leads_csv', 9, (9, {'status': 'New'}))
            r2 = _queue_or_503(Ok, 'export_leads_csv', 9, (9, {'status': 'New'}))
        self.assertEqual(r1.status_code, 202)
        self.assertEqual(r2.status_code, 202)
        self.assertEqual(r1.data['task_id'], r2.data['task_id'])
        self.assertTrue(r2.data.get('deduped'))
        self.assertEqual(calls['n'], 1)


class LogoutBlacklistTests(TestCase):
    def setUp(self):
        self.user = make_user('logout@test.com', 'Logout User', {'Dashboard': {'can_view': True}})
        self.client_factory = APIRequestFactory()

    def test_logout_blacklists_refresh(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.views import LogoutView

        refresh = RefreshToken.for_user(self.user)
        raw = str(refresh)
        req = self.client_factory.post('/api/v1/auth/logout/', {'refresh': raw}, format='json')
        force_authenticate(req, user=self.user)
        resp = LogoutView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        # Second blacklist attempt should fail as already blacklisted / invalid
        req2 = self.client_factory.post('/api/v1/auth/logout/', {'refresh': raw}, format='json')
        force_authenticate(req2, user=self.user)
        resp2 = LogoutView.as_view()(req2)
        self.assertEqual(resp2.status_code, 400)
