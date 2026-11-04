import os
from django.core.wsgi import get_wsgi_application

# Prefer reused MySQL connections under sync gunicorn workers. Hostinger caps
# max_connections_per_hour at 500; without reuse, normal CRM traffic exhausts
# the quota and login returns HTTP 500.
os.environ.setdefault('DB_CONN_MAX_AGE', '300')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.production')
application = get_wsgi_application()

# Keep the Render free-tier service awake 24/7 (no-op outside Render).
from .keepalive import start_self_ping  # noqa: E402
start_self_ping()
