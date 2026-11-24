"""Lead ownership: Tele/Sales read scope vs mutate / transfer rules."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role, RolePermission, User
from apps.accounts.permissions import can_mutate_lead, is_own_lead, lead_owner_q
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
    'Lead': {
        'can_view': True,
        'can_add': True,
        'can_edit': True,
        'can_delete': True,
        'can_assign': True,
    },
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
        # Transferred Tele creator still has READ ownership (created_by).
        self.assertTrue(is_own_lead(self.creator, lead))
        self.assertFalse(can_mutate_lead(self.creator, lead))

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
        self.assertTrue(can_mutate_lead(se, lead))
        self.assertEqual(Lead.objects.filter(lead_owner_q(se)).filter(id=lead.id).count(), 1)

    def test_sales_executive_keeps_lead_they_added_after_reassign(self):
        """SE sees leads they created even after assignment moves to someone else."""
        se = self.assignee
        other = make_user('sales.other@test.com', 'Sales Executive', LEAD_PERMS)
        lead = Lead.objects.create(
            customer_name='SE Created Then Reassigned',
            mobile_number='9000012348',
            created_by=se,
            assigned_to=other,
            status='Follow-up',
        )
        self.assertTrue(is_own_lead(se, lead))
        self.assertTrue(is_own_lead(other, lead))
        self.assertTrue(can_mutate_lead(se, lead))
        self.assertTrue(can_mutate_lead(other, lead))
        self.assertEqual(Lead.objects.filter(lead_owner_q(se)).filter(id=lead.id).count(), 1)
        self.assertEqual(Lead.objects.filter(lead_owner_q(other)).filter(id=lead.id).count(), 1)

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


class TeleSalesLeadOwnershipTests(TestCase):
    """Tele Sales: created_by | assigned_to visibility; transfer = read-only."""

    def setUp(self):
        self.client = APIClient()
        self.tele = make_user('harshika@test.com', 'Tele Sales Executive', LEAD_PERMS)
        self.other_tele = make_user('other.tele@test.com', 'Tele Sales Executive', LEAD_PERMS)
        self.sales = make_user('sales.hand@test.com', 'Sales Executive', LEAD_PERMS)
        self.now = timezone.now()

    def _ids(self, res):
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        return {row['id'] for row in rows}

    def test_tele_sees_created_unassigned_and_assigned_leads(self):
        created_unassigned = Lead.objects.create(
            customer_name='Created Unassigned',
            mobile_number='9111100001',
            created_by=self.tele,
            assigned_to=None,
            status='New',
        )
        assigned_to_tele = Lead.objects.create(
            customer_name='Assigned To Tele',
            mobile_number='9111100002',
            created_by=self.other_tele,
            assigned_to=self.tele,
            status='New',
        )
        transferred = Lead.objects.create(
            customer_name='Transferred To Sales',
            mobile_number='9111100003',
            created_by=self.tele,
            assigned_to=self.sales,
            status='New',
        )
        foreign = Lead.objects.create(
            customer_name='Other Employee Lead',
            mobile_number='9111100004',
            created_by=self.other_tele,
            assigned_to=None,
            status='New',
        )

        visible = set(Lead.objects.filter(lead_owner_q(self.tele)).values_list('id', flat=True))
        self.assertEqual(visible, {created_unassigned.id, assigned_to_tele.id, transferred.id})
        self.assertNotIn(foreign.id, visible)

        self.assertTrue(is_own_lead(self.tele, created_unassigned))
        self.assertTrue(is_own_lead(self.tele, assigned_to_tele))
        self.assertTrue(is_own_lead(self.tele, transferred))
        self.assertFalse(is_own_lead(self.tele, foreign))

        self.assertTrue(can_mutate_lead(self.tele, created_unassigned))
        self.assertTrue(can_mutate_lead(self.tele, assigned_to_tele))
        self.assertFalse(can_mutate_lead(self.tele, transferred))
        self.assertFalse(can_mutate_lead(self.tele, foreign))

    def test_tele_list_api_excludes_soft_deleted_and_foreign_leads(self):
        active = Lead.objects.create(
            customer_name='Active Mine',
            mobile_number='9111100010',
            created_by=self.tele,
            assigned_to=None,
            status='New',
        )
        soft = Lead.objects.create(
            customer_name='Soft Deleted Mine',
            mobile_number='9111100011',
            created_by=self.tele,
            assigned_to=None,
            status='New',
            is_deleted=True,
            deleted_at=self.now,
            deleted_by=self.tele,
        )
        foreign = Lead.objects.create(
            customer_name='Foreign Active',
            mobile_number='9111100012',
            created_by=self.other_tele,
            assigned_to=None,
            status='New',
        )

        self.client.force_authenticate(self.tele)
        res = self.client.get('/api/v1/leads/', {'page_size': 100})
        self.assertEqual(res.status_code, 200, res.data)
        ids = self._ids(res)
        self.assertIn(active.id, ids)
        self.assertNotIn(soft.id, ids)
        self.assertNotIn(foreign.id, ids)

    def test_tele_create_visible_immediately_when_unassigned(self):
        self.client.force_authenticate(self.tele)
        res = self.client.post(
            '/api/v1/leads/',
            {
                'customer_name': 'Fresh Tele Lead',
                'mobile_number': '9111100020',
                'ivrs_number': 'IVRS-TELE-CREATE-001',
                'status': 'New',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)
        lead_id = res.data['id']
        lead = Lead.objects.get(pk=lead_id)
        self.assertEqual(lead.created_by_id, self.tele.id)
        self.assertIsNone(lead.assigned_to_id)
        self.assertTrue(is_own_lead(self.tele, lead))
        self.assertTrue(can_mutate_lead(self.tele, lead))

        listed = self.client.get('/api/v1/leads/', {'page_size': 100})
        self.assertIn(lead_id, self._ids(listed))

    def test_tele_transferred_lead_is_read_only(self):
        lead = Lead.objects.create(
            customer_name='Handed To Sales',
            mobile_number='9111100030',
            created_by=self.tele,
            assigned_to=self.sales,
            status='New',
        )
        self.client.force_authenticate(self.tele)

        detail = self.client.get(f'/api/v1/leads/{lead.id}/')
        self.assertEqual(detail.status_code, 200, detail.data)

        patch = self.client.patch(
            f'/api/v1/leads/{lead.id}/',
            {'remarks': 'should fail'},
            format='json',
        )
        self.assertEqual(patch.status_code, 403, patch.data)

        status_res = self.client.post(
            f'/api/v1/leads/{lead.id}/update_status/',
            {'status': 'Lost'},
            format='json',
        )
        self.assertEqual(status_res.status_code, 403, status_res.data)

        delete = self.client.delete(f'/api/v1/leads/{lead.id}/')
        self.assertEqual(delete.status_code, 403, delete.data)

        fu = self.client.post(
            '/api/v1/follow-ups/',
            {
                'lead': lead.id,
                'follow_up_type': 'Call',
                'scheduled_at': (self.now + timedelta(days=1)).isoformat(),
                'status': 'Scheduled',
            },
            format='json',
        )
        self.assertEqual(fu.status_code, 403, fu.data)

    def test_tele_can_mutate_own_unassigned_lead(self):
        lead = Lead.objects.create(
            customer_name='Still Mine',
            mobile_number='9111100040',
            created_by=self.tele,
            assigned_to=None,
            status='New',
        )
        self.client.force_authenticate(self.tele)
        patch = self.client.patch(
            f'/api/v1/leads/{lead.id}/',
            {'remarks': 'updated by creator'},
            format='json',
        )
        self.assertEqual(patch.status_code, 200, patch.data)
        lead.refresh_from_db()
        self.assertEqual(lead.remarks, 'updated by creator')

    def test_cross_user_cannot_retrieve_unrelated_lead(self):
        lead = Lead.objects.create(
            customer_name='Secret Lead',
            mobile_number='9111100050',
            created_by=self.other_tele,
            assigned_to=None,
            status='New',
        )
        self.client.force_authenticate(self.tele)
        res = self.client.get(f'/api/v1/leads/{lead.id}/')
        self.assertEqual(res.status_code, 404, res.data)

    def test_stats_count_includes_created_unassigned(self):
        Lead.objects.create(
            customer_name='Stat Lead',
            mobile_number='9111100060',
            created_by=self.tele,
            assigned_to=None,
            status='New',
        )
        Lead.objects.create(
            customer_name='Foreign Stat',
            mobile_number='9111100061',
            created_by=self.other_tele,
            assigned_to=None,
            status='New',
        )
        self.client.force_authenticate(self.tele)
        res = self.client.get('/api/v1/leads/stats/')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['total'], 1)
        self.assertEqual(res.data['new'], 1)

    def test_sales_create_still_self_assigns(self):
        self.client.force_authenticate(self.sales)
        res = self.client.post(
            '/api/v1/leads/',
            {
                'customer_name': 'SE Fresh',
                'mobile_number': '9111100070',
                'ivrs_number': 'IVRS-SE-CREATE-001',
                'status': 'New',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)
        lead = Lead.objects.get(pk=res.data['id'])
        self.assertEqual(lead.created_by_id, self.sales.id)
        self.assertEqual(lead.assigned_to_id, self.sales.id)
