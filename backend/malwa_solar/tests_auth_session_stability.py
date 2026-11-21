"""Regression: logout + refresh session stability (BUG 03)."""

from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.views import LogoutView
from malwa_solar.tests_predeploy_hardening import make_user


@override_settings(
    REST_FRAMEWORK={
        'DEFAULT_AUTHENTICATION_CLASSES': (
            'rest_framework_simplejwt.authentication.JWTAuthentication',
        ),
        'DEFAULT_PERMISSION_CLASSES': (
            'rest_framework.permissions.IsAuthenticated',
        ),
    }
)
class LogoutWithoutAccessTokenTests(TestCase):
    def setUp(self):
        self.user = make_user('session-stable@test.com', 'Session User', {'Dashboard': {'can_view': True}})
        self.factory = APIRequestFactory()

    def test_logout_blacklists_refresh_without_access_auth(self):
        refresh = RefreshToken.for_user(self.user)
        raw = str(refresh)
        req = self.factory.post('/api/v1/auth/logout/', {'refresh': raw}, format='json')
        # No force_authenticate — access may already be expired on the client.
        resp = LogoutView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.get('status'), 'logged_out')

        req2 = self.factory.post('/api/v1/auth/logout/', {'refresh': raw}, format='json')
        resp2 = LogoutView.as_view()(req2)
        self.assertEqual(resp2.status_code, 400)

    def test_logout_still_works_when_authenticated(self):
        refresh = RefreshToken.for_user(self.user)
        raw = str(refresh)
        req = self.factory.post('/api/v1/auth/logout/', {'refresh': raw}, format='json')
        force_authenticate(req, user=self.user)
        resp = LogoutView.as_view()(req)
        self.assertEqual(resp.status_code, 200)
