"""O&M Job Card workflow + checklist enforcement."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.om.models import OmJobCard


class OmJobCardApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user(
            'om.jc@test.com',
            'OM Editor',
            {'O&M': {'can_view': True, 'can_edit': True}},
        )
        self.client.force_authenticate(self.user)

    def test_job_card_status_lifecycle_and_checklist(self):
        jc = OmJobCard.objects.create(
            work_description='Panel cleaning',
            checklist=[{'label': 'Safety', 'done': False}],
            status='Draft',
            created_by=self.user,
        )
        r = self.client.post(f'/api/v1/om/job-cards/{jc.id}/transition/', {'status': 'Assigned'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        jc.refresh_from_db()
        self.assertEqual(jc.status, 'Assigned')

        r = self.client.post(f'/api/v1/om/job-cards/{jc.id}/start-work/', {}, format='json')
        self.assertEqual(r.status_code, 200, r.content)

        r = self.client.post(f'/api/v1/om/job-cards/{jc.id}/complete-work/', {}, format='json')
        self.assertEqual(r.status_code, 400, r.content)

        self.client.patch(
            f'/api/v1/om/job-cards/{jc.id}/',
            {'checklist': [{'label': 'Safety', 'done': True}], 'work_performed': 'Cleaned panels'},
            format='json',
        )
        r = self.client.post(f'/api/v1/om/job-cards/{jc.id}/complete-work/', {}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        jc.refresh_from_db()
        self.assertEqual(jc.status, 'Work Completed')
        self.assertTrue(jc.activities.exists())

    def test_invalid_transition_rejected(self):
        jc = OmJobCard.objects.create(status='Closed', created_by=self.user)
        r = self.client.post(f'/api/v1/om/job-cards/{jc.id}/transition/', {'status': 'In Progress'}, format='json')
        self.assertEqual(r.status_code, 400)
