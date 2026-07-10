from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.accounts_module.document_services import gst_ledger_report, month_start
from apps.accounts_module.models import (
    Account,
    GstOpeningBalance,
    PurchaseInvoice,
    SellInvoice,
)


class GstLedgerReportTests(TestCase):
    def setUp(self):
        self.year = 2026
        self.month = 7
        self.period_start = month_start(self.year, self.month)
        GstOpeningBalance.objects.create(
            month=self.period_start,
            igst_opening=Decimal('100.00'),
            cgst_opening=Decimal('50.00'),
            sgst_opening=Decimal('50.00'),
        )
        vendor = Account.objects.create(name='Panel Vendor', account_type='Vendor')
        customer = Account.objects.create(name='Solar Customer', account_type='Customer')
        PurchaseInvoice.objects.create(
            invoice_no='PI-TEST-001',
            invoice_date=date(2026, 7, 5),
            supplier=vendor,
            supplier_name='Panel Vendor',
            gst_type='CGST_SGST',
            subtotal=Decimal('1000.00'),
            cgst_percent=Decimal('9.00'),
            sgst_percent=Decimal('9.00'),
            extra_charges_total=Decimal('0.00'),
            status='Recorded',
        )
        SellInvoice.objects.create(
            invoice_no='SI-TEST-001',
            invoice_date=date(2026, 7, 8),
            party=customer,
            party_name='Solar Customer',
            gst_type='IGST',
            subtotal=Decimal('2000.00'),
            igst_percent=Decimal('18.00'),
            status='Issued',
        )

    def test_gst_ledger_report_totals(self):
        report = gst_ledger_report(self.year, self.month)

        self.assertEqual(report['opening']['igst'], 100.0)
        self.assertEqual(report['input']['cgst'], 90.0)
        self.assertEqual(report['input']['sgst'], 90.0)
        self.assertEqual(report['output']['igst'], 360.0)
        self.assertEqual(report['closing']['igst'], 460.0)
        self.assertEqual(report['closing']['cgst'], -40.0)
        self.assertEqual(report['closing']['sgst'], -40.0)
        self.assertEqual(len(report['entries']), 2)
        self.assertEqual(report['entries'][0]['direction'], 'input')
        self.assertEqual(report['entries'][1]['direction'], 'output')

    def test_gst_ledger_api_endpoint(self):
        client = APIClient()
        user = make_user(
            'acct@test.com',
            'Accounts Viewer',
            {'Accounts': {'can_view': True}},
        )
        client.force_authenticate(user)
        res = client.get('/api/v1/accounts/gst-opening/ledger/', {'year': 2026, 'month': 7})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['output']['igst'], 360.0)
        self.assertEqual(len(res.data['entries']), 2)
