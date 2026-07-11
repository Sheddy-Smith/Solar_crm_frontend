import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.production')
application = get_wsgi_application()

# Keep the Render free-tier service awake 24/7 (no-op outside Render).
from .keepalive import start_self_ping  # noqa: E402
start_self_ping()
