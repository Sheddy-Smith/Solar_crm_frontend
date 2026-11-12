"""Customer Master, project-wise ledger, merge and allocation tests."""
from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role, RolePermission, User
from apps.accounts_module.customer_ledger import party_totals, project_ledger_breakdown
from apps.accounts_module.customer_merge import (
    allocate_payment_to_project, detect_duplicate_customers, execute_customer_merge,
    preview_customer_merge, reassign_project_customer,
)
from apps.accounts_module.models import Account, Payment, SellInvoice
from apps.accounts_module.services import find_party_by_phone, normalize_phone
from apps.leads.models import Lead, Quotation
from apps.projects.models import Project


def _superuser():
    role, _ = Role.objects.get_or_create(name='Super Admin', defaults={'is_active': True})
    for module, _label in RolePermission.MODULE_CHOICES:
        RolePermission.objects.get_or_create(role=role, module=module, defaults={
            'can_view': True, 'can_add': True, 'can_edit': True, 'can_delete': True, 'can_export': True,
        })
    user, _ = User.objects.get_or_create(
        email='customer.master@test.local',
        defaults={
            'name': 'Customer Master Admin',
            'role': role,
            'is_active': True,
            'is_superuser': True,
            'is_staff': True,
        },
    )
    if not user.has_usable_password():
        user.set_password('TestPass123!')
        user.save()
    return user


