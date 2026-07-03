from django.contrib import admin
from .models import (
    LiaisonApplication, LiaisonApproval, LiaisonInspection,
    LiaisonCommissioning, LiaisonCompliance, LiaisonDocument,
)

admin.site.register(LiaisonApplication)
admin.site.register(LiaisonApproval)
admin.site.register(LiaisonInspection)
admin.site.register(LiaisonCommissioning)
admin.site.register(LiaisonCompliance)
admin.site.register(LiaisonDocument)
