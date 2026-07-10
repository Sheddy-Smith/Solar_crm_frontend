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
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# BUG-022: strict CSP + related headers on API/static responses. The SPA is
# served separately (Vite build); these headers still harden the Django admin
# and JSON API surface against XSS while JWT remains in localStorage.
SECURITY_EXTRA_HEADERS = {
    'Content-Security-Policy': (
        "default-src 'self'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self'; "
        "connect-src 'self'"
    ),
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Content-Type-Options': 'nosniff',
}

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

# Optional S3-backed media storage (BUG-021) — when AWS_STORAGE_BUCKET_NAME is set,
# uploads survive ephemeral container filesystems on Render/Koyeb.
_aws_bucket = env('AWS_STORAGE_BUCKET_NAME', default='')
if _aws_bucket:
    INSTALLED_APPS += ['storages']
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_ACCESS_KEY_ID = env('AWS_ACCESS_KEY_ID', default='')
    AWS_SECRET_ACCESS_KEY = env('AWS_SECRET_ACCESS_KEY', default='')
    AWS_STORAGE_BUCKET_NAME = _aws_bucket
    AWS_S3_REGION_NAME = env('AWS_S3_REGION_NAME', default='ap-south-1')
    AWS_S3_CUSTOM_DOMAIN = env('AWS_S3_CUSTOM_DOMAIN', default='')
    AWS_DEFAULT_ACL = env('AWS_DEFAULT_ACL', default='private')
    AWS_QUERYSTRING_AUTH = env.bool('AWS_QUERYSTRING_AUTH', default=True)
    AWS_S3_FILE_OVERWRITE = False
    if AWS_S3_CUSTOM_DOMAIN:
        MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'
    else:
        MEDIA_URL = f'https://{_aws_bucket}.s3.{AWS_S3_REGION_NAME}.amazonaws.com/'

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
