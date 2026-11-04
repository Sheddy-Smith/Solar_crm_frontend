# Optional Celery app import so `shared_task` binds when a worker starts.
try:
    from .celery import app as celery_app
except Exception:  # pragma: no cover — celery optional at import in some tooling
    celery_app = None

__all__ = ('celery_app',)
