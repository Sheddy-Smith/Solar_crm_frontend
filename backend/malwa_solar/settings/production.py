from .base import *

DEBUG = False

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'

# Koyeb terminates TLS at its edge and forwards plain HTTP with this header;
# without it, SECURE_SSL_REDIRECT causes an infinite redirect loop.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=[])

# JSON-only API — DRF's browsable HTML renderer needs rest_framework static CSS;
# with ManifestStaticFilesStorage that causes 500 on GET /api/v1/ in production.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

# Avoid strict manifest lookups that 500 when optional app assets are absent.
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        # Console only — Koyeb's filesystem is ephemeral (wiped on every
        # redeploy/restart) and captures stdout/stderr as platform logs anyway,
        # so a file handler here would both crash on a missing `logs/` dir and
        # provide no durability benefit.
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': True,
        },
    },
}
