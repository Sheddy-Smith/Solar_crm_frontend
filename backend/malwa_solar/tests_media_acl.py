"""Unit tests for media path → module ACL (H1) and lead object gate (M9)."""
from django.test import SimpleTestCase, TestCase

from apps.accounts.models import Role, RolePermission, User
from apps.leads.models import Lead
from malwa_solar.media_views import (
    _lead_id_from_media_path,
    _module_for_media_path,
    _user_can_access_media_object,
    _user_can_view_module,
)


class MediaPathMappingTests(SimpleTestCase):
    def test_known_folders_map_to_modules(self):
        self.assertEqual(_module_for_media_path('lead_survey_photos/2026/01/x.jpg'), 'Lead')
        self.assertEqual(_module_for_media_path('project_images/2026/01/x.jpg'), 'Project Management')
        self.assertEqual(_module_for_media_path('amc/documents/x.pdf'), 'AMC & Warranty')
        self.assertEqual(_module_for_media_path('workforce/docs/x.pdf'), 'Employee')
        self.assertEqual(_module_for_media_path('backups/dump.sql'), 'Settings')
        self.assertEqual(_module_for_media_path('expense_docs/2024/01/x.pdf'), 'Project Management')

    def test_folder_boundary_not_prefix_collision(self):
        self.assertIsNone(_module_for_media_path('project_images_backup/x.jpg'))
        self.assertIsNone(_module_for_media_path('lead_survey_photos_old/x.jpg'))
        self.assertIsNone(_module_for_media_path('om_docs_private/x.pdf'))

    def test_unmapped_paths_return_none(self):
        self.assertIsNone(_module_for_media_path('mystery/folder/secret.pdf'))
        self.assertIsNone(_module_for_media_path('tmp/upload.bin'))

    def test_lead_id_parser(self):
        self.assertEqual(
            _lead_id_from_media_path('lead_survey_photos/2026/01/lead42_acme/ab.jpg'),
            42,
        )
        self.assertIsNone(_lead_id_from_media_path('project_documents/2026/01/file.pdf'))


class MediaModulePermissionTests(TestCase):
    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name='Lead Viewer Only MediaAcl')
        perm, _ = RolePermission.objects.get_or_create(role=self.role, module='Lead')
        perm.can_view = True
        perm.save()
        self.user = User.objects.create_user(
            email='leadviewer@mediaacl.test', password='testpass1234', name='LeadViewer',
        )
        self.user.role = self.role
        self.user.save()

        self.tele_role, _ = Role.objects.get_or_create(name='Tele Sales Executive')
        tele_perm, _ = RolePermission.objects.get_or_create(role=self.tele_role, module='Lead')
        tele_perm.can_view = True
        tele_perm.can_add = True
        tele_perm.save()
        self.tele = User.objects.create_user(
            email='tele@mediaacl.test', password='testpass1234', name='Tele',
        )
        self.tele.role = self.tele_role
        self.tele.save()
        self.other = User.objects.create_user(
            email='other@mediaacl.test', password='testpass1234', name='Other',
        )
        self.other.role = self.tele_role
        self.other.save()

    def test_mapped_module_requires_can_view(self):
        self.assertTrue(_user_can_view_module(self.user, 'Lead'))
        self.assertFalse(_user_can_view_module(self.user, 'O&M'))
        self.assertFalse(_user_can_view_module(self.user, None))

    def test_unmapped_denied_even_when_authenticated(self):
        self.assertFalse(_user_can_view_module(self.user, None))

    def test_lead_scoped_cannot_access_other_lead_media(self):
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
        self.assertTrue(_user_can_access_media_object(self.tele, own_path))
        self.assertFalse(_user_can_access_media_object(self.tele, foreign_path))
