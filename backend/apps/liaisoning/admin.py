from django.contrib import admin
from .models import (
    LiaisonApplication, LiaisonApproval, LiaisonInspection,
    LiaisonCommissioning, LiaisonCompliance, LiaisonDocument,
    LiaisonAgreement, LiaisonNetMeter, LiaisonLoanProcess, LiaisonInspectionPlaced,
    LiaisonProjectStage,
)

admin.site.register(LiaisonApplication)
admin.site.register(LiaisonApproval)
admin.site.register(LiaisonInspection)
admin.site.register(LiaisonCommissioning)
admin.site.register(LiaisonCompliance)
admin.site.register(LiaisonDocument)
admin.site.register(LiaisonLoanProcess)
admin.site.register(LiaisonInspectionPlaced)
admin.site.register(LiaisonAgreement)
admin.site.register(LiaisonNetMeter)
admin.site.register(LiaisonProjectStage)
