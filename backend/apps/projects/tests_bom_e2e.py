"""Golden path: capacity BOM → draft quotation → approve → project → material plans."""
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

    def test_draft_quotation_project_material_plan_flow(self):
        lead = Lead.objects.create(
            customer_name='BOM Customer',
            mobile_number='9876500011',
            estimated_capacity='5',
            created_by=self.user,
            assigned_to=self.user,
            status='New',
        )
        quotation, created = create_draft_quotation_from_bom(lead, user=self.user)
        self.assertTrue(created)
        self.assertEqual(quotation.status, 'Draft')
        self.assertEqual(quotation.bom_version_id, self.version.id)
        self.assertEqual(quotation.items.count(), 2)
        self.assertEqual(Decimal(quotation.grand_total), Decimal('250000'))

        # Duplicate draft reuses
        again, created2 = create_draft_quotation_from_bom(lead, user=self.user)
        self.assertFalse(created2)
        self.assertEqual(again.id, quotation.id)

        quotation.status = 'Approved'
        quotation.save()
        # Approval signal already creates/links project; ensure_* stays idempotent.
        project, proj_created = ensure_project_for_lead(lead, quotation=quotation, user=self.user)
        self.assertFalse(proj_created)
        self.assertEqual(project.capacity_kwp, Decimal('5.00'))
        self.assertEqual(project.total_value, Decimal('250000'))
        plans = MaterialPlan.objects.filter(project=project, bom_version=self.version)
        self.assertEqual(plans.count(), 2)

        project2, created_again = ensure_project_for_lead(lead, quotation=quotation, user=self.user)
        self.assertFalse(created_again)
        self.assertEqual(project2.id, project.id)

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

    def test_unified_dashboard_has_material_planning_and_won_projects(self):
        res = self.client.get('/api/v1/dashboard/unified/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('material_planning', res.data)
        self.assertIn('won_projects', res.data['overview']['hero'])
        self.assertEqual(res.data['projects']['kpi']['performance_stats'], [])
