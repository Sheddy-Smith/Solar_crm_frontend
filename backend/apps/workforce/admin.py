from django.contrib import admin

from .models import (
    Employee, EmployeeAssignment, EmployeeDocument,
    EmployeeAttendance, EmployeeVoucher, EmployeeIdCounter,
)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'name', 'department', 'role', 'status', 'daily_rate')
    search_fields = ('employee_id', 'name', 'mobile', 'aadhaar_number')
    list_filter = ('status', 'department')


@admin.register(EmployeeAssignment)
class EmployeeAssignmentAdmin(admin.ModelAdmin):
    list_display = ('employee', 'task_name', 'project', 'status', 'priority', 'assigned_date')
    list_filter = ('status', 'priority')


@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(admin.ModelAdmin):
    list_display = ('employee', 'name', 'doc_type', 'uploaded_at')
    list_filter = ('doc_type',)


@admin.register(EmployeeAttendance)
class EmployeeAttendanceAdmin(admin.ModelAdmin):
    list_display = ('employee', 'date', 'status', 'hours', 'payment', 'voucher_amount')
    list_filter = ('status', 'date')
    search_fields = ('employee__name', 'employee__employee_id')


@admin.register(EmployeeVoucher)
class EmployeeVoucherAdmin(admin.ModelAdmin):
    list_display = ('employee', 'voucher_date', 'amount', 'payment_mode')
    list_filter = ('payment_mode', 'voucher_date')
    search_fields = ('employee__name', 'employee__employee_id')


admin.site.register(EmployeeIdCounter)
