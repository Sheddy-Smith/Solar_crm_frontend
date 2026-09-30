import os

# Django's docs: disable persistent DB connections under ASGI. Each request's
# sync code runs in its own short-lived thread, so a connection kept open past
# the request is orphaned instead of reused and piles up against the MySQL
# max_user_connections limit. An explicit DB_CONN_MAX_AGE in the process
# environment still wins.
os.environ.setdefault('DB_CONN_MAX_AGE', '0')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.production')

from django.core.asgi import get_asgi_application  # noqa: E402

application = get_asgi_application()

# Keep the Render free-tier service awake 24/7 (no-op outside Render).
from .keepalive import start_self_ping  # noqa: E402
start_self_ping()
