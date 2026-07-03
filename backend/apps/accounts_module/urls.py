from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ChartOfAccountViewSet, AccountViewSet, BankAccountViewSet,
    PaymentViewSet, ChequeViewSet, TransactionViewSet,
)

router = DefaultRouter()
router.register('chart-of-accounts', ChartOfAccountViewSet, basename='chart-of-account')
router.register('parties', AccountViewSet, basename='account-party')
router.register('bank-accounts', BankAccountViewSet, basename='bank-account')
router.register('payments', PaymentViewSet, basename='payment')
router.register('cheques', ChequeViewSet, basename='cheque')
router.register('transactions', TransactionViewSet, basename='transaction')

urlpatterns = [path('', include(router.urls))]
