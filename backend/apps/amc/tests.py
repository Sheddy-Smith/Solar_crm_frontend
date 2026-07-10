from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.amc.models import AmcContract, AmcRenewal


class AmcRenewalCompleteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user(
            'amc@test.com',
            'AMC Editor',
            {'AMC & Warranty': {'can_view': True, 'can_edit': True}},
        )
        self.client.force_authenticate(self.user)
        self.contract = AmcContract.objects.create(
            customer_name='Acme Solar',
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
            status='Expired',
        )
        self.renewal = AmcRenewal.objects.create(
            contract=self.contract,
            new_end_date=date(2026, 12, 31),
            amount=50000,
            status='Pending',
            created_by=self.user,
        )

    def test_complete_renewal_updates_parent_contract(self):
        res = self.client.post(f'/api/v1/amc/renewals/{self.renewal.id}/complete/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'Completed')

        self.contract.refresh_from_db()
        self.renewal.refresh_from_db()
        self.assertEqual(self.renewal.status, 'Completed')
        self.assertEqual(self.contract.end_date, date(2026, 12, 31))
        self.assertEqual(self.contract.next_renewal_date, date(2026, 12, 31))
        self.assertEqual(self.contract.status, 'Active')

    def test_complete_renewal_rejects_missing_new_end_date(self):
        renewal = AmcRenewal.objects.create(
            contract=self.contract,
            status='Pending',
            created_by=self.user,
        )
        res = self.client.post(f'/api/v1/amc/renewals/{renewal.id}/complete/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('new_end_date', res.data['detail'])

    def test_complete_renewal_is_idempotent_guard(self):
        self.client.post(f'/api/v1/amc/renewals/{self.renewal.id}/complete/')
        res = self.client.post(f'/api/v1/amc/renewals/{self.renewal.id}/complete/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('already been completed', res.data['detail'])
