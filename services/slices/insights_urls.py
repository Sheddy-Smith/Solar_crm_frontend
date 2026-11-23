"""URLConf slice for service: insights."""
from django.urls import path, include
from malwa_solar.health import health, ready

urlpatterns = [
    path('api/v1/health/', health),
    path('api/v1/ready/', ready),
    path('api/v1/', include([
        path('dashboard/', include('apps.dashboard.urls')),
    ])),
]
