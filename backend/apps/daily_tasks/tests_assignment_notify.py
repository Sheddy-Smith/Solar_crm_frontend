from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Branch, Role, RolePermission, User
from apps.daily_tasks.models import StaffDailyTask
from apps.notifications.models import Notification


def make_user(email, *, can_assign=False, branch=None):
    role_name = 'Branch Manager' if can_assign else 'Tele Sales Executive'
    role, _ = Role.objects.get_or_create(name=role_name)
    for module, flags in (
        ('Daily Tasks', {'can_view': True, 'can_add': can_assign, 'can_edit': True}),
        ('Lead', {'can_view': True, 'can_add': True, 'can_edit': True}),
    ):
        perm, _ = RolePermission.objects.get_or_create(role=role, module=module)
        for key, value in flags.items():
            setattr(perm, key, value)
        perm.save()
    user = User.objects.create_user(email=email, password='testpass1234', name=email.split('@')[0])
    user.role = role
    user.branch = branch
    user.save()
    return user


class StaffTaskAssignmentNotifyTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name='Test Branch Notify')
        self.assigner = make_user('assigner@test.com', can_assign=True, branch=self.branch)
        self.assignee = make_user('assignee@test.com', can_assign=False, branch=self.branch)
        self.outsider = make_user('outsider@test.com', can_assign=False, branch=self.branch)
        self.client = APIClient()
        self.client.force_authenticate(self.assigner)

    def test_assign_creates_notification_for_assignee_only(self):
        res = self.client.post(
            '/api/v1/daily-tasks/assignments/',
            {
                'title': 'Call warm leads',
                'description': 'Finish morning dialer list',
                'assigned_to': self.assignee.id,
                'task_date': '2026-11-21',
                'due_date': '2026-11-21',
                'status': StaffDailyTask.STATUS_NOT_COMPLETED,
            },
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)
        task_id = res.data['id']

        rows = list(Notification.objects.filter(user=self.assignee, category='Task'))
        self.assertEqual(len(rows), 1)
        self.assertIn('Call warm leads', rows[0].title)
        self.assertIn(self.assigner.name, rows[0].message)
        self.assertEqual(rows[0].link, '/daily-tasks')
        self.assertEqual(rows[0].dedupe_key, f'staff-task-assigned-{task_id}-{self.assignee.id}')

        self.assertFalse(Notification.objects.filter(user=self.outsider).exists())

        # Idempotent: calling notify path again must not duplicate (unique dedupe_key).
        from apps.notifications.services import notify
        notify(
            f'staff-task-assigned-{task_id}-{self.assignee.id}',
            'Task assigned: Call warm leads',
            user=self.assignee,
            category='Task',
            module='Daily Tasks',
            link='/daily-tasks',
        )
        self.assertEqual(Notification.objects.filter(user=self.assignee, category='Task').count(), 1)

    def test_self_assignment_still_notifies(self):
        res = self.client.post(
            '/api/v1/daily-tasks/assignments/',
            {
                'title': 'Self task',
                'assigned_to': self.assigner.id,
                'task_date': '2026-11-21',
                'status': StaffDailyTask.STATUS_NOT_COMPLETED,
            },
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(Notification.objects.filter(user=self.assigner, category='Task').exists())
