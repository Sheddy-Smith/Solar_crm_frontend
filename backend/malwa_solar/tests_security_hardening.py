"""Focused tests for H2 trusted-proxy login throttle identity + H3 fail-open counter."""
from django.conf import settings
from django.test import RequestFactory, SimpleTestCase, override_settings

from apps.accounts.views import _InMemoryLoginThrottle
from malwa_solar.ip_access_middleware import get_client_ip, get_ip_fail_open_count, IpAccessMiddleware


class TrustedProxyIpTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @override_settings(TRUSTED_PROXIES=('127.0.0.1', '::1'))
    def test_ignores_xff_from_untrusted_peer(self):
        request = self.factory.get('/')
        request.META['REMOTE_ADDR'] = '8.8.8.8'
        request.META['HTTP_X_FORWARDED_FOR'] = '1.2.3.4'
        self.assertEqual(get_client_ip(request), '8.8.8.8')

    @override_settings(TRUSTED_PROXIES=('127.0.0.1', '::1'))
    def test_uses_xff_from_trusted_proxy(self):
        request = self.factory.get('/')
        request.META['REMOTE_ADDR'] = '127.0.0.1'
        request.META['HTTP_X_FORWARDED_FOR'] = '9.9.9.9, 10.0.0.1'
        self.assertEqual(get_client_ip(request), '9.9.9.9')


class IpFailOpenCounterTests(SimpleTestCase):
    def test_fail_open_increments_counter(self):
        before = get_ip_fail_open_count()

        def boom(_request):
            raise RuntimeError('rules db down')

        mw = IpAccessMiddleware(lambda r: None)
        mw._check = boom  # type: ignore[method-assign]
        request = RequestFactory().get('/api/v1/health/')
        request.META['REMOTE_ADDR'] = '127.0.0.1'
        mw(request)
        self.assertGreaterEqual(get_ip_fail_open_count(), before + 1)


class LoginFallbackIpTests(SimpleTestCase):
    @override_settings(
        TRUSTED_PROXIES=('127.0.0.1',),
        REST_FRAMEWORK={
            **getattr(settings, 'REST_FRAMEWORK', {}),
            'DEFAULT_THROTTLE_RATES': {'login': '3/min'},
        },
    )
    def test_fallback_buckets_by_xff_behind_trusted_proxy(self):
        throttle = _InMemoryLoginThrottle()
        factory = RequestFactory()
        a = factory.post('/api/v1/auth/login/')
        a.META['REMOTE_ADDR'] = '127.0.0.1'
        a.META['HTTP_X_FORWARDED_FOR'] = '1.1.1.1'
        b = factory.post('/api/v1/auth/login/')
        b.META['REMOTE_ADDR'] = '127.0.0.1'
        b.META['HTTP_X_FORWARDED_FOR'] = '2.2.2.2'
        for _ in range(3):
            self.assertTrue(throttle.allow(a)[0])
        blocked, _wait = throttle.allow(a)
        self.assertFalse(blocked)
        # Different client IP behind same proxy must not share the bucket.
        self.assertTrue(throttle.allow(b)[0])
