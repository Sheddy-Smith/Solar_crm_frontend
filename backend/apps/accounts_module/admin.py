from django.contrib import admin
from .models import (
    ChartOfAccount, Account, BankAccount, Payment, Cheque, Transaction,
    PurchaseInvoice, PurchaseInvoiceLine, PurchaseInvoiceExtraCharge,
    SellInvoice, SellInvoiceLine,
    PaymentVoucher,
    PurchaseChallan, PurchaseChallanLine,
    SellChallan, SellChallanLine,
    GstOpeningBalance,
)

admin.site.register(ChartOfAccount)
admin.site.register(Account)
admin.site.register(BankAccount)
admin.site.register(Payment)
admin.site.register(Cheque)
admin.site.register(Transaction)


class PurchaseInvoiceLineInline(admin.TabularInline):
    model = PurchaseInvoiceLine
    extra = 0


class PurchaseInvoiceExtraChargeInline(admin.TabularInline):
    model = PurchaseInvoiceExtraCharge
    extra = 0


@admin.register(PurchaseInvoice)
class PurchaseInvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_no', 'invoice_date', 'supplier_name', 'status', 'total_amount', 'balance_due', 'created_at']
    list_filter = ['status', 'gst_type', 'payment_mode']
    search_fields = ['invoice_no', 'supplier_name', 'category', 'remarks']
    inlines = [PurchaseInvoiceLineInline, PurchaseInvoiceExtraChargeInline]


class SellInvoiceLineInline(admin.TabularInline):
    model = SellInvoiceLine
    extra = 0


@admin.register(SellInvoice)
class SellInvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_no', 'invoice_date', 'party_name', 'status', 'total_amount', 'balance_due', 'created_at']
    list_filter = ['status', 'gst_type', 'payment_mode']
    search_fields = ['invoice_no', 'party_name', 'gst_number', 'branch', 'remarks']
    inlines = [SellInvoiceLineInline]


@admin.register(PaymentVoucher)
class PaymentVoucherAdmin(admin.ModelAdmin):
    list_display = ['voucher_no', 'voucher_date', 'entry_type', 'payee_type', 'payee_name', 'amount', 'status']
    list_filter = ['entry_type', 'payee_type', 'status', 'payment_mode']
    search_fields = ['voucher_no', 'payee_name', 'category', 'particulars']


class PurchaseChallanLineInline(admin.TabularInline):
    model = PurchaseChallanLine
    extra = 0


@admin.register(PurchaseChallan)
class PurchaseChallanAdmin(admin.ModelAdmin):
    list_display = ['challan_no', 'challan_date', 'supplier_name', 'status', 'total_amount', 'balance_due']
    list_filter = ['status']
    search_fields = ['challan_no', 'supplier_name', 'vehicle_no', 'remarks']
    inlines = [PurchaseChallanLineInline]


class SellChallanLineInline(admin.TabularInline):
    model = SellChallanLine
    extra = 0


@admin.register(SellChallan)
class SellChallanAdmin(admin.ModelAdmin):
    list_display = ['challan_no', 'challan_date', 'party_name', 'status', 'total_amount']
    list_filter = ['status']
    search_fields = ['challan_no', 'party_name', 'vehicle_no', 'site_address', 'remarks']
    inlines = [SellChallanLineInline]


@admin.register(GstOpeningBalance)
class GstOpeningBalanceAdmin(admin.ModelAdmin):
    list_display = ['month', 'igst_opening', 'cgst_opening', 'sgst_opening', 'updated_at']
    search_fields = ['notes']
