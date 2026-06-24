from django.contrib import admin
from .models import ChartOfAccount, Transaction
admin.site.register([ChartOfAccount, Transaction])