class CustomerMasterTests(TestCase):
    def setUp(self):
        self.user = _superuser()
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_normalize_phone(self):
        self.assertEqual(normalize_phone('+91 98765 43210'), '9876543210')
        self.assertEqual(normalize_phone('09876543210'), '9876543210')

    def test_independent_customer_create(self):
        res = self.client.post('/api/v1/accounts/parties/', {
            'name': 'ABC Solar',
            'account_type': 'Customer',
            'phone': '9876543210',
            'alternate_phone': '9123456780',
            'email': 'abc@example.com',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        party = Account.objects.get(pk=res.data['id'])
        self.assertEqual(party.normalized_phone, '9876543210')
        self.assertEqual(party.alternate_phone, '9123456780')

    def test_duplicate_mobile_blocked_no_auto_merge(self):
        Account.objects.create(name='One', account_type='Customer', phone='9876543211')
        res = self.client.post('/api/v1/accounts/parties/', {
            'name': 'Two', 'account_type': 'Customer', 'phone': '9876543211',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('phone', res.data)
        self.assertEqual(Account.objects.filter(phone='9876543211').count(), 1)

    def test_detect_duplicates_no_merge(self):
        a = Account.objects.create(name='A', account_type='Customer', phone='9000000001')
        b = Account.objects.create(name='B', account_type='Customer', phone='9000000001')
        # Force same normalized phone without hitting create validation path
        Account.objects.filter(pk=b.pk).update(phone='9000000001', normalized_phone='9000000001')
        groups = detect_duplicate_customers()
        self.assertTrue(any(g['normalized_phone'] == '9000000001' for g in groups))
        self.assertEqual(Account.objects.filter(normalized_phone='9000000001').count(), 2)

    def test_multiple_projects_one_customer(self):
        party = Account.objects.create(name='Multi', account_type='Customer', phone='9000000002')
        p1 = Project.objects.create(
            project_name='P1', customer=party, customer_name=party.name, capacity_kwp=5,
        )
        p2 = Project.objects.create(
            project_name='P2', customer=party, customer_name=party.name, capacity_kwp=10,
        )
        self.assertEqual(Project.objects.filter(customer=party).count(), 2)
        self.assertNotEqual(p1.project_id, p2.project_id)

    def test_project_a_payment_does_not_affect_project_b(self):
        party = Account.objects.create(name='Split', account_type='Customer', phone='9000000003')
        pa = Project.objects.create(project_name='A', customer=party, customer_name='Split', capacity_kwp=5)
        pb = Project.objects.create(project_name='B', customer=party, customer_name='Split', capacity_kwp=8)
        SellInvoice.objects.create(
            party=party, project=pa, invoice_no='SI-A', invoice_date=date.today(),
            total_amount=Decimal('500000'), balance_due=Decimal('500000'), status='Issued',
        )
        SellInvoice.objects.create(
            party=party, project=pb, invoice_no='SI-B', invoice_date=date.today(),
            total_amount=Decimal('800000'), balance_due=Decimal('800000'), status='Issued',
        )
        Payment.objects.create(
            direction='Received', payment_date=date.today(), party=party, project=pa,
            amount=Decimal('300000'), status='Completed',
        )
        tot_a = party_totals(party, project_id=pa.id)
        tot_b = party_totals(party, project_id=pb.id)
        self.assertEqual(tot_a['received'], Decimal('300000'))
        self.assertEqual(tot_b['received'], Decimal('0'))
        self.assertEqual(tot_a['outstanding'], Decimal('200000'))
        self.assertEqual(tot_b['outstanding'], Decimal('800000'))

    def test_consolidated_and_unallocated(self):
        party = Account.objects.create(name='Adv', account_type='Customer', phone='9000000004')
        pa = Project.objects.create(project_name='A', customer=party, customer_name='Adv', capacity_kwp=3)
        SellInvoice.objects.create(
            party=party, project=pa, invoice_no='SI-C', invoice_date=date.today(),
            total_amount=Decimal('100000'), balance_due=Decimal('100000'), status='Issued',
        )
        Payment.objects.create(
            direction='Received', payment_date=date.today(), party=party, project=None,
            amount=Decimal('25000'), status='Completed', receipt_source='Advance',
        )
        br = project_ledger_breakdown(party)
        self.assertEqual(br['projects'][0]['outstanding'], 100000.0)
        self.assertEqual(br['unallocated']['received'], 25000.0)
        self.assertEqual(br['consolidated']['received'], 25000.0)

    def test_allocate_advance(self):
        party = Account.objects.create(name='Alloc', account_type='Customer', phone='9000000005')
        pa = Project.objects.create(project_name='A', customer=party, customer_name='Alloc', capacity_kwp=3)
        pay = Payment.objects.create(
            direction='Received', payment_date=date.today(), party=party, project=None,
            amount=Decimal('10000'), status='Completed', receipt_source='Advance',
        )
        result = allocate_payment_to_project(payment_id=pay.id, project_id=pa.id, amount='10000', user=self.user)
        self.assertTrue(result['ok'])
        pay.refresh_from_db()
        self.assertEqual(pay.project_id, pa.id)
        tot = party_totals(party, project_id=pa.id)
        self.assertEqual(tot['received'], Decimal('10000'))

    def test_customer_direct_quotation(self):
        party = Account.objects.create(name='Quote Cust', account_type='Customer', phone='9000000006')
        q = Quotation.objects.create(
            customer=party, status='Draft', plant_capacity_kw=Decimal('5'),
            material_cost=Decimal('100000'), created_by=self.user,
        )
        self.assertEqual(q.customer_id, party.id)
        self.assertIsNone(q.lead_id)
        # Serializer validation path (Customer required, Lead optional)
        from apps.leads.serializers import QuotationSerializer
        ser = QuotationSerializer(data={
            'customer': party.id,
            'status': 'Draft',
            'plant_capacity_kw': '4',
            'material_cost': '50000',
        }, context={'request': type('R', (), {'user': self.user})()})
        self.assertTrue(ser.is_valid(), ser.errors)
        q2 = ser.save()
        self.assertEqual(q2.customer_id, party.id)
        self.assertIsNone(q2.lead_id)

    def test_lead_based_quotation_all_statuses_including_lost(self):
        party = Account.objects.create(name='Lead Cust', account_type='Customer', phone='9000000007')
        lead = Lead.objects.create(
            customer_name='Lead Cust', mobile_number='9000000007', ivrs_number='IVRSTEST0001',
            status='Lost', customer=party, created_by=self.user,
        )
        from apps.leads.serializers import QuotationSerializer
        ser = QuotationSerializer(data={
            'lead': lead.id,
            'status': 'Draft',
            'plant_capacity_kw': '3',
            'material_cost': '1000',
        }, context={'request': type('R', (), {'user': self.user})()})
        self.assertTrue(ser.is_valid(), ser.errors)
        q = ser.save()
        self.assertEqual(q.lead_id, lead.id)
        self.assertEqual(q.customer_id, party.id)
        data = QuotationSerializer(q).data
        self.assertTrue(data.get('lost_lead_warning'))
        lead.refresh_from_db()
        self.assertEqual(lead.status, 'Lost')

    def test_merge_preserves_projects_and_payments(self):
        src = Account.objects.create(name='Src', account_type='Customer', phone='9000000008')
        tgt = Account.objects.create(name='Tgt', account_type='Customer', phone='9000000009')
        Project.objects.create(project_name='FromSrc', customer=src, customer_name='Src', capacity_kwp=5)
        Payment.objects.create(
            direction='Received', payment_date=date.today(), party=src, amount=Decimal('5000'),
            status='Completed',
        )
        preview = preview_customer_merge(src.id, tgt.id)
        self.assertEqual(preview['source']['counts']['projects'], 1)
        with self.assertRaises(ValueError):
            execute_customer_merge(source_id=src.id, target_id=tgt.id, user=self.user, confirm=False)
        result = execute_customer_merge(source_id=src.id, target_id=tgt.id, user=self.user, confirm=True)
        self.assertTrue(result['ok'])
        src.refresh_from_db()
        self.assertEqual(src.status, 'Merged')
        self.assertEqual(Project.objects.filter(customer=tgt).count(), 1)
        self.assertEqual(Payment.objects.filter(party=tgt).count(), 1)

    def test_project_reassignment(self):
        a = Account.objects.create(name='CustA', account_type='Customer', phone='9000000010')
        b = Account.objects.create(name='CustB', account_type='Customer', phone='9000000011')
        project = Project.objects.create(project_name='MoveMe', customer=a, customer_name='CustA', capacity_kwp=4)
        SellInvoice.objects.create(
            party=a, project=project, invoice_no='SI-M', invoice_date=date.today(),
            total_amount=Decimal('1000'), balance_due=Decimal('1000'), status='Issued',
        )
        result = reassign_project_customer(project_id=project.id, new_customer_id=b.id, user=self.user)
        self.assertTrue(result['ok'])
        project.refresh_from_db()
        self.assertEqual(project.customer_id, b.id)
        self.assertEqual(SellInvoice.objects.get(invoice_no='SI-M').party_id, b.id)

    def test_fix_duplicates_does_not_delete(self):
        Account.objects.create(name='D1', account_type='Customer', phone='9000000012', normalized_phone='9000000012')
        Account.objects.create(name='D2', account_type='Customer', phone='9000000012', normalized_phone='9000000012')
        before = Account.objects.filter(normalized_phone='9000000012').count()
        res = self.client.post('/api/v1/accounts/parties/fix-duplicates/', {}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['merge']['skipped'])
        self.assertEqual(Account.objects.filter(normalized_phone='9000000012').count(), before)

    def test_find_party_skips_merged(self):
        live = Account.objects.create(name='Live', account_type='Customer', phone='9000000013')
        merged = Account.objects.create(
            name='Old', account_type='Customer', phone='9000000013', status='Merged', merged_into=live,
        )
        Account.objects.filter(pk=merged.pk).update(normalized_phone='9000000013')
        found = find_party_by_phone('9000000013')
        self.assertEqual(found.id, live.id)
