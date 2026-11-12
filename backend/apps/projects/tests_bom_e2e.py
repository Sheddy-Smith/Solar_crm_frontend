"""Golden path + review-fix coverage: Lead→BOM→Quote→Project→MaterialPlan→Dashboard."""
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.leads.models import Lead, Quotation
from apps.projects.bom_models import BomCapacityConfig, BomLine, BomVersion
from apps.projects.bom_services import (
    activate_bom_version,
    create_draft_quotation_from_bom,
    ensure_default_capacity_shells,
    get_active_bom_version,
    material_shortage_count,
    seed_material_plans_from_bom,
)
from apps.projects.models import MaterialPlan, Project
from apps.projects.project_lifecycle import ensure_project_for_lead


class BomE2EWorkflowTests(TestCase):
    def setUp(self):
        self.user = make_user(
            'bom-e2e@test.com',
            'Super Admin',
            {
                'Lead': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Quotation': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Project Management': {'can_view': True, 'can_add': True, 'can_edit': True},
                'Dashboard': {'can_view': True},
            },
        )
        self.user.is_superuser = True
        self.user.save()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        ensure_default_capacity_shells()
        cfg = BomCapacityConfig.objects.get(capacity_kw=Decimal('5.00'))
        self.version = BomVersion.objects.create(
            capacity_config=cfg,
            version_number=2,
            status=BomVersion.STATUS_DRAFT,
            labour_cost=Decimal('10000'),
            other_charges=Decimal('0'),
            tax_percent=Decimal('0'),
            final_project_price=Decimal('250000'),
            pending_configuration=False,
            created_by=self.user,
        )
        BomLine.objects.create(
            version=self.version, category='Solar Panels', material_name='Panel 550W',
            unit='Nos', quantity=Decimal('9'), unit_price=Decimal('12000'), sort_order=0,
        )
        BomLine.objects.create(
            version=self.version, category='Inverter', material_name='Inverter 5kW',
            unit='Nos', quantity=Decimal('1'), unit_price=Decimal('45000'), sort_order=1,
        )
        activate_bom_version(self.version)

    def test_active_bom_for_5kw(self):
        bom = get_active_bom_version('5 kW')
        self.assertIsNotNone(bom)
        self.assertEqual(bom.id, self.version.id)
        self.assertEqual(bom.lines.count(), 2)

    def test_lead_create_auto_drafts_quotation_from_bom(self):
        """Finding 1: Lead save with capacity → automatic Draft quotation."""
        lead = Lead.objects.create(
            customer_name='Auto Quote Cust',
            mobile_number='9876500099',
            estimated_capacity='5',
            created_by=self.user,
            assigned_to=self.user,
            status='New',
        )
        drafts = Quotation.objects.filter(lead=lead, status='Draft', bom_version=self.version, is_deleted=False)
        self.assertEqual(drafts.count(), 1)
        self.assertEqual(drafts.first().items.count(), 2)

    def test_active_bom_immutable_via_api(self):
        """Finding 2: Active BOM lines/pricing cannot be patched."""
        res = self.client.patch(
            f'/api/v1/bom-versions/{self.version.id}/',
            {'labour_cost': '1.00', 'lines': [{'material_name': 'X', 'quantity': 1, 'unit_price': 1}]},
            format='json',
        )
        self.assertEqual(res.status_code, 400, msg=getattr(res, 'data', res.content))

        line = self.version.lines.first()
        res2 = self.client.patch(
            f'/api/v1/bom-lines/{line.id}/',
            {'quantity': '99'},
            format='json',
        )
        self.assertEqual(res2.status_code, 400, msg=getattr(res2, 'data', res2.content))

    def test_draft_quotation_project_material_plan_flow(self):
        lead = Lead.objects.create(
            customer_name='BOM Customer',
            mobile_number='9876500011',
            estimated_capacity='5',
            created_by=self.user,
            assigned_to=self.user,
            status='New',
        )
        # Lead signal may already have created the draft.
        quotation = Quotation.objects.filter(lead=lead, status='Draft', bom_version=self.version).first()
        self.assertIsNotNone(quotation)
        again, created2 = create_draft_quotation_from_bom(lead, user=self.user)
        self.assertFalse(created2)
        self.assertEqual(again.id, quotation.id)
        self.assertEqual(Decimal(quotation.grand_total), Decimal('250000'))

        quotation.status = 'Approved'
        quotation.save()
        project, proj_created = ensure_project_for_lead(lead, quotation=quotation, user=self.user)
        self.assertFalse(proj_created)
        self.assertEqual(project.capacity_kwp, Decimal('5.00'))
        self.assertEqual(project.total_value, Decimal('250000'))
        plans = MaterialPlan.objects.filter(project=project, bom_version=self.version)
        self.assertEqual(plans.count(), 2)

        # Version-scoped idempotency: second seed does not duplicate.
        seed_material_plans_from_bom(project, self.version, quotation=quotation)
        self.assertEqual(MaterialPlan.objects.filter(project=project, bom_version=self.version).count(), 2)

        project2, created_again = ensure_project_for_lead(lead, quotation=quotation, user=self.user)
        self.assertFalse(created_again)
        self.assertEqual(project2.id, project.id)

    def test_material_plan_does_not_rewrite_other_bom_version(self):
        lead = Lead.objects.create(
            customer_name='Version Guard', mobile_number='9876500013',
            estimated_capacity='5', created_by=self.user, status='New',
        )
        quotation, _ = create_draft_quotation_from_bom(lead, user=self.user)
        quotation.status = 'Approved'
        quotation.save()
        project, _ = ensure_project_for_lead(lead, quotation=quotation, user=self.user)
        original_ids = set(
            MaterialPlan.objects.filter(project=project, bom_version=self.version).values_list('id', flat=True)
        )

        cfg = self.version.capacity_config
        other = BomVersion.objects.create(
            capacity_config=cfg, version_number=99, status=BomVersion.STATUS_DRAFT,
            pending_configuration=False, created_by=self.user,
        )
        BomLine.objects.create(
            version=other, category='Solar Panels', material_name='Panel 550W',
            unit='Nos', quantity=Decimal('1'), unit_price=Decimal('1'), sort_order=0,
        )
        seed_material_plans_from_bom(project, other, quotation=quotation)
        # Original version plans untouched; new version gets its own row.
        self.assertEqual(
            set(MaterialPlan.objects.filter(project=project, bom_version=self.version).values_list('id', flat=True)),
            original_ids,
        )
        self.assertEqual(MaterialPlan.objects.filter(project=project, bom_version=other).count(), 1)

    def test_approved_quotation_freeze_via_api(self):
        lead = Lead.objects.create(
            customer_name='Freeze Cust', mobile_number='9876500012',
            estimated_capacity='5', created_by=self.user, status='New',
        )
        quotation, _ = create_draft_quotation_from_bom(lead, user=self.user)
        quotation.status = 'Approved'
        quotation.pricing_frozen = True
        quotation.save()
        res = self.client.patch(f'/api/v1/quotations/{quotation.id}/', {
            'material_cost': '1.00',
            'grand_total': '1.00',
        }, format='json')
        self.assertIn(res.status_code, (400, 403), msg=getattr(res, 'data', res.content))

    def test_shortage_respects_date_filter(self):
        lead = Lead.objects.create(
            customer_name='Shortage Cust', mobile_number='9876500014',
            estimated_capacity='5', created_by=self.user, status='New',
        )
        quotation, _ = create_draft_quotation_from_bom(lead, user=self.user)
        quotation.status = 'Approved'
        quotation.save()
        ensure_project_for_lead(lead, quotation=quotation, user=self.user)
        # Plans exist with shortage (no inventory link → stock 0, remaining > 0).
        self.assertGreater(material_shortage_count(), 0)
        # Far-future date window → zero (consistent with dashboard date scope).
        self.assertEqual(
            material_shortage_count(date_from='2099-01-01', date_to='2099-12-31'),
            0,
        )

    def test_unified_dashboard_has_material_planning_and_won_projects(self):
        res = self.client.get('/api/v1/dashboard/unified/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('material_planning', res.data)
        self.assertIn('won_projects', res.data['overview']['hero'])
        self.assertEqual(res.data['projects']['kpi']['performance_stats'], [])
        # customer_outstanding comes from ledger AR key, not only pending payments.
        self.assertIn('customer_outstanding', res.data['finance'])
        self.assertIn('pending_received_payments', res.data['finance'])
        self.assertIn('customer_outstanding', res.data['finance']['accounts'])
