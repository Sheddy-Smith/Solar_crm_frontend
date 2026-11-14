"""Tests for independent Quotation / Material Planning + Manual Sync."""
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.leads.models import Lead, ModuleSyncRun, Quotation, QuotationItem
from apps.leads.module_sync import preview_sync, run_sync
from apps.leads.quotation_sync import sync_quotation_downstream, sync_quotation_to_material_plans
from apps.projects.models import MaterialPlan, Project


class IndependentModuleSyncTests(TestCase):
    def setUp(self):
        self.user = make_user(
            'syncadmin@example.com',
            'Super Admin',
            {
                'Lead': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Quotation': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Project Management': {'can_view': True, 'can_add': True, 'can_edit': True},
            },
        )
        self.user.is_superuser = True
        self.user.save()
        self.lead = Lead.objects.create(
            customer_name='Sync Demo',
            mobile_number='9876543210',
            project_name='3 KW Rooftop Solar',
            estimated_capacity='3',
            project_cost=Decimal('210000'),
            status='New',
            created_by=self.user,
        )
        self.project = Project.objects.create(
            lead=self.lead,
            project_name='3 KW Rooftop Solar',
            customer_name='Sync Demo',
            capacity_kwp=Decimal('3.00'),
            status='Planning',
            created_by=self.user,
        )
        self.quotation = Quotation.objects.create(
            lead=self.lead,
            project=self.project,
            status='Draft',
            template='Residential Subsidy',
            created_by=self.user,
            grand_total=Decimal('210000'),
        )
        QuotationItem.objects.create(
            quotation=self.quotation,
            item_name='Solar PV Module 550W',
            quantity=6,
            unit='Nos',
            rate=Decimal('10000'),
            amount=Decimal('60000'),
        )

    def test_auto_downstream_does_not_create_material_plans(self):
        before = MaterialPlan.objects.filter(project=self.project).count()
        result = sync_quotation_downstream(self.quotation, user=self.user)
        self.assertEqual(result.get('material_plans'), 0)
        self.assertEqual(MaterialPlan.objects.filter(project=self.project).count(), before)

    def test_auto_downstream_does_not_overwrite_project_cost(self):
        self.lead.project_cost = Decimal('210000')
        self.lead.save(update_fields=['project_cost'])
        self.quotation.grand_total = Decimal('275000')
        self.quotation.save(update_fields=['grand_total'])
        sync_quotation_downstream(self.quotation, user=self.user)
        self.lead.refresh_from_db()
        self.assertEqual(Decimal(self.lead.project_cost), Decimal('210000'))

    def test_manual_sync_quotation_to_material_plans(self):
        preview = preview_sync(
            source_module='quotation',
            destination_module='material_planning',
            report_type=ModuleSyncRun.REPORT_QUOTATION_MATERIAL,
            project_id=self.project.id,
            quotation_id=self.quotation.id,
            user=self.user,
        )
        self.assertTrue(preview['preview_token'])
        self.assertGreaterEqual(preview['counts']['create'], 1)
        run = run_sync(preview_token=preview['preview_token'], confirm=True, user=self.user)
        self.assertIn(run.status, (ModuleSyncRun.STATUS_SUCCESS, ModuleSyncRun.STATUS_PARTIAL))
        self.assertGreaterEqual(
            MaterialPlan.objects.filter(project=self.project, source_quotation=self.quotation).count(),
            1,
        )

    def test_manual_sync_idempotent(self):
        preview1 = preview_sync(
            source_module='quotation',
            destination_module='material_planning',
            report_type=ModuleSyncRun.REPORT_QUOTATION_MATERIAL,
            project_id=self.project.id,
            quotation_id=self.quotation.id,
            user=self.user,
        )
        run_sync(preview_token=preview1['preview_token'], confirm=True, user=self.user)
        count1 = MaterialPlan.objects.filter(project=self.project, source_quotation=self.quotation).count()
        preview2 = preview_sync(
            source_module='quotation',
            destination_module='material_planning',
            report_type=ModuleSyncRun.REPORT_QUOTATION_MATERIAL,
            project_id=self.project.id,
            quotation_id=self.quotation.id,
            user=self.user,
        )
        run_sync(preview_token=preview2['preview_token'], confirm=True, user=self.user)
        count2 = MaterialPlan.objects.filter(project=self.project, source_quotation=self.quotation).count()
        self.assertEqual(count1, count2)

    def test_protected_dispatched_not_overwritten(self):
        sync_quotation_to_material_plans(self.quotation, project=self.project)
        plan = MaterialPlan.objects.filter(project=self.project, source_quotation=self.quotation).first()
        self.assertIsNotNone(plan)
        plan.dispatched_qty = '1'
        plan.dispatch_status = 'Partial'
        plan.planned_qty = '6'
        plan.save()
        # Change quotation qty
        item = self.quotation.items.first()
        item.quantity = 99
        item.save()
        result = sync_quotation_to_material_plans(self.quotation, project=self.project)
        plan.refresh_from_db()
        self.assertEqual(str(plan.planned_qty), '6')
        self.assertGreaterEqual(result['protected'], 1)

    def test_mark_as_final_api(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        q2 = Quotation.objects.create(
            lead=self.lead,
            project=self.project,
            status='Draft',
            template='Residential Subsidy',
            created_by=self.user,
            grand_total=Decimal('220000'),
        )
        r1 = client.post(f'/api/v1/quotations/{self.quotation.id}/mark-as-final/')
        self.assertEqual(r1.status_code, 200)
        self.quotation.refresh_from_db()
        self.assertEqual(self.quotation.status, 'Approved')
        self.assertTrue(self.quotation.pricing_frozen)
        self.assertIsNotNone(self.quotation.finalized_at)

        r2 = client.post(f'/api/v1/quotations/{q2.id}/mark-as-final/')
        self.assertEqual(r2.status_code, 200)
        self.quotation.refresh_from_db()
        q2.refresh_from_db()
        self.assertEqual(self.quotation.status, 'Superseded')
        self.assertEqual(q2.status, 'Approved')
        # Only one active Final
        self.assertEqual(
            Quotation.objects.filter(project=self.project, status='Approved', is_deleted=False).count(),
            1,
        )

    def test_create_revision(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        client.post(f'/api/v1/quotations/{self.quotation.id}/mark-as-final/')
        r = client.post(f'/api/v1/quotations/{self.quotation.id}/create-revision/')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['status'], 'Draft')
        self.assertEqual(r.data['revision_of'], self.quotation.id)
