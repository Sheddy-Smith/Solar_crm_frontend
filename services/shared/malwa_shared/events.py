"""Lightweight domain-event bus for cross-service notifications.

Uses Redis when REDIS_URL is set; otherwise falls back to in-process pub/sub
(local single-process / tests). Services should publish after successful writes
and subscribe in workers — not inside request threads for heavy work.
"""
from __future__ import annotations

import json
import logging
import threading
from typing import Any, Callable

logger = logging.getLogger('malwa_shared.events')

CHANNEL = 'malwa.crm.events'
_local_handlers: list[Callable[[dict], None]] = []
_local_lock = threading.Lock()


def publish(event_type: str, payload: dict[str, Any] | None = None, *, source: str = '') -> None:
    message = {
        'type': event_type,
        'source': source,
        'payload': payload or {},
    }
    body = json.dumps(message, default=str)
    redis_url = _redis_url()
    if redis_url:
        try:
            import redis
            client = redis.from_url(redis_url)
            client.publish(CHANNEL, body)
            return
        except Exception:
            logger.exception('event publish via Redis failed; falling back to local')
    with _local_lock:
        handlers = list(_local_handlers)
    for handler in handlers:
        try:
            handler(message)
        except Exception:
            logger.exception('local event handler failed type=%s', event_type)


def subscribe(handler: Callable[[dict], None]) -> Callable[[], None]:
    """Register an in-process handler. Returns unsubscribe."""
    with _local_lock:
        _local_handlers.append(handler)

    def _unsub():
        with _local_lock:
            if handler in _local_handlers:
                _local_handlers.remove(handler)

    return _unsub


def _redis_url() -> str:
    import os
    url = (os.environ.get('REDIS_URL') or '').strip().lower()
    if url in ('', 'none', 'disabled', 'off', 'false', '0'):
        return ''
    return os.environ.get('REDIS_URL', '').strip()
