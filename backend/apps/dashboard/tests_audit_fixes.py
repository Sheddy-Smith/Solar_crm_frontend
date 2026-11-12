"""Regression tests for dashboard audit DASH-01 … DASH-06."""
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.dashboard.services import _om_alerts, build_unified_dashboard
from apps.leads.models import FollowUp, Lead
from apps.projects.models import Project
from apps.reports.services import reports_dashboard


class DashboardAuditFixTests(TestCase):
    def setUp(self):
        self.user = make_user(
            'dash-audit@test.com',
            'Dashboard User',
            {'Dashboard': {'can_view': True}, 'Lead': {'can_view': True}},
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.today = timezone.localdate()

    def test_dash01_followups_count_followup_model_not_quotation_status(self):
        lead = Lead.objects.create(
            customer_name='FU Lead', mobile_number='9111100001', created_by=self.user, status='New',
        )
        Lead.objects.create(
            customer_name='Quote Lead', mobile_number='9111100002', created_by=self.user, status='Quotation',
        )
        FollowUp.objects.create(
            lead=lead,
            follow_up_type='Call',
            scheduled_at=timezone.now(),
            status='Scheduled',
            created_by=self.user,
        )
        FollowUp.objects.create(
            lead=lead,
            follow_up_type='Call',
            scheduled_at=timezone.now() - timedelta(days=1),
            status='Completed',
            completed_at=timezone.now(),
            created_by=self.user,
            is_deleted=True,
        )

        data = reports_dashboard()
        kpis = {row['title']: row['value'] for row in data['kpis']}
        self.assertEqual(kpis['Follow-ups'], '1')
        self.assertEqual(kpis['Quotations'], '1')

    def test_dash04_deleted_leads_excluded_from_report_kpis(self):
        Lead.objects.create(
            customer_name='Live', mobile_number='9111100003', created_by=self.user, status='New',
        )
        Lead.objects.create(
            customer_name='Gone', mobile_number='9111100004', created_by=self.user, status='New', is_deleted=True,
        )
        data = reports_dashboard()
        kpis = {row['title']: row['value'] for row in data['kpis']}
        self.assertEqual(kpis['Total Leads'], '1')
        self.assertEqual(kpis['New Leads'], '1')

    def test_dash02_deleted_projects_excluded_from_summary(self):
        Project.objects.create(
            project_name='Live P', customer_name='C1', capacity_kwp=5, status='Active', created_by=self.user,
        )
        Project.objects.create(
            project_name='Deleted P', customer_name='C2', capacity_kwp=5, status='Active',
            created_by=self.user, is_deleted=True,
        )
        data = build_unified_dashboard()
        self.assertEqual(data['projects']['summary']['active'], 1)
        self.assertEqual(data['projects']['summary']['total'], 1)
        self.assertEqual(data['projects']['kpi']['summary']['active'], 1)

    def test_dash03_date_filters_reach_project_and_accounts_sections(self):
        old = Project.objects.create(
            project_name='Old P', customer_name='Old', capacity_kwp=3, status='Planning', created_by=self.user,
        )
        Project.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=90))
        Project.objects.create(
            project_name='New P', customer_name='New', capacity_kwp=3, status='Active', created_by=self.user,
        )

        filtered = build_unified_dashboard({
            'date_from': (self.today - timedelta(days=7)).isoformat(),
            'date_to': self.today.isoformat(),
        })
        self.assertEqual(filtered['projects']['summary']['total'], 1)
        self.assertEqual(filtered['projects']['summary']['active'], 1)
        self.assertEqual(filtered['filters']['date_scope'], 'period_activity_plus_live_snapshots')

    def test_dash06_om_failure_keeps_keys_and_flags_unavailable(self):
        with mock.patch('apps.om.dashboard.dashboard_summary', side_effect=RuntimeError('om down')):
            alerts = _om_alerts()
        self.assertTrue(alerts.get('om_unavailable'))
        self.assertIn('om_service_overdue', alerts)
        self.assertIsNone(alerts['om_service_overdue'])
        self.assertTrue(alerts.get('om_error'))

    def test_unified_endpoint_includes_received_monthly_trend(self):
        res = self.client.get('/api/v1/dashboard/unified/')
        self.assertEqual(res.status_code, 200)
        trend = res.data['finance']['accounts'].get('received_monthly_trend')
        self.assertIsInstance(trend, list)
        self.assertGreaterEqual(len(trend), 1)
