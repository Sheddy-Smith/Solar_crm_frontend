"""Assignee-primary lead / follow-up visibility (inactive creator must not hide work)."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role, RolePermission, User
from apps.accounts.permissions import is_own_lead, lead_owner_q
from apps.leads.models import FollowUp, Lead


def make_user(email, role_name, perms=None):
    role, _ = Role.objects.get_or_create(name=role_name)
    for module, flags in (perms or {}).items():
        perm, _ = RolePermission.objects.get_or_create(role=role, module=module)
        for flag, value in flags.items():
            setattr(perm, flag, value)
        perm.save()
    user = User.objects.create_user(email=email, password='testpass1234', name=email.split('@')[0])
    user.role = role
    user.save()
    return user


LEAD_PERMS = {
    'Lead': {'can_view': True, 'can_add': True, 'can_edit': True, 'can_assign': True},
}


class InactiveCreatorFollowUpVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.creator = make_user('tele.creator@test.com', 'Tele Sales Executive', LEAD_PERMS)
        self.assignee = make_user('sales.assignee@test.com', 'Sales Executive', LEAD_PERMS)
        self.now = timezone.now()
        self.past = self.now - timedelta(days=5)

    def _lead_with_scheduled(self, *, assigned_to):
        lead = Lead.objects.create(
            customer_name='Inactive Creator Lead',
            mobile_number='9000012345',
            created_by=self.creator,
            assigned_to=assigned_to,
            status='Follow-up',
            next_follow_up=self.past,
        )
        follow_up = FollowUp.objects.create(
            lead=lead,
            follow_up_type='Call',
            scheduled_at=self.past,
            status='Scheduled',
            notes='Pending after creator left',
            created_by=self.creator,
        )
        return lead, follow_up

    def test_assignee_owns_lead_when_creator_inactive(self):
        lead, _ = self._lead_with_scheduled(assigned_to=self.assignee)
        self.creator.is_active = False
        self.creator.save(update_fields=['is_active', 'updated_at'])

        self.assertTrue(is_own_lead(self.assignee, lead))
        self.assertFalse(is_own_lead(self.creator, lead))

        qs = Lead.objects.filter(lead_owner_q(self.assignee))
        self.assertEqual(list(qs.values_list('id', flat=True)), [lead.id])

    def test_assignee_lists_scheduled_follow_ups_after_creator_deactivated(self):
        lead, follow_up = self._lead_with_scheduled(assigned_to=self.assignee)
        self.creator.is_active = False
        self.creator.save(update_fields=['is_active', 'updated_at'])

        self.client.force_authenticate(self.assignee)
        res = self.client.get('/api/v1/follow-ups/', {'status': 'Scheduled', 'page_size': 100})
        self.assertEqual(res.status_code, 200, res.data)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = [row['id'] for row in rows]
        self.assertIn(follow_up.id, ids)

        matched = next(row for row in rows if row['id'] == follow_up.id)
        self.assertEqual(matched['lead'], lead.id)
        self.assertEqual(matched['lead_assigned_to'], self.assignee.id)
        self.assertEqual(matched['lead_created_by'], self.creator.id)

    def test_creator_loses_assigned_lead_but_keeps_unassigned(self):
        assigned_lead, _ = self._lead_with_scheduled(assigned_to=self.assignee)
        pool_lead = Lead.objects.create(
            customer_name='Still In Tele Pool',
            mobile_number='9000012346',
            created_by=self.creator,
            assigned_to=None,
            status='New',
        )

        self.assertFalse(is_own_lead(self.creator, assigned_lead))
        self.assertTrue(is_own_lead(self.creator, pool_lead))
        self.assertTrue(is_own_lead(self.assignee, assigned_lead))

    def test_sales_executive_self_assigned_create_path_still_owned(self):
        """Active SE workflow: perform_create sets assigned_to=self — still visible."""
        se = self.assignee
        lead = Lead.objects.create(
            customer_name='SE Own Lead',
            mobile_number='9000012347',
            created_by=se,
            assigned_to=se,
            status='New',
        )
        self.assertTrue(is_own_lead(se, lead))
        self.assertEqual(Lead.objects.filter(lead_owner_q(se)).filter(id=lead.id).count(), 1)

    def test_history_rows_preserved_when_creator_inactive(self):
        lead, follow_up = self._lead_with_scheduled(assigned_to=self.assignee)
        completed = FollowUp.objects.create(
            lead=lead,
            follow_up_type='Call',
            scheduled_at=self.past - timedelta(days=2),
            completed_at=self.past - timedelta(days=2),
            status='Completed',
            notes='Old note',
            outcome='Thinking',
            created_by=self.creator,
        )
        self.creator.is_active = False
        self.creator.save(update_fields=['is_active', 'updated_at'])

        self.client.force_authenticate(self.assignee)
        res = self.client.get('/api/v1/follow-ups/', {'lead': lead.id, 'page_size': 100})
        self.assertEqual(res.status_code, 200, res.data)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        ids = {row['id'] for row in rows}
        self.assertEqual(ids, {follow_up.id, completed.id})
