from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeadViewSet, FollowUpViewSet, AdminApprovalViewSet, QuotationViewSet

router = DefaultRouter()
router.register('leads', LeadViewSet, basename='lead')
router.register('follow-ups', FollowUpViewSet)
router.register('admin-approvals', AdminApprovalViewSet)
router.register('quotations', QuotationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
