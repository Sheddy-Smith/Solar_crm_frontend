"""URLConf slice for service: tasks."""
from django.urls import path, include
from malwa_solar.health import health, ready

urlpatterns = [
    path('api/v1/health/', health),
    path('api/v1/ready/', ready),
    path('api/v1/', include([
        path('daily-tasks/', include('apps.daily_tasks.urls')),
    ])),
]
