from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChartOfAccountViewSet, TransactionViewSet

router = DefaultRouter()
router.register('chart-of-accounts', ChartOfAccountViewSet, basename='chart-of-account')
router.register('transactions', TransactionViewSet, basename='transaction')

urlpatterns = [path('', include(router.urls))]
