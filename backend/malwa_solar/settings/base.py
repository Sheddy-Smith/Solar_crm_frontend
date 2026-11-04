from pathlib import Path
from datetime import timedelta
import environ

env = environ.Env()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('SECRET_KEY')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    # Local apps
    'apps.accounts',
    'apps.leads',
    'apps.projects',
    'apps.inventory',
    'apps.accounts_module',
    'apps.workforce',
    'apps.liaisoning',
    'apps.om',
    'apps.amc',
    'apps.reports',
    'apps.dashboard.apps.DashboardConfig',
    'apps.crm_settings',
    'apps.daily_tasks',
    'apps.notifications',
]

MIDDLEWARE = [
    # First so it compresses every response below it. Large JSON list
    # responses shrink ~80%. Django >= 4.2 mitigates BREACH by injecting
    # random bytes into the gzip stream, and responses that already carry a
    # Content-Encoding (e.g. WhiteNoise's pre-compressed static files) are
    # skipped automatically.
    'django.middleware.gzip.GZipMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'malwa_solar.security_headers_middleware.SecurityHeadersMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    # Enforces crm_settings IpAccessRule allow/block rules (BUG-015). Placed
    # after CorsMiddleware so even a blocked response carries correct CORS
    # headers; placed before SessionMiddleware so it needs nothing from the
    # session/auth stack. Fails open on internal errors — see the module
    # docstring in ip_access_middleware.py.
    'malwa_solar.ip_access_middleware.IpAccessMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # Optional request timing (OBSERVABILITY_REQUEST_LOG=1). No PII in logs.
    'malwa_solar.middleware_observability.RequestTimingMiddleware',
]

ROOT_URLCONF = 'malwa_solar.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'malwa_solar.wsgi.application'
ASGI_APPLICATION = 'malwa_solar.asgi.application'

AUTH_USER_MODEL = 'accounts.User'

DATABASES = {
    'default': env.db('DATABASE_URL')
}
# Persistent DB connections — without this every request pays a fresh TCP+TLS
# handshake to the remote Postgres (Neon), which dominates API latency.
# Health checks make Django transparently replace a connection the server
# dropped, so a pooled-but-dead connection can never surface as a 500.
# Postgres only: holding SQLite connections open across requests invites
# "database is locked" errors in threaded local dev.
if 'postgresql' in DATABASES['default']['ENGINE'] or 'mysql' in DATABASES['default']['ENGINE']:
    DATABASES['default']['CONN_MAX_AGE'] = env.int('DB_CONN_MAX_AGE', default=60)
    DATABASES['default']['CONN_HEALTH_CHECKS'] = True
# PyMySQL as MySQLdb drop-in when DATABASE_URL uses mysql://
if 'mysql' in DATABASES['default']['ENGINE']:
    import pymysql
    pymysql.install_as_MySQLdb()
    DATABASES['default'].setdefault('OPTIONS', {})
    DATABASES['default']['OPTIONS'].setdefault('charset', 'utf8mb4')
    # Bound hung remote-MySQL workers (Hostinger latency / packet loss).
    DATABASES['default']['OPTIONS'].setdefault(
        'connect_timeout', env.int('DB_CONNECT_TIMEOUT', default=10),
    )
    DATABASES['default']['OPTIONS'].setdefault(
        'read_timeout', env.int('DB_READ_TIMEOUT', default=30),
    )
    DATABASES['default']['OPTIONS'].setdefault(
        'write_timeout', env.int('DB_WRITE_TIMEOUT', default=30),
    )

_redis_url = (env('REDIS_URL', default='') or '').strip()
_redis_disabled = _redis_url.lower() in ('', 'none', 'disabled', 'off', 'false', '0')

if _redis_disabled:
    # Single-instance / no-Redis mode: LocMem is fine (not multi-API-safe).
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'malwa-default',
        },
        'throttling': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'drf-throttling',
        },
    }
    CELERY_BROKER_URL = 'memory://'
    CELERY_RESULT_BACKEND = 'cache+memory://'
    CELERY_TASK_ALWAYS_EAGER = True
else:
    _redis_options = {
        'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        # Cache/throttle must never 500 the API if Redis blips.
        'IGNORE_EXCEPTIONS': True,
    }
    if _redis_url.startswith('rediss://'):
        _redis_options['CONNECTION_POOL_KWARGS'] = {'ssl_cert_reqs': None}

    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': _redis_url,
            'OPTIONS': _redis_options,
        },
        # Shared across Gunicorn workers / API instances for correct rate limits.
        # Safe* throttles still fail-open if Redis errors (see throttling.py).
        'throttling': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': _redis_url,
            'KEY_PREFIX': 'throttle',
            'OPTIONS': _redis_options,
        },
    }
    CELERY_BROKER_URL = _redis_url
    CELERY_RESULT_BACKEND = _redis_url
    CELERY_TASK_ALWAYS_EAGER = env.bool('CELERY_TASK_ALWAYS_EAGER', default=False)

DJANGO_REDIS_IGNORE_EXCEPTIONS = True
DJANGO_REDIS_LOG_IGNORED_EXCEPTIONS = True

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Cap in-memory upload buffering (BUG-048) — aligns with malwa_solar.validators.MAX_UPLOAD_SIZE_BYTES.
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'malwa_solar.pagination.DefaultPagination',
    'PAGE_SIZE': 100,
    'EXCEPTION_HANDLER': 'malwa_solar.exceptions.custom_exception_handler',
    # Safe variants: LocMem-backed + fail-open (see malwa_solar/throttling.py).
    # The stock DRF classes hit the shared Redis on every request and 500'd
    # the entire API when a cache error wasn't an ignored connection error.
    'DEFAULT_THROTTLE_CLASSES': [
        'malwa_solar.throttling.SafeAnonRateThrottle',
        'malwa_solar.throttling.SafeUserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # Env-overridable so infra size can change without code edits.
        'login': env('THROTTLE_LOGIN', default='40/min'),
        # Baseline rate limit for every endpoint (BUG-051).
        'anon': env('THROTTLE_ANON', default='200/min'),
        # Shared across every device of the same account.
        'user': env('THROTTLE_USER', default='750/min'),
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    'http://localhost:5173',
    'http://localhost:3000',
])
CORS_ALLOW_CREDENTIALS = True

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='Malwa Solar CRM <noreply@malwasolar.com>')

CELERY_TIMEZONE = 'Asia/Kolkata'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_SOFT_TIME_LIMIT = env.int('CELERY_TASK_SOFT_TIME_LIMIT', default=120)
CELERY_TASK_TIME_LIMIT = env.int('CELERY_TASK_TIME_LIMIT', default=180)
# When Redis blips, prefer failing the task over hanging the worker forever.
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BROKER_TRANSPORT_OPTIONS = {
    'visibility_timeout': env.int('CELERY_VISIBILITY_TIMEOUT', default=3600),
    'socket_connect_timeout': env.int('CELERY_BROKER_CONNECT_TIMEOUT', default=5),
    'socket_timeout': env.int('CELERY_BROKER_SOCKET_TIMEOUT', default=15),
}
# Large exports/imports must not run inline on API workers unless explicitly allowed.
ALLOW_EAGER_EXPORTS = env.bool('ALLOW_EAGER_EXPORTS', default=False)
