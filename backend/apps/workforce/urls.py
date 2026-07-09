from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EmployeeViewSet, EmployeeAssignmentViewSet, EmployeeDocumentViewSet,
    EmployeeAttendanceViewSet, EmployeeVoucherViewSet,
)

router = DefaultRouter()
router.register('employees', EmployeeViewSet, basename='employee')
router.register('assignments', EmployeeAssignmentViewSet, basename='employee-assignment')
router.register('documents', EmployeeDocumentViewSet, basename='employee-document')
router.register('attendance', EmployeeAttendanceViewSet, basename='employee-attendance')
router.register('vouchers', EmployeeVoucherViewSet, basename='employee-voucher')

urlpatterns = [
    path('', include(router.urls)),
]
