from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DailyTaskViewSet, StaffDailyTaskViewSet

router = DefaultRouter()
router.register('tasks', DailyTaskViewSet, basename='daily-task')
router.register('assignments', StaffDailyTaskViewSet, basename='staff-daily-task')

urlpatterns = [
    path('', include(router.urls)),
]
