"""Isolated LOCAL MySQL staging — never production Hostinger.

Requires STAGING_DATABASE_URL pointing at a dedicated local DB
(e.g. mysql://malwa_staging:***@127.0.0.1:3306/malwa_crm_staging).
Refuses remote / Hostinger / poer hostnames.
"""
from .staging_local import *  # noqa: F403
import os
from urllib.parse import urlparse

_url = (os.environ.get('STAGING_DATABASE_URL') or '').strip()
if not _url:
    raise RuntimeError(
        'staging_mysql requires STAGING_DATABASE_URL '
        '(mysql://malwa_staging:***@127.0.0.1:3306/malwa_crm_staging)'
    )

_host = (urlparse(_url).hostname or '').lower()
_blocked = ('hstgr', 'hostinger', 'poer.in', 'ecomalwa', 'neon.tech', 'amazonaws')
if any(b in _host for b in _blocked) or _host not in ('127.0.0.1', 'localhost', '::1'):
    raise RuntimeError(f'staging_mysql refuses non-local DB host: {_host!r}')

DATABASES = {'default': env.db('STAGING_DATABASE_URL')}  # noqa: F405

import pymysql
pymysql.install_as_MySQLdb()
DATABASES['default'].setdefault('OPTIONS', {})
DATABASES['default']['OPTIONS'].setdefault('charset', 'utf8mb4')
DATABASES['default']['OPTIONS'].setdefault('connect_timeout', 10)
DATABASES['default']['OPTIONS'].setdefault('read_timeout', 30)
DATABASES['default']['OPTIONS'].setdefault('write_timeout', 30)
DATABASES['default']['CONN_MAX_AGE'] = int(os.environ.get('DB_CONN_MAX_AGE', '60'))
DATABASES['default']['CONN_HEALTH_CHECKS'] = True

CELERY_TASK_ALWAYS_EAGER = env.bool('CELERY_TASK_ALWAYS_EAGER', default=False)  # noqa: F405
