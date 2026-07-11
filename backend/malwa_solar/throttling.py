"""Cache-outage-safe DRF throttles.

Production incident (2026-07-11): every DRF endpoint that used the default
AnonRateThrottle/UserRateThrottle returned a raw 500 while login (which has
its own fail-open throttle wrapper) and the non-DRF /health/ endpoint kept
working. The default throttles read/write the shared Redis cache on every
request, so any cache failure django-redis doesn't classify as a connection
error (e.g. deserialization of stale entries after a library upgrade, or a
provider quota error) takes down the whole API.

Two defenses, both here:

1. Throttle counters live in the in-process ``throttling`` LocMem cache, not
   the shared Redis. Request handling no longer depends on Redis at all, and
   the Upstash free-tier command quota isn't burned 2-4x per request. With
   ``--workers 2`` the counters are per-worker, making effective limits up to
   2x the configured rate — acceptable slack for these coarse abuse caps.

2. ``allow_request`` fails OPEN on any unexpected error (with a logged
   traceback), because throttling is best-effort protection that must never
   be the reason the API is down. Login additionally keeps its own bounded
   in-memory fallback (see accounts.views).
"""
import logging

from django.core.cache import caches
from rest_framework import throttling

logger = logging.getLogger(__name__)


class SafeThrottleMixin:
    @property
    def cache(self):
        return caches['throttling']

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:
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
