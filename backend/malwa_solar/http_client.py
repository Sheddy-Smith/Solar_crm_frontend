"""Outbound HTTP with timeouts, limited retries, and circuit breaker.

Use for GET/HEAD/idempotent probes only. Non-idempotent methods never
retry automatically after a successful send ambiguity.
"""
from __future__ import annotations

import logging
import time
import urllib.error
import urllib.request

from .circuit_breaker import CircuitOpenError, http_breaker

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 15.0
MAX_RETRIES = 2  # total attempts = 1 + retries for idempotent methods


def request(
    url: str,
    *,
    method: str = 'GET',
    data: bytes | None = None,
    headers: dict | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    retries: int | None = None,
):
    """Perform an HTTP request behind the outbound circuit breaker.

    Retries with exponential backoff only for idempotent methods (GET/HEAD)
    on connection/timeout errors. Never blindly retries POST/PUT/PATCH/DELETE.
    """
    method = (method or 'GET').upper()
    idempotent = method in ('GET', 'HEAD', 'OPTIONS')
    if retries is None:
        retries = MAX_RETRIES if idempotent else 0

    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        def _do():
            req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
            return urllib.request.urlopen(req, timeout=timeout)

        try:
            # CircuitBreaker.call already records success/failure.
            return http_breaker.call(_do)
        except CircuitOpenError:
            logger.warning('HTTP circuit open for %s %s', method, url)
            raise
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_exc = exc
            if attempt >= retries:
                break
            sleep_s = min(2 ** attempt, 8)
            logger.info(
                'HTTP retry %s %s attempt=%s sleep=%ss err=%s',
                method, url, attempt + 1, sleep_s, exc,
            )
            time.sleep(sleep_s)
    assert last_exc is not None
    raise last_exc
