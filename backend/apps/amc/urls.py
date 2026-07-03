from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AmcClaimViewSet, AmcContractViewSet, AmcDocumentViewSet, AmcRenewalViewSet,
    AmcServiceRequestViewSet, AmcVisitViewSet, AmcWarrantyViewSet,
)

router = DefaultRouter()
router.register('contracts', AmcContractViewSet, basename='amc-contract')
router.register('warranties', AmcWarrantyViewSet, basename='amc-warranty')
router.register('service-requests', AmcServiceRequestViewSet, basename='amc-service-request')
router.register('visits', AmcVisitViewSet, basename='amc-visit')
router.register('renewals', AmcRenewalViewSet, basename='amc-renewal')
router.register('claims', AmcClaimViewSet, basename='amc-claim')
router.register('documents', AmcDocumentViewSet, basename='amc-document')

urlpatterns = [
    path('', include(router.urls)),
]
