"""WSGI entry for microservice slices (set MALWA_SERVICE_NAME before import)."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'backend'))
sys.path.insert(0, str(ROOT / 'services' / 'shared'))

os.environ.setdefault(
    'DJANGO_SETTINGS_MODULE',
    os.environ.get('DJANGO_SETTINGS_MODULE', 'services.django_settings'),
)

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
