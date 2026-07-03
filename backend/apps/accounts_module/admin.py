from django.contrib import admin
from .models import ChartOfAccount, Account, BankAccount, Payment, Cheque, Transaction

admin.site.register(ChartOfAccount)
admin.site.register(Account)
admin.site.register(BankAccount)
admin.site.register(Payment)
admin.site.register(Cheque)
admin.site.register(Transaction)
