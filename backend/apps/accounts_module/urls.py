from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ChartOfAccountViewSet, AccountViewSet, BankAccountViewSet,
    PaymentViewSet, ChequeViewSet, TransactionViewSet,
)
from .document_views import (
    PurchaseInvoiceViewSet, SellInvoiceViewSet, PaymentVoucherViewSet,
    PurchaseChallanViewSet, SellChallanViewSet, GstOpeningBalanceViewSet,
)

router = DefaultRouter()
router.register('chart-of-accounts', ChartOfAccountViewSet, basename='chart-of-account')
router.register('parties', AccountViewSet, basename='account-party')
router.register('bank-accounts', BankAccountViewSet, basename='bank-account')
router.register('payments', PaymentViewSet, basename='payment')
router.register('cheques', ChequeViewSet, basename='cheque')
router.register('transactions', TransactionViewSet, basename='transaction')
router.register('purchase-invoices', PurchaseInvoiceViewSet, basename='purchase-invoice')
router.register('sell-invoices', SellInvoiceViewSet, basename='sell-invoice')
router.register('vouchers', PaymentVoucherViewSet, basename='payment-voucher')
router.register('purchase-challans', PurchaseChallanViewSet, basename='purchase-challan')
router.register('sell-challans', SellChallanViewSet, basename='sell-challan')
router.register('gst-opening', GstOpeningBalanceViewSet, basename='gst-opening')

urlpatterns = [path('', include(router.urls))]
