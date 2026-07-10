from django.urls import path

from .views import UnifiedDashboardView

urlpatterns = [
    path('unified/', UnifiedDashboardView.as_view(), name='dashboard-unified'),
]
