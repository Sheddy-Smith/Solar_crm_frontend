import datetime
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.accounts_module.models import SellChallan, SellInvoice
from apps.inventory.models import InventoryItem
from apps.leads.models import Lead, Quotation
from apps.projects.models import MaterialPlan, Project, WorkOrder

BASE = '/api/v1/om/pending'


def _ids(res):
    return [row['id'] for row in res.data['results']]


class PendingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user('om-flow@test.com', 'OM Flow', {'O&M': {'can_view': True, 'can_edit': True}})
        self.client.force_authenticate(self.user)
        self.lead = Lead.objects.create(customer_name='Ravi', mobile_number='9000000001', status='Won')
        self.project = Project.objects.get(lead=self.lead)

    def test_requires_om_permission(self):
        other = make_user('no-om@test.com', 'No OM', {'Lead': {'can_view': True}})
        client = APIClient()
        client.force_authenticate(other)
        self.assertEqual(client.get(f'{BASE}/summary/').status_code, 403)
        readonly = make_user('om-ro@test.com', 'OM RO', {'O&M': {'can_view': True}})
        client.force_authenticate(readonly)
        self.assertEqual(client.get(f'{BASE}/work-orders/').status_code, 200)
        res = client.post(f'{BASE}/installation-status/', {'project': self.project.id, 'done': True}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_work_order_list_clears_once_work_order_exists(self):
        self.assertIn(self.project.id, _ids(self.client.get(f'{BASE}/work-orders/')))
        WorkOrder.objects.create(project=self.project, task='Structure fitting')
        self.assertNotIn(self.project.id, _ids(self.client.get(f'{BASE}/work-orders/')))

    def test_non_won_projects_are_ignored(self):
        self.lead.status = 'Lost'
        self.lead.save()
        self.assertNotIn(self.project.id, _ids(self.client.get(f'{BASE}/work-orders/')))

    def test_quotation_list_shows_won_lead_without_quotation(self):
        res = self.client.get(f'{BASE}/quotations/')
        self.assertIn(self.lead.id, _ids(res))
        row = next(r for r in res.data['results'] if r['id'] == self.lead.id)
        self.assertEqual(row['project'], self.project.id)
        Quotation.objects.create(lead=self.lead)
        self.assertNotIn(self.lead.id, _ids(self.client.get(f'{BASE}/quotations/')))

    def test_dispatch_pending_packed_delayed_then_cleared(self):
        self.assertNotIn(self.project.id, _ids(self.client.get(f'{BASE}/dispatch/')))
        plan = MaterialPlan.objects.create(project=self.project, category='Panels', planned_qty='10')
        row = self.client.get(f'{BASE}/dispatch/').data['results'][0]
        self.assertEqual((row['id'], row['stage'], row['pending_lines']), (self.project.id, 'Pending', 1))

        res = self.client.post(f'{BASE}/mark-packed/', {'project': self.project.id}, format='json')
        self.assertEqual(res.data['updated'], 1)
        plan.refresh_from_db()
        self.assertEqual(plan.dispatch_status, 'Packed')
        self.assertIsNotNone(plan.packed_at)
        self.assertEqual(self.client.get(f'{BASE}/dispatch/').data['results'][0]['stage'], 'Packed')

        MaterialPlan.objects.filter(pk=plan.pk).update(packed_at=timezone.now() - datetime.timedelta(days=3))
        row = self.client.get(f'{BASE}/dispatch/').data['results'][0]
        self.assertTrue(row['is_delayed'])
        self.assertEqual((row['stage'], row['delay_days']), ('Delayed', 3))

        plan.dispatched_qty = '10'
        plan.dispatch_status = 'Dispatched'
        plan.save()
        self.assertNotIn(self.project.id, _ids(self.client.get(f'{BASE}/dispatch/')))

    def test_material_plan_serializer_keeps_packed_and_stamps_time(self):
        pm = make_user('pm-flow@test.com', 'PM', {'Project Management': {'can_view': True, 'can_edit': True, 'can_add': True}})
        client = APIClient()
        client.force_authenticate(pm)
        plan = MaterialPlan.objects.create(project=self.project, category='Inverter', planned_qty='1')
        res = client.patch(f'/api/v1/material-plans/{plan.id}/', {'dispatch_status': 'Packed'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['dispatch_status'], 'Packed')
        self.assertIsNotNone(res.data['packed_at'])
        res = client.patch(f'/api/v1/material-plans/{plan.id}/', {'dispatch_status': 'Dispatched'}, format='json')
        self.assertEqual(res.data['dispatch_status'], 'Packed')
        res = client.post('/api/v1/material-plans/mark-packed/', {'project': self.project.id, 'packed': False}, format='json')
        self.assertEqual(res.data['updated'], 1)
        plan.refresh_from_db()
        self.assertEqual((plan.dispatch_status, plan.packed_at), ('Pending', None))

    def test_installation_default_not_done_and_mark_done(self):
        self.assertEqual(self.project.installation_status, 'Not Done')
        self.assertIn(self.project.id, _ids(self.client.get(f'{BASE}/installation/')))
        res = self.client.post(f'{BASE}/installation-status/', {'project': self.project.id, 'done': True}, format='json')
        self.assertEqual(res.data['installation_status'], 'Done')
        self.assertEqual(res.data['installation_done_on'], timezone.localdate())
        self.assertNotIn(self.project.id, _ids(self.client.get(f'{BASE}/installation/')))
        self.client.post(f'{BASE}/installation-status/', {'project': self.project.id, 'done': False}, format='json')
        self.project.refresh_from_db()
        self.assertEqual((self.project.installation_status, self.project.installation_done_on), ('Not Done', None))

    def test_invoice_list_moves_from_challan_to_invoice_then_clears(self):
        def row():
            return next((r for r in self.client.get(f'{BASE}/invoices/').data['results'] if r['id'] == self.project.id), None)

        self.assertEqual(row()['pending_document'], 'Sales Challan')
        SellChallan.objects.create(project=self.project, challan_date=timezone.localdate(), challan_no='SC-T1')
        self.assertEqual((row()['pending_document'], row()['challan_no']), ('Invoice', 'SC-T1'))
        invoice = SellInvoice.objects.create(project=self.project, invoice_date=timezone.localdate(), invoice_no='SI-T1')
        self.assertIsNone(row())
        invoice.status = 'Cancelled'
        invoice.save()
        self.assertEqual(row()['pending_document'], 'Invoice')

    def test_short_material_low_stock_and_project_demand(self):
        low = InventoryItem.objects.create(name='DC Cable', current_stock=Decimal('5'), minimum_stock=Decimal('10'))
        ok = InventoryItem.objects.create(name='MC4', current_stock=Decimal('50'), minimum_stock=Decimal('10'))
        demand = InventoryItem.objects.create(name='Panel 540W', current_stock=Decimal('4'), minimum_stock=Decimal('0'))
        MaterialPlan.objects.create(project=self.project, category='Panels', items='Panel 540W', planned_qty='10', dispatched_qty='2')
        rows = {r['id']: r for r in self.client.get(f'{BASE}/materials/').data['results']}
        self.assertNotIn(ok.id, rows)
        self.assertEqual((rows[low.id]['status'], rows[low.id]['shortage']), ('Low Stock', 5.0))
        self.assertEqual(rows[demand.id]['status'], 'Project Shortage')
        self.assertEqual((rows[demand.id]['project_demand'], rows[demand.id]['shortage']), (8.0, 4.0))
        self.assertEqual(rows[demand.id]['projects'], [self.project.project_id])

    def test_summary_counts(self):
        data = self.client.get(f'{BASE}/summary/').data
        for key in ('work_orders', 'quotations', 'dispatch', 'installation', 'invoices', 'materials'):
            self.assertIn(key, data)
        self.assertEqual(data['work_orders'], 1)
        self.assertEqual(data['invoices_challan'], 1)

    def test_project_patch_installation_status_sets_date(self):
        pm = make_user('pm-inst@test.com', 'PM', {'Project Management': {'can_view': True, 'can_edit': True}})
        client = APIClient()
        client.force_authenticate(pm)
        res = client.patch(f'/api/v1/projects/{self.project.id}/', {'installation_status': 'Done'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['installation_status'], 'Done')
        self.assertEqual(res.data['installation_done_on'], str(timezone.localdate()))
