"""BOM E2E + review regression: Lead→BOM→Quote→Project→MaterialPlan→Dashboard."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal
from unittest import mock

from django.db import connection, transaction
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.leads.bom_draft_outbox import process_lead_bom_draft_outbox
from apps.leads.models import Lead, LeadBomDraftOutbox, Quotation
from apps.projects.bom_models import BomCapacityConfig, BomLine, BomVersion
from apps.projects.bom_services import (
    activate_bom_version,
    create_draft_quotation_from_bom,
    ensure_default_capacity_shells,
    get_active_bom_version,
    material_shortage_count,
    seed_material_plans_from_bom,
)
from apps.projects.models import MaterialPlan
from apps.projects.project_lifecycle import ensure_project_for_lead


def _superuser(email='bom-e2e@test.com'):
    user = make_user(
        email,
        'Super Admin',
        {
            'Lead': {'can_view': True, 'can_add': True, 'can_edit': True},
            'Quotation': {'can_view': True, 'can_add': True, 'can_edit': True},
            'Project Management': {'can_view': True, 'can_add': True, 'can_edit': True},
            'Dashboard': {'can_view': True},
        },
    )
    user.is_superuser = True
    user.save()
    return user


def _activate_5kw_bom(user, mobile_suffix='00'):
    ensure_default_capacity_shells()
    cfg = BomCapacityConfig.objects.get(capacity_kw=Decimal('5.00'))
    version = BomVersion.objects.create(
        capacity_config=cfg,
        version_number=BomVersion.objects.filter(capacity_config=cfg).count() + 1,
        status=BomVersion.STATUS_DRAFT,
        labour_cost=Decimal('10000'),
        other_charges=Decimal('0'),
        tax_percent=Decimal('0'),
        final_project_price=Decimal('250000'),
        pending_configuration=False,
        created_by=user,
    )
    BomLine.objects.create(
        version=version, category='Solar Panels', material_name='Panel 550W',
        unit='Nos', quantity=Decimal('9'), unit_price=Decimal('12000'), sort_order=0,
    )
    BomLine.objects.create(
        version=version, category='Inverter', material_name='Inverter 5kW',
        unit='Nos', quantity=Decimal('1'), unit_price=Decimal('45000'), sort_order=1,
    )
    activate_bom_version(version)
    return version


class BomE2EWorkflowTests(TestCase):
    def setUp(self):
        self.user = _superuser()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.version = _activate_5kw_bom(self.user)

    def test_active_bom_for_5kw(self):
        bom = get_active_bom_version('5 kW')
        self.assertIsNotNone(bom)
        self.assertEqual(bom.id, self.version.id)
        self.assertEqual(bom.lines.count(), 2)

    def test_lead_create_auto_drafts_quotation_from_bom(self):
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
        outbox = LeadBomDraftOutbox.objects.get(lead=lead)
        self.assertEqual(outbox.status, LeadBomDraftOutbox.STATUS_SUCCESS)

    def test_no_duplicate_draft_after_approved_on_lead_update(self):
        """BUG-01: Lead updates after Approved must not create another Draft."""
        lead = Lead.objects.create(
            customer_name='Approved Guard',
            mobile_number='9876500088',
            estimated_capacity='5',
            created_by=self.user,
            status='New',
        )
        quotation = Quotation.objects.get(lead=lead, bom_version=self.version, status='Draft')
        quotation.status = 'Approved'
        quotation.pricing_frozen = True
        quotation.save()

        lead.remarks = 'follow-up 1'
        lead.save()
        lead.customer_name = 'Approved Guard Updated'
        lead.save()
        lead.estimated_capacity = '5'
        lead.save()

        self.assertEqual(
            Quotation.objects.filter(lead=lead, is_deleted=False, bom_version=self.version).count(),
            1,
        )
        self.assertEqual(
            Quotation.objects.filter(lead=lead, status='Draft', bom_version=self.version).count(),
            0,
        )
        again, created = create_draft_quotation_from_bom(lead, bom_version=self.version, user=self.user)
        self.assertFalse(created)
        self.assertEqual(again.id, quotation.id)
        self.assertEqual(again.status, 'Approved')

    def test_active_bom_immutable_via_api(self):
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
        self.assertGreater(material_shortage_count(), 0)
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
        self.assertIn('customer_outstanding', res.data['finance'])
        self.assertIn('pending_received_payments', res.data['finance'])
        self.assertIn('customer_outstanding', res.data['finance']['accounts'])

    def test_lead_survives_when_bom_draft_generation_fails(self):
        """BUG-04: Lead create succeeds even if quotation generation raises."""
        with mock.patch(
            'apps.projects.bom_services.create_draft_quotation_from_bom',
            side_effect=RuntimeError('simulated draft failure'),
        ):
            lead = Lead.objects.create(
                customer_name='Survive Fail',
                mobile_number='9876500077',
                estimated_capacity='5',
                created_by=self.user,
                status='New',
            )
        lead.refresh_from_db()
        self.assertEqual(lead.customer_name, 'Survive Fail')
        self.assertTrue(Lead.objects.filter(pk=lead.pk).exists())
        self.assertEqual(Quotation.objects.filter(lead=lead).count(), 0)
        outbox = LeadBomDraftOutbox.objects.get(lead=lead)
        self.assertEqual(outbox.status, LeadBomDraftOutbox.STATUS_FAILED)
        self.assertEqual(outbox.last_error_code, 'RuntimeError')

        # Durable retry can succeed later when the failure is gone.
        result = process_lead_bom_draft_outbox(lead.pk, user_id=self.user.pk)
        self.assertTrue(result.get('ok'))
        self.assertEqual(Quotation.objects.filter(lead=lead, status='Draft').count(), 1)
        outbox.refresh_from_db()
        self.assertEqual(outbox.status, LeadBomDraftOutbox.STATUS_SUCCESS)


class BomActivationConcurrencyTests(TransactionTestCase):
    """BUG-03: concurrent activate must leave exactly one Active version.

    Uses TransactionTestCase + separate DB connections per thread (not Django TestCase).
    In-process capacity lock + DB select_for_update serialize activation.
    """

    def test_activate_uses_capacity_select_for_update(self):
        user = _superuser('bom-lock-spy@test.com')
        ensure_default_capacity_shells()
        cfg = BomCapacityConfig.objects.get(capacity_kw=Decimal('4.00'))
        ver = BomVersion.objects.create(
            capacity_config=cfg,
            version_number=50,
            status=BomVersion.STATUS_DRAFT,
            pending_configuration=False,
            created_by=user,
        )
        BomLine.objects.create(
            version=ver, category='Panel', material_name='LockSpy',
            unit='Nos', quantity=Decimal('1'), unit_price=Decimal('10'), sort_order=0,
        )
        with mock.patch.object(
            BomCapacityConfig.objects, 'select_for_update', wraps=BomCapacityConfig.objects.select_for_update,
        ) as mocked:
            activate_bom_version(ver)
            self.assertTrue(mocked.called)

    def test_concurrent_activate_leaves_one_active(self):
        user = _superuser('bom-concurrency@test.com')
        ensure_default_capacity_shells()
        cfg = BomCapacityConfig.objects.get(capacity_kw=Decimal('5.00'))
        BomVersion.objects.filter(capacity_config=cfg).update(status=BomVersion.STATUS_INACTIVE)

        versions = []
        for i in range(2):
            ver = BomVersion.objects.create(
                capacity_config=cfg,
                version_number=100 + i,
                status=BomVersion.STATUS_DRAFT,
                pending_configuration=False,
                created_by=user,
                final_project_price=Decimal('100000'),
            )
            BomLine.objects.create(
                version=ver, category='Panel', material_name=f'P{i}',
                unit='Nos', quantity=Decimal('1'), unit_price=Decimal('10'), sort_order=0,
            )
            versions.append(ver.id)

        errors = []

        def _activate(version_id):
            # Each thread needs its own DB connection.
            connection.close()
            try:
                activate_bom_version(BomVersion.objects.get(pk=version_id))
            except Exception as exc:  # noqa: BLE001 — collect for assertion
                errors.append(exc)
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(_activate, vid) for vid in versions]
            for fut in as_completed(futures):
                fut.result()

        active = list(
            BomVersion.objects.filter(capacity_config=cfg, status=BomVersion.STATUS_ACTIVE)
            .values_list('id', flat=True)
        )
        self.assertEqual(len(errors), 0, msg=f'Unexpected activate errors: {errors}')
        self.assertEqual(len(active), 1, msg=f'Expected 1 Active, got {active}')
