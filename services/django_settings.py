"""Django settings for a microservice slice (set MALWA_SERVICE_NAME).

MALWA_SERVICE_ENV=production → production.py hardening
otherwise → development.py (local / CI slices)
"""
import os

_env = (os.environ.get('MALWA_SERVICE_ENV') or os.environ.get('DJANGO_ENV') or '').strip().lower()
if _env in ('production', 'prod'):
    from malwa_solar.settings.production import *  # noqa: F403
else:
    from malwa_solar.settings.development import *  # noqa: F403

from malwa_shared.service_registry import SERVICES

SERVICE_NAME = os.environ.get('MALWA_SERVICE_NAME', 'auth')
if SERVICE_NAME not in SERVICES:
    raise RuntimeError(f'Unknown MALWA_SERVICE_NAME={SERVICE_NAME!r}')

SPEC = SERVICES[SERVICE_NAME]
MALWA_SERVICE_NAME = SERVICE_NAME
MALWA_SERVICE_PORT = int(os.environ.get('MALWA_SERVICE_PORT', SPEC['port']))

_installed = list(INSTALLED_APPS)  # noqa: F405
for _app in SPEC['apps']:
    if _app not in _installed and not any(_app in x for x in _installed):
        _installed.append(_app)
INSTALLED_APPS = _installed  # noqa: F405

ROOT_URLCONF = f'services.slices.{SERVICE_NAME}_urls'
WSGI_APPLICATION = 'services.wsgi.application'
