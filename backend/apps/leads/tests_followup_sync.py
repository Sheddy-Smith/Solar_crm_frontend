from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role, RolePermission, User
from apps.leads.followup_sync import SUPERSEDED_NOTE
from apps.leads.models import FollowUp, Lead


def make_user(email):
    role, _ = Role.objects.get_or_create(name='Tele Sales Executive')
    perm, _ = RolePermission.objects.get_or_create(role=role, module='Lead')
    perm.can_view = perm.can_add = perm.can_edit = True
    perm.save()
    user = User.objects.create_user(email=email, password='testpass1234', name=email.split('@')[0])
    user.role = role
    user.save()
    return user


class LatestFollowUpWinsTests(TestCase):
    """The latest logged follow-up replaces older open schedules on the lead."""

    def setUp(self):
        self.user = make_user('fu-sync@test.com')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.now = timezone.now()
        # Mutate rights: assignee OR unassigned creator. Self-assign keeps write path clear.
        self.lead = Lead.objects.create(
            customer_name='Ramesh Kaur',
            mobile_number='7700010008',
            created_by=self.user,
            assigned_to=self.user,
            status='Follow-up',
        )
        self.planned_at = self.now + timedelta(days=3)
        self.planned = FollowUp.objects.create(
            lead=self.lead, follow_up_type='Call', scheduled_at=self.planned_at, status='Scheduled', created_by=self.user,
        )
        FollowUp.objects.filter(pk=self.planned.pk).update(created_at=self.now - timedelta(days=1))

    def post(self, **data):
        res = self.client.post('/api/v1/follow-ups/', {'lead': self.lead.id, **data}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        return res

    def log_call(self, follow_up_type='Call'):
        return self.post(
            follow_up_type=follow_up_type, scheduled_at=self.now.isoformat(), completed_at=self.now.isoformat(),
            status='Completed', notes='Spoke with customer',
        )

    def test_reschedule_before_due_date_closes_old_plan(self):
        next_due = self.now + timedelta(days=10)
        self.log_call()
        self.post(follow_up_type='Call', scheduled_at=next_due.isoformat(), status='Scheduled', notes='Next follow-up')

        self.planned.refresh_from_db()
        self.assertEqual(self.planned.status, 'Completed')
        self.assertEqual(self.planned.outcome, SUPERSEDED_NOTE)
        open_rows = FollowUp.objects.filter(lead=self.lead, status='Scheduled')
        self.assertEqual(open_rows.count(), 1)
        self.lead.refresh_from_db()
        self.assertAlmostEqual(self.lead.next_follow_up.timestamp(), next_due.timestamp(), delta=1)

    def test_logging_call_without_next_date_clears_old_plan(self):
        self.log_call()

        self.planned.refresh_from_db()
        self.assertEqual(self.planned.status, 'Completed')
        self.assertFalse(FollowUp.objects.filter(lead=self.lead, status='Scheduled').exists())
        self.lead.refresh_from_db()
        self.assertIsNone(self.lead.next_follow_up)

    def test_note_does_not_cancel_planned_follow_up(self):
        self.log_call(follow_up_type='Note')

        self.planned.refresh_from_db()
        self.assertEqual(self.planned.status, 'Scheduled')
        self.lead.refresh_from_db()
        self.assertAlmostEqual(self.lead.next_follow_up.timestamp(), self.planned_at.timestamp(), delta=1)

    def test_lead_follow_up_date_change_moves_alert_off_overdue(self):
        past = self.now - timedelta(days=20)
        FollowUp.objects.filter(pk=self.planned.pk).update(scheduled_at=past)
        self.lead.next_follow_up = past
        self.lead.save(update_fields=['next_follow_up'])

        new_day = (timezone.localtime(self.now) + timedelta(days=4)).date().isoformat()
        res = self.client.patch(
            f'/api/v1/leads/{self.lead.id}/',
            {'next_follow_up': new_day},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.planned.refresh_from_db()
        self.assertEqual(self.planned.status, 'Scheduled')
        self.assertGreater(self.planned.scheduled_at, self.now)
        self.lead.refresh_from_db()
        self.assertGreater(self.lead.next_follow_up, self.now)

    def test_past_due_plan_replaced_by_newer_update_is_missed(self):
        FollowUp.objects.filter(pk=self.planned.pk).update(scheduled_at=self.now - timedelta(days=5))
        self.log_call()

        self.planned.refresh_from_db()
        self.assertEqual(self.planned.status, 'Missed')


class FollowUpBumpsLastActivityTests(TestCase):
    """Recent Leads / Lead List sort by last_activity_at — follow-ups must bump it."""

    def setUp(self):
        self.user = make_user('fu-activity@test.com')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.older = timezone.now() - timedelta(hours=5)
        self.lead_a = Lead.objects.create(
            customer_name='Activity Lead A',
            mobile_number='7700010091',
            created_by=self.user,
            assigned_to=self.user,
            status='Follow-up',
            last_activity_at=self.older,
        )
        self.lead_b = Lead.objects.create(
            customer_name='Activity Lead B',
            mobile_number='7700010092',
            created_by=self.user,
            assigned_to=self.user,
            status='New',
            last_activity_at=timezone.now() - timedelta(hours=1),
        )

    def test_follow_up_create_bumps_last_activity_and_recent_order(self):
        before = self.lead_a.last_activity_at
        res = self.client.post(
            '/api/v1/follow-ups/',
            {
                'lead': self.lead_a.id,
                'follow_up_type': 'Call',
                'scheduled_at': timezone.now().isoformat(),
                'completed_at': timezone.now().isoformat(),
                'status': 'Completed',
                'notes': 'Customer call logged',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.lead_a.refresh_from_db()
        self.assertIsNotNone(self.lead_a.last_activity_at)
        self.assertGreater(self.lead_a.last_activity_at, before)

        recent = self.client.get('/api/v1/leads/recent/?limit=5')
        self.assertEqual(recent.status_code, 200, recent.data)
        ids = [row['id'] for row in recent.data]
        self.assertEqual(ids[0], self.lead_a.id)
        self.assertIn(self.lead_b.id, ids)

    def test_follow_up_update_bumps_last_activity(self):
        create = self.client.post(
            '/api/v1/follow-ups/',
            {
                'lead': self.lead_a.id,
                'follow_up_type': 'Call',
                'scheduled_at': (timezone.now() + timedelta(days=1)).isoformat(),
                'status': 'Scheduled',
                'notes': 'Plan call',
            },
            format='json',
        )
        self.assertEqual(create.status_code, 201, create.data)
        self.lead_a.refresh_from_db()
        mid = self.lead_a.last_activity_at
        Lead.objects.filter(pk=self.lead_a.pk).update(last_activity_at=self.older)
        self.lead_a.refresh_from_db()

        patch = self.client.patch(
            f'/api/v1/follow-ups/{create.data["id"]}/',
            {'notes': 'Updated remarks after call', 'status': 'Completed', 'completed_at': timezone.now().isoformat()},
            format='json',
        )
        self.assertEqual(patch.status_code, 200, patch.data)
        self.lead_a.refresh_from_db()
        self.assertGreater(self.lead_a.last_activity_at, self.older)
        self.assertGreaterEqual(self.lead_a.last_activity_at, mid)
