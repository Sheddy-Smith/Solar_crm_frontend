"""Isolated LOCAL staging — never point this at production Hostinger MySQL.

Uses a dedicated SQLite file + Redis (fakeredis TCP or real redis://127.0.0.1:6379).
No production credentials. Safe for Locust / crash testing.
"""
from .base import *  # noqa: F403
import sys
from pathlib import Path

DEBUG = True
ALLOWED_HOSTS = ['*']
CORS_ALLOW_ALL_ORIGINS = True

SECRET_KEY = env('SECRET_KEY', default='staging-local-only-not-for-production-use-32b')  # noqa: F405

# Dedicated anonymized DB file (never production).
_staging_db = Path(BASE_DIR) / 'staging_local.sqlite3'  # noqa: F405
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': str(_staging_db),
        'OPTIONS': {
            'timeout': 30,
        },
    }
}

# Redis required for staging cache + shared throttle counters across threads.
REDIS_URL = env('REDIS_URL', default='redis://127.0.0.1:6379/1')  # noqa: F405
_redis_url = (REDIS_URL or '').strip()
_redis_disabled = _redis_url.lower() in ('', 'none', 'disabled', 'off', 'false', '0')
if _redis_disabled:
    raise RuntimeError('staging_local requires REDIS_URL (e.g. redis://127.0.0.1:6379/1)')

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': _redis_url,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'IGNORE_EXCEPTIONS': True,
        },
    },
    # Shared across Waitress/gthread workers so Locust sees real throttle behavior.
    'throttling': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': _redis_url,
        'KEY_PREFIX': 'throttle',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'IGNORE_EXCEPTIONS': True,
        },
    },
}
CELERY_BROKER_URL = _redis_url
CELERY_RESULT_BACKEND = _redis_url

# Staging Locust needs headroom; login still capped to limit brute-force simulation.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    'DEFAULT_THROTTLE_RATES': {
        # Locust ramps spawn many logins in seconds; keep brute-force protection
        # but allow staged capacity tests (override via env for stricter runs).
        'login': env('STAGING_LOGIN_THROTTLE', default='2000/min'),  # noqa: F405
        'anon': env('STAGING_ANON_THROTTLE', default='5000/min'),  # noqa: F405
        'user': env('STAGING_USER_THROTTLE', default='5000/min'),  # noqa: F405
    },
}

# SQLite + threads: keep short-lived connections.
DATABASES['default']['CONN_MAX_AGE'] = 0

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
# Local/staging may run Celery eager — allow small export smoke tests.
ALLOW_EAGER_EXPORTS = env.bool('ALLOW_EAGER_EXPORTS', default=True)  # noqa: F405

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'WARNING'},
    'loggers': {
        'django.request': {'handlers': ['console'], 'level': 'ERROR', 'propagate': False},
    },
}

# `manage.py test` still gets a throwaway DB name if invoked under this module.
if 'test' in sys.argv:
    DATABASES['default']['NAME'] = str(Path(BASE_DIR) / 'staging_local_test.sqlite3')  # noqa: F405
