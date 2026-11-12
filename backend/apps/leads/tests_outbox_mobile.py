"""Quotation outbox concurrency + normalized mobile persistence tests."""
from decimal import Decimal

from django.db import transaction
from django.test import TestCase, TransactionTestCase

from apps.accounts.models import Role, User
from apps.leads.models import Lead, Quotation, QuotationDownstreamSync, QuotationItem
from apps.leads.quotation_sync import (
    claim_quotation_outbox,
    ensure_quotation_outbox_pending,
    run_quotation_downstream_sync,
)


def _user(email):
    role, _ = Role.objects.get_or_create(name='Super Admin')
    user = User.objects.create_user(email=email, password='testpass1234', name=email.split('@')[0])
    user.role = role
    user.is_superuser = True
    user.save()
    return user


class NormalizedMobileTests(TestCase):
    def test_save_and_update_fields_keeps_normalized_in_sync(self):
        user = _user('norm@test.com')
        lead = Lead.objects.create(
            customer_name='Norm',
            mobile_number='+91 98765 43210',
            created_by=user,
        )
        self.assertEqual(lead.normalized_mobile, '9876543210')
        lead.mobile_number = '09876543211'
        lead.save(update_fields=['mobile_number'])
        lead.refresh_from_db()
        self.assertEqual(lead.normalized_mobile, '9876543211')


class QuotationOutboxTests(TransactionTestCase):
    def test_outbox_pending_created_in_transaction_and_claim_exclusive(self):
        user = _user('outbox@test.com')
        lead = Lead.objects.create(customer_name='Q', mobile_number='9000000001', created_by=user)
        with transaction.atomic():
            quotation = Quotation.objects.create(
                lead=lead,
                status='Sent',
                created_by=user,
                customer_contribution=Decimal('1000.00'),
                grand_total=Decimal('1000.00'),
            )
            QuotationItem.objects.create(
                quotation=quotation,
                item_name='Panel',
                quantity='1',
                rate=Decimal('1000.00'),
                amount=Decimal('1000.00'),
            )
            quotation.recalculate_totals()
            ensure_quotation_outbox_pending(quotation, user=user)
        sync = QuotationDownstreamSync.objects.get(quotation=quotation)
        self.assertEqual(sync.status, QuotationDownstreamSync.STATUS_PENDING)

        claimed = claim_quotation_outbox(quotation.pk)
        self.assertIsNotNone(claimed)
        self.assertEqual(claimed.status, QuotationDownstreamSync.STATUS_PROCESSING)
        # Second worker cannot claim while locked.
        self.assertIsNone(claim_quotation_outbox(quotation.pk))

    def test_run_marks_success_idempotent(self):
        user = _user('outbox2@test.com')
        lead = Lead.objects.create(customer_name='Q2', mobile_number='9000000002', created_by=user)
        quotation = Quotation.objects.create(
            lead=lead,
            status='Sent',
            created_by=user,
            customer_contribution=Decimal('500.00'),
            grand_total=Decimal('500.00'),
        )
        QuotationItem.objects.create(
            quotation=quotation,
            item_name='Inverter',
            quantity='1',
            rate=Decimal('500.00'),
            amount=Decimal('500.00'),
        )
        quotation.recalculate_totals()
        ensure_quotation_outbox_pending(quotation, user=user)
        first = run_quotation_downstream_sync(quotation.pk, user_id=user.pk)
        self.assertTrue(first.get('ok'))
        sync = QuotationDownstreamSync.objects.get(quotation=quotation)
        self.assertEqual(sync.status, QuotationDownstreamSync.STATUS_SUCCESS)
        second = run_quotation_downstream_sync(quotation.pk, user_id=user.pk)
        self.assertTrue(second.get('ok'))
