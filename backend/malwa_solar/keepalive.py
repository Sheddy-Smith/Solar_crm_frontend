"""Self keep-alive for Render's free tier.

Render spins a free web service down after 15 minutes without inbound
requests. The frontend already pings /api/v1/health/ every 14 minutes, but
that only works while someone has a browser tab open. This module makes the
backend ping its own public URL from a daemon thread, so the service stays
awake 24/7 even when nobody is using the app.

Activation is gated on RENDER_EXTERNAL_URL, which Render injects
automatically into every web service — so this is a no-op in local dev,
tests and management commands (none of which import wsgi.py anyway).

Note: with `--workers 2` each gunicorn worker starts its own thread, so the
service receives ~2 pings per interval. That's intentional slack (a worker
restart can't leave a silent gap) and the traffic is negligible.
"""
import logging
import os
import threading
import time
import urllib.request

logger = logging.getLogger(__name__)

PING_INTERVAL_SECONDS = 14 * 60

_started = False
_lock = threading.Lock()


def _ping_forever(url):
    while True:
        time.sleep(PING_INTERVAL_SECONDS)
        try:
            urllib.request.urlopen(url, timeout=30)
        except Exception as exc:  # never let the keep-alive thread die
            logger.debug('keep-alive self-ping failed: %s', exc)


def start_self_ping():
    global _started
    base_url = os.environ.get('RENDER_EXTERNAL_URL', '').rstrip('/')
    if not base_url:
        return
    with _lock:
        if _started:
            return
        _started = True
    url = f'{base_url}/api/v1/health/'
    thread = threading.Thread(
        target=_ping_forever, args=(url,), name='render-keepalive', daemon=True,
    )
    thread.start()
    logger.info('Render keep-alive self-ping started: %s every %ss', url, PING_INTERVAL_SECONDS)
