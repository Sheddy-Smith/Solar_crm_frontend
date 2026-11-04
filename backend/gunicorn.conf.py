# Sync WSGI workers so Django CONN_MAX_AGE actually reuses MySQL connections.
# ASGI/UvicornWorker runs ORM work in short-lived threads, so persistent
# connections are orphaned and every request opens a new Hostinger MySQL
# connection — that burns max_connections_per_hour (500) and returns HTTP 500.
import os

wsgi_app = 'malwa_solar.wsgi:application'
worker_class = 'sync'

bind = os.environ.get('GUNICORN_BIND') or f"0.0.0.0:{os.environ.get('PORT', '8000')}"
# Conservative defaults for a 1-vCPU box. Scale ONLY via env on larger hosts:
#   1 vCPU / 4GB  → WEB_CONCURRENCY=2–3  GUNICORN_THREADS=2
#   4 vCPU / 8GB  → WEB_CONCURRENCY=5–8  GUNICORN_THREADS=2–3
#   8 vCPU / 16GB → WEB_CONCURRENCY=9–15 GUNICORN_THREADS=2–4
# Never raise workers while remote MySQL has a low max_connections_per_hour.
workers = int(os.environ.get('WEB_CONCURRENCY', '2'))
threads = int(os.environ.get('GUNICORN_THREADS', '2'))

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
