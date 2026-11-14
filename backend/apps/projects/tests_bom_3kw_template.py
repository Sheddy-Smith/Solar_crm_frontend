"""3 kW Structure & Electrical BOM template — seed, auto-quote, project cost, material plan, final."""
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.leads.models import Lead, Quotation
from apps.projects.bom_3kw_template import BOM_3KW_LINES, TEMPLATE_CAPACITY_KW
from apps.projects.bom_models import BomCapacityConfig, BomVersion
from apps.projects.bom_services import get_active_bom_version, maybe_draft_quotation_for_lead
from apps.projects.models import MaterialPlan
from apps.projects.project_lifecycle import ensure_project_for_lead


def _superuser():
    user = make_user(
        'bom-3kw@test.com',
        'Super Admin',
        {
            'Lead': {'can_view': True, 'can_add': True, 'can_edit': True},
            'Quotation': {'can_view': True, 'can_add': True, 'can_edit': True},
            'Project Management': {'can_view': True, 'can_add': True, 'can_edit': True},
        },
    )
    user.is_superuser = True
    user.save()
    return user


class Bom3KwTemplateTests(TestCase):
    def setUp(self):
        self.user = _superuser()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        call_command('seed_3kw_structure_electrical_bom', verbosity=0)

    def test_template_seeded_and_active(self):
        bom = get_active_bom_version('3')
        self.assertIsNotNone(bom)
        self.assertEqual(bom.capacity_kw, TEMPLATE_CAPACITY_KW)
        self.assertFalse(bom.pending_configuration)
        self.assertEqual(bom.lines.count(), len(BOM_3KW_LINES))
        # Exact outward samples
        by_name = {ln.material_name: ln for ln in bom.lines.all()}
        self.assertEqual(by_name['Base Plate 200x200mm'].quantity, Decimal('4'))
        self.assertEqual(by_name['AC Cu Cable 3 Core 2.5sqmm'].quantity, Decimal('1.500'))
        self.assertEqual(by_name['Solar Panel DCR'].quantity, Decimal('5'))
        self.assertEqual(by_name['Solar Inverter 3kW'].quantity, Decimal('1'))
        self.assertEqual(by_name['Base Plate 150x150mm'].quantity, Decimal('0'))

    def test_seed_idempotent(self):
        before = BomVersion.objects.filter(
            capacity_config__capacity_kw=TEMPLATE_CAPACITY_KW,
            status=BomVersion.STATUS_ACTIVE,
        ).count()
        call_command('seed_3kw_structure_electrical_bom', verbosity=0)
        after = BomVersion.objects.filter(
            capacity_config__capacity_kw=TEMPLATE_CAPACITY_KW,
            status=BomVersion.STATUS_ACTIVE,
        ).count()
        self.assertEqual(before, 1)
        self.assertEqual(after, 1)

    def test_auto_draft_from_project_name_and_project_cost(self):
        lead = Lead.objects.create(
            customer_name='3kW Cost Cust',
            mobile_number='9876511111',
            project_name='3 KW DEMO SITE',
            estimated_capacity='',  # capacity from project_name
            project_cost=Decimal('185000.00'),
            created_by=self.user,
            status='New',
        )
        # Lead post_save outbox may already draft; helper must reuse (idempotent).
        quotation, _, skip = maybe_draft_quotation_for_lead(lead, user=self.user)
        self.assertIsNone(skip)
        self.assertIsNotNone(quotation)
        self.assertEqual(quotation.status, 'Draft')
        self.assertEqual(quotation.items.count(), len(BOM_3KW_LINES))
        self.assertEqual(Decimal(quotation.grand_total), Decimal('185000.00'))
        # Material lines preserved (not overwritten by project cost)
        self.assertTrue(quotation.items.filter(item_name='Base Plate 200x200mm').exists())

    def test_empty_project_cost_does_not_invent_price(self):
        lead = Lead.objects.create(
            customer_name='3kW No Cost',
            mobile_number='9876511112',
            estimated_capacity='3',
            project_cost=None,
            created_by=self.user,
            status='New',
        )
        quotation, _, skip = maybe_draft_quotation_for_lead(lead, user=self.user)
        self.assertIsNone(skip)
        self.assertIsNotNone(quotation)
        # No fabricated contract price when BOM has no final_project_price
        bom = get_active_bom_version('3')
        self.assertIsNone(bom.final_project_price)
        self.assertEqual(Decimal(quotation.grand_total), bom.computed_project_price())

    def test_material_plan_seeded_on_project_create(self):
        lead = Lead.objects.create(
            customer_name='3kW Plan Cust',
            mobile_number='9876511113',
            estimated_capacity='3 kW',
            created_by=self.user,
            status='New',
        )
        quotation, _, skip = maybe_draft_quotation_for_lead(lead, user=self.user)
        self.assertIsNone(skip)
        self.assertIsNotNone(quotation)
        lead.status = 'Won'
        lead.save()
        # Won signal may already create the project — ensure_project_for_lead is idempotent.
        project, _ = ensure_project_for_lead(lead, quotation=quotation, user=self.user)
        self.assertIsNotNone(project)
        plans = MaterialPlan.objects.filter(project=project, bom_version=quotation.bom_version)
        self.assertEqual(plans.count(), len(BOM_3KW_LINES))
        # Removing a plan line does not delete inventory product
        plan = plans.filter(items__icontains='Cable Tie 150mm').first()
        self.assertIsNotNone(plan)
        inv_id = plan.inventory_item_id
        plan.delete()
        self.assertEqual(MaterialPlan.objects.filter(project=project, bom_version=quotation.bom_version).count(), len(BOM_3KW_LINES) - 1)
        if inv_id:
            from apps.inventory.models import InventoryItem
            self.assertTrue(InventoryItem.objects.filter(pk=inv_id).exists())

    def test_no_duplicate_draft_on_retry(self):
        lead = Lead.objects.create(
            customer_name='3kW Dup',
            mobile_number='9876511114',
            estimated_capacity='3',
            created_by=self.user,
            status='New',
        )
        q1, _, _ = maybe_draft_quotation_for_lead(lead, user=self.user)
        q2, c2, _ = maybe_draft_quotation_for_lead(lead, user=self.user)
        self.assertIsNotNone(q1)
        self.assertFalse(c2)
        self.assertEqual(q1.id, q2.id)
        self.assertEqual(Quotation.objects.filter(lead=lead, is_deleted=False).count(), 1)

    def test_mark_as_final_supersedes_previous(self):
        lead = Lead.objects.create(
            customer_name='3kW Final',
            mobile_number='9876511115',
            estimated_capacity='3',
            created_by=self.user,
            status='New',
        )
        q1, _, _ = maybe_draft_quotation_for_lead(lead, user=self.user)
        r1 = self.client.post(f'/api/v1/quotations/{q1.id}/mark-as-final/')
        self.assertEqual(r1.status_code, 200, msg=getattr(r1, 'data', r1.content))
        q1.refresh_from_db()
        self.assertEqual(q1.status, 'Approved')
        self.assertTrue(q1.pricing_frozen)

        # Second draft via force_new path is blocked for Approved BOM — create revision instead
        r2 = self.client.post(f'/api/v1/quotations/{q1.id}/create-revision/')
        self.assertEqual(r2.status_code, 201, msg=getattr(r2, 'data', r2.content))
        q2_id = r2.data['id']
        r3 = self.client.post(f'/api/v1/quotations/{q2_id}/mark-as-final/')
        self.assertEqual(r3.status_code, 200, msg=getattr(r3, 'data', r3.content))
        q1.refresh_from_db()
        q2 = Quotation.objects.get(pk=q2_id)
        self.assertEqual(q2.status, 'Approved')
        self.assertEqual(q1.status, 'Superseded')

    def test_other_capacity_not_using_3kw_template(self):
        cfg, _ = BomCapacityConfig.objects.get_or_create(
            capacity_kw=Decimal('5.00'),
            defaults={'is_active': True, 'sort_order': 1},
        )
        # No active 5 kW BOM — 5 kW lead must skip, not fall back to 3 kW.
        lead = Lead.objects.create(
            customer_name='5kW No Template',
            mobile_number='9876511116',
            estimated_capacity='5',
            created_by=self.user,
            status='New',
        )
        quotation, created, skip = maybe_draft_quotation_for_lead(lead, user=self.user)
        self.assertIn(skip, ('no_active_bom', 'bom_pending_configuration'))
        self.assertFalse(created)
        self.assertIsNone(quotation)
