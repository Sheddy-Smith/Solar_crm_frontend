"""Build Django settings/urlconf for a named microservice slice."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / 'backend'
SHARED = Path(__file__).resolve().parent / 'shared'

for path in (str(BACKEND), str(SHARED), str(ROOT)):
    if path not in sys.path:
        sys.path.insert(0, path)


def configure(service_name: str) -> None:
    from malwa_shared.service_registry import SERVICES

    if service_name not in SERVICES:
        raise SystemExit(f'Unknown service {service_name!r}. Choose from: {", ".join(SERVICES)}')

    spec = SERVICES[service_name]
    os.environ.setdefault('MALWA_SERVICE_NAME', service_name)
    os.environ.setdefault('MALWA_SERVICE_PORT', str(spec['port']))
    # Reuse existing Django settings; URLConf is swapped to the slice.
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.development')

    import django
    from django.conf import settings

    if not settings.configured:
        django.setup()
    else:
        # Already configured — still ensure service apps are present.
        pass

    # Extend INSTALLED_APPS with any missing deps for this slice.
    installed = list(settings.INSTALLED_APPS)
    for app in spec['apps']:
        if app not in installed and app.split('.')[0] + '.' + app.split('.')[-1] not in installed:
            # apps.dashboard may be DashboardConfig — handle both forms
            short = app
            if short not in installed and not any(short in x for x in installed):
                installed.append(short)
    settings.INSTALLED_APPS = installed
    settings.ROOT_URLCONF = f'services.slices.{service_name}_urls'
    settings.WSGI_APPLICATION = 'services.wsgi.application'
    settings.MALWA_SERVICE_NAME = service_name


def write_slice_urlmodules() -> None:
    """Generate services/slices/<name>_urls.py for every registered service."""
    from malwa_shared.service_registry import SERVICES

    slices = Path(__file__).resolve().parent / 'slices'
    slices.mkdir(parents=True, exist_ok=True)
    (slices / '__init__.py').write_text('"""Auto-generated URLConf slices per microservice."""\n', encoding='utf-8')

    for name, spec in SERVICES.items():
        lines = [
            '"""URLConf slice for service: %s."""' % name,
            'from django.urls import path, include',
            'from malwa_solar.health import health, ready',
            '',
            'urlpatterns = [',
            "    path('api/v1/health/', health),",
            "    path('api/v1/ready/', ready),",
            "    path('api/v1/', include([",
        ]
        for prefix, module in spec['url_includes']:
            lines.append(f"        path('{prefix}', include('{module}')),")
        lines += [
            '    ])),',
            ']',
            '',
        ]
        (slices / f'{name}_urls.py').write_text('\n'.join(lines), encoding='utf-8')
