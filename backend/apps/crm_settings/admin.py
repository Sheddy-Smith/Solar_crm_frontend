from django.contrib import admin

from .models import (
    AppSetting,
    CompanyProfile,
    DocumentNumberSeries,
    FinancialYear,
    IpAccessRule,
    IpBlockedAttempt,
    MasterRecord,
    PaymentMode,
    SystemBackupLog,
    UserActivityLog,
)

admin.site.register(CompanyProfile)
admin.site.register(AppSetting)
admin.site.register(PaymentMode)
admin.site.register(MasterRecord)
admin.site.register(FinancialYear)
admin.site.register(UserActivityLog)
admin.site.register(IpAccessRule)
admin.site.register(IpBlockedAttempt)
admin.site.register(DocumentNumberSeries)
admin.site.register(SystemBackupLog)
