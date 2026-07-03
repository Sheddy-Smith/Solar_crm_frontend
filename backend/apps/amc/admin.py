from django.contrib import admin

from .models import (
    AmcClaim, AmcContract, AmcDocument, AmcRenewal,
    AmcServiceRequest, AmcVisit, AmcWarranty,
)

admin.site.register(AmcContract)
admin.site.register(AmcWarranty)
admin.site.register(AmcServiceRequest)
admin.site.register(AmcVisit)
admin.site.register(AmcRenewal)
admin.site.register(AmcClaim)
admin.site.register(AmcDocument)
