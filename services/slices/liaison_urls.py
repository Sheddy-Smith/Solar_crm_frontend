"""URLConf slice for service: liaison."""
from django.urls import path, include
from malwa_solar.health import health, ready

urlpatterns = [
    path('api/v1/health/', health),
    path('api/v1/ready/', ready),
    path('api/v1/', include([
        path('liaison/', include('apps.liaisoning.urls')),
    ])),
]
