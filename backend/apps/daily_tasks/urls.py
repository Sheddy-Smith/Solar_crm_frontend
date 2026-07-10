from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DailyTaskViewSet

router = DefaultRouter()
router.register('tasks', DailyTaskViewSet, basename='daily-task')

urlpatterns = [
    path('', include(router.urls)),
]
