import os

# Production serves via gunicorn sync WSGI (see gunicorn.conf.py) so MySQL
# CONN_MAX_AGE can reuse connections. Keep this ASGI entry for local/async
# tooling only — and force CONN_MAX_AGE=0 here so ASGI never orphans pooled
# sockets against Hostinger max_user_connections / max_connections_per_hour.
os.environ['DB_CONN_MAX_AGE'] = '0'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.production')

from django.core.asgi import get_asgi_application  # noqa: E402

application = get_asgi_application()

# Keep the Render free-tier service awake 24/7 (no-op outside Render).
from .keepalive import start_self_ping  # noqa: E402
start_self_ping()
