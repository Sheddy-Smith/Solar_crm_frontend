# Gunicorn manages processes; each worker runs Uvicorn serving malwa_solar.asgi.
# Gunicorn auto-loads this file from the working directory; CLI flags override it.
import os

wsgi_app = 'malwa_solar.asgi:application'
worker_class = 'malwa_solar.uvicorn_worker.DjangoUvicornWorker'

bind = os.environ.get('GUNICORN_BIND') or f"0.0.0.0:{os.environ.get('PORT', '8000')}"
workers = int(os.environ.get('WEB_CONCURRENCY', '2'))

timeout = int(os.environ.get('GUNICORN_TIMEOUT', '120'))
graceful_timeout = int(os.environ.get('GUNICORN_GRACEFUL_TIMEOUT', '30'))
# Longer than the reverse proxy's idle upstream timeout (Caddy: 2m) so the
# proxy never reuses a connection Uvicorn has just closed.
keepalive = int(os.environ.get('GUNICORN_KEEPALIVE', '125'))

# Recycle workers periodically to cap slow memory growth; jitter avoids all
# workers restarting at once.
max_requests = int(os.environ.get('GUNICORN_MAX_REQUESTS', '1000'))
max_requests_jitter = int(os.environ.get('GUNICORN_MAX_REQUESTS_JITTER', '100'))

# Fork before Django loads so no DB connection/socket is shared across workers.
preload_app = False

forwarded_allow_ips = os.environ.get('FORWARDED_ALLOW_IPS', '127.0.0.1,::1')

if os.path.isdir('/dev/shm'):
    worker_tmp_dir = '/dev/shm'

errorlog = '-'
loglevel = os.environ.get('GUNICORN_LOG_LEVEL', 'info')
accesslog = os.environ.get('GUNICORN_ACCESS_LOG') or None
