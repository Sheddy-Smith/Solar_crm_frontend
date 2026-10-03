from django.contrib import admin
from .models import (
    OmAsset, OmMaintenanceTask, OmBreakdownTicket,
    OmSiteVisit, OmSparePart, OmReport, OmDocument,
    OmPlant, OmVisitPart, OmInsurance,
)

admin.site.register(OmAsset)
admin.site.register(OmMaintenanceTask)
admin.site.register(OmBreakdownTicket)
admin.site.register(OmSiteVisit)
admin.site.register(OmSparePart)
admin.site.register(OmReport)
admin.site.register(OmDocument)
admin.site.register(OmVisitPart)
admin.site.register(OmInsurance)


@admin.register(OmPlant)
class OmPlantAdmin(admin.ModelAdmin):
    list_display = ('plant_code', 'plant_name', 'customer_name', 'capacity_kw', 'commissioning_date', 'free_service_end', 'om_status')
    list_filter = ('om_status', 'system_type', 'is_active')
    search_fields = ('plant_name', 'customer_name', 'mobile_number', 'project__project_id', 'inverter_serial')
