"""Cache-outage-safe DRF throttles.

Production incident (2026-07-11): every DRF endpoint that used the default
AnonRateThrottle/UserRateThrottle returned a raw 500 while login (which has
its own fail-open throttle wrapper) and the non-DRF /health/ endpoint kept
working. The default throttles read/write the shared Redis cache on every
request, so any cache failure django-redis doesn't classify as a connection
error (e.g. deserialization of stale entries after a library upgrade, or a
provider quota error) takes down the whole API.

Two defenses, both here:

1. Throttle counters use the ``throttling`` cache alias. With REDIS_URL set
   that alias is Redis (shared across workers/API instances). With Redis
   disabled it is LocMem (per-process — fine for single-instance).

2. ``allow_request`` fails OPEN on unexpected errors for general API traffic
   (logged), so a cache outage cannot take the whole CRM down.

3. Auth endpoints (login scope) must NOT skip rate limiting: views that use
   ``SafeScopedRateThrottle`` with ``throttle_scope='login'`` wrap
   ``check_throttles`` with an in-memory fail-closed fallback (see
   ``accounts.views.CustomTokenObtainPairView``). Use ``fail_closed=True`` on
   a throttle instance/class when you need the mixin itself to deny on error.
"""
import logging

from django.core.cache import caches
from rest_framework import throttling

logger = logging.getLogger(__name__)


class SafeThrottleMixin:
    # Subclasses / instances may set True for auth-sensitive scopes.
    fail_closed = False

    @property
    def cache(self):
        return caches['throttling']

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:
            if self.fail_closed or getattr(view, 'throttle_fail_closed', False):
                logger.warning(
                    'Throttle check failed — failing closed (request denied)',
                    exc_info=True,
                )
                return False
            logger.warning(
                'Throttle check failed — failing open (request allowed)', exc_info=True,
            )
            return True


class SafeAnonRateThrottle(SafeThrottleMixin, throttling.AnonRateThrottle):
    pass


class SafeUserRateThrottle(SafeThrottleMixin, throttling.UserRateThrottle):
    pass


class SafeScopedRateThrottle(SafeThrottleMixin, throttling.ScopedRateThrottle):
    pass


class SafeLoginRateThrottle(SafeScopedRateThrottle):
    """Login-scoped throttle.

    Cache errors are *re-raised* (not fail-open) so
    ``CustomTokenObtainPairView.check_throttles`` can apply its in-memory
    fail-closed fallback. Returning False here would block *all* logins during
    a Redis blip; re-raising keeps brute-force bounds without a total outage.
    """

    scope = 'login'

    def allow_request(self, request, view):
        # Skip SafeThrottleMixin's catch-all — auth must stay fail-closed via
        # the view's in-memory limiter when the shared cache is unavailable.
        return throttling.ScopedRateThrottle.allow_request(self, request, view)
