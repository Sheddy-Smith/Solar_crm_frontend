from django.contrib import admin
from .models import (
    OmAsset, OmMaintenanceTask, OmBreakdownTicket,
    OmSiteVisit, OmSparePart, OmReport, OmDocument,
)

admin.site.register(OmAsset)
admin.site.register(OmMaintenanceTask)
admin.site.register(OmBreakdownTicket)
admin.site.register(OmSiteVisit)
admin.site.register(OmSparePart)
admin.site.register(OmReport)
admin.site.register(OmDocument)
