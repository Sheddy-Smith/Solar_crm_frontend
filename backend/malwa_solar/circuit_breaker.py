"""Process-local circuit breaker for external I/O (SMTP, HTTP, S3, …).

State is intentionally in-memory: each Gunicorn worker trips independently.
That still protects the worker from stampeding a dead dependency. For
cross-instance coordination use Redis locks separately.
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class BreakerState:
    failures: int = 0
    opened_at: float = 0.0
    state: str = 'closed'  # closed | open | half_open


class CircuitBreaker:
    def __init__(
        self,
        name: str,
        *,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_successes: int = 1,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_successes = half_open_successes
        self._state = BreakerState()
        self._lock = threading.Lock()
        self._half_open_ok = 0

    def allow(self) -> bool:
        with self._lock:
            if self._state.state == 'closed':
                return True
            if self._state.state == 'open':
                if time.monotonic() - self._state.opened_at >= self.recovery_timeout:
                    self._state.state = 'half_open'
                    self._half_open_ok = 0
                    logger.info('Circuit %s → half_open', self.name)
                    return True
                return False
            return True  # half_open: allow probe

    def record_success(self) -> None:
        with self._lock:
            if self._state.state == 'half_open':
                self._half_open_ok += 1
                if self._half_open_ok >= self.half_open_successes:
                    self._state = BreakerState(state='closed')
                    logger.info('Circuit %s → closed', self.name)
            else:
                self._state.failures = 0

    def record_failure(self) -> None:
        with self._lock:
            self._state.failures += 1
            if self._state.state == 'half_open' or self._state.failures >= self.failure_threshold:
                self._state.state = 'open'
                self._state.opened_at = time.monotonic()
                logger.warning(
                    'Circuit %s → open after %s failures',
                    self.name, self._state.failures,
                )

    def call(self, fn, *args, **kwargs):
        if not self.allow():
            raise CircuitOpenError(self.name)
        try:
            result = fn(*args, **kwargs)
        except Exception:
            self.record_failure()
            raise
        self.record_success()
        return result


class CircuitOpenError(RuntimeError):
    def __init__(self, name: str):
        super().__init__(f'Circuit open: {name}')
        self.name = name


# Shared breakers for known external surfaces.
smtp_breaker = CircuitBreaker('smtp', failure_threshold=5, recovery_timeout=60)
http_breaker = CircuitBreaker('outbound_http', failure_threshold=5, recovery_timeout=30)
