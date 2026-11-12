"""Unit tests for media path ACL, traversal denial, and lead object gate."""
from django.test import SimpleTestCase, TestCase

from apps.accounts.models import Role, RolePermission, User
from apps.leads.models import Lead
from malwa_solar.media_views import (
    _module_for_media_path,
    _user_can_access_media_object,
    _user_can_view_module,
    normalize_media_path,
)


class MediaPathMappingTests(SimpleTestCase):
    def test_known_folders_map_to_modules(self):
        self.assertEqual(_module_for_media_path('lead_survey_photos/2026/01/x.jpg'), 'Lead')
        self.assertEqual(_module_for_media_path('project_images/2026/01/x.jpg'), 'Project Management')
        self.assertEqual(_module_for_media_path('amc/documents/x.pdf'), 'AMC & Warranty')
        self.assertEqual(_module_for_media_path('workforce/docs/x.pdf'), 'Employee')

    def test_folder_boundary_not_prefix_collision(self):
        self.assertIsNone(_module_for_media_path('project_images_backup/x.jpg'))
        self.assertIsNone(_module_for_media_path('lead_survey_photos_old/x.jpg'))

    def test_unmapped_and_traversal_denied(self):
        self.assertIsNone(_module_for_media_path('mystery/folder/secret.pdf'))
        self.assertIsNone(normalize_media_path('../etc/passwd'))
        self.assertIsNone(normalize_media_path('lead_survey_photos/../../etc/passwd'))
        self.assertIsNone(normalize_media_path('%2e%2e/%2e%2e/etc/passwd'))
        self.assertEqual(normalize_media_path('lead_survey_photos/a.jpg'), 'lead_survey_photos/a.jpg')


class MediaModulePermissionTests(TestCase):
    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name='Lead Viewer Only MediaAcl2')
        perm, _ = RolePermission.objects.get_or_create(role=self.role, module='Lead')
        perm.can_view = True
        perm.save()
        self.user = User.objects.create_user(
            email='leadviewer2@mediaacl.test', password='testpass1234', name='LeadViewer',
        )
        self.user.role = self.role
        self.user.save()

        self.tele_role, _ = Role.objects.get_or_create(name='Tele Sales Executive')
        tele_perm, _ = RolePermission.objects.get_or_create(role=self.tele_role, module='Lead')
        tele_perm.can_view = True
        tele_perm.can_add = True
        tele_perm.save()
        self.tele = User.objects.create_user(
            email='tele2@mediaacl.test', password='testpass1234', name='Tele',
        )
        self.tele.role = self.tele_role
        self.tele.save()
        self.other = User.objects.create_user(
            email='other2@mediaacl.test', password='testpass1234', name='Other',
        )
        self.other.role = self.tele_role
        self.other.save()

    def test_mapped_module_requires_can_view(self):
        self.assertTrue(_user_can_view_module(self.user, 'Lead'))
        self.assertFalse(_user_can_view_module(self.user, 'O&M'))
        self.assertFalse(_user_can_view_module(self.user, None))

    def test_lead_scoped_cannot_access_unresolved_or_foreign(self):
        own = Lead.objects.create(
            customer_name='Own', mobile_number='9111111111',
            created_by=self.tele, assigned_to=self.tele,
        )
        foreign = Lead.objects.create(
            customer_name='Foreign', mobile_number='9222222222',
            created_by=self.other, assigned_to=self.other,
        )
        own_path = f'lead_survey_photos/2026/01/lead{own.id}_own/a.jpg'
        foreign_path = f'lead_survey_photos/2026/01/lead{foreign.id}_foreign/a.jpg'
        unresolved = 'project_documents/2026/01/orphan.pdf'
        self.assertTrue(_user_can_access_media_object(self.tele, own_path))
        self.assertFalse(_user_can_access_media_object(self.tele, foreign_path))
        self.assertFalse(_user_can_access_media_object(self.tele, unresolved))
