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
        self.lead = Lead.objects.create(
            customer_name='Ramesh Kaur', mobile_number='7700010008', created_by=self.user, status='Follow-up',
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

    def test_past_due_plan_replaced_by_newer_update_is_missed(self):
        FollowUp.objects.filter(pk=self.planned.pk).update(scheduled_at=self.now - timedelta(days=5))
        self.log_call()

        self.planned.refresh_from_db()
        self.assertEqual(self.planned.status, 'Missed')
