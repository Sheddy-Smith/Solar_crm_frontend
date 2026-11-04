"""Optional Celery app — only used when REDIS_URL is set and a worker is started.

When Redis is disabled, CELERY_TASK_ALWAYS_EAGER=True so calling .delay()
still runs inline (no hard dependency on a broker for single-instance deploys).
"""
import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.production')

app = Celery('malwa_solar')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
