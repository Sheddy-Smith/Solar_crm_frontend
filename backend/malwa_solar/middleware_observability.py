"""Lightweight request timing logs — enable with OBSERVABILITY_REQUEST_LOG=1.

Does not expose secrets or customer payloads. Safe behind any reverse proxy.
"""
from __future__ import annotations

import logging
import os
import time

logger = logging.getLogger('malwa_solar.observability')


class RequestTimingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = os.environ.get('OBSERVABILITY_REQUEST_LOG', '').lower() in (
            '1', 'true', 'yes', 'on',
        )

    def __call__(self, request):
        if not self.enabled:
            return self.get_response(request)
        start = time.perf_counter()
        response = self.get_response(request)
        ms = (time.perf_counter() - start) * 1000
        path = getattr(request, 'path', '') or ''
        # Skip noisy probes unless slow.
        if path.endswith(('/health/', '/ready/')) and ms < 50:
            return response
        logger.info(
            'http method=%s path=%s status=%s duration_ms=%.1f',
            request.method,
            path[:200],
            getattr(response, 'status_code', '?'),
            ms,
        )
        response['X-Response-Time-Ms'] = f'{ms:.0f}'
        return response
