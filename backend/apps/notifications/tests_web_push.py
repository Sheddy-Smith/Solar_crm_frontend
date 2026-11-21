from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Role, RolePermission, User
from apps.notifications.models import Notification, PushSubscription
from apps.notifications.services import notify


def make_user(email):
    role, _ = Role.objects.get_or_create(name='Admin')
    perm, _ = RolePermission.objects.get_or_create(role=role, module='Daily Tasks')
    perm.can_view = True
    perm.save()
    user = User.objects.create_user(email=email, password='testpass1234', name=email.split('@')[0])
    user.role = role
    user.save()
    return user


class PushSubscriptionApiTests(TestCase):
    def setUp(self):
        self.user = make_user('push-user@test.com')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @override_settings(VAPID_PUBLIC_KEY='BPtestpublickey', VAPID_PRIVATE_KEY='test-private')
    def test_save_and_delete_push_subscription(self):
        res = self.client.post(
            '/api/v1/notifications/push-subscription/',
            {
                'endpoint': 'https://example.com/push/abc',
                'keys': {'p256dh': 'p256', 'auth': 'authkey'},
            },
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(PushSubscription.objects.filter(user=self.user).count(), 1)

        # Upsert same endpoint — no duplicates.
        res2 = self.client.post(
            '/api/v1/notifications/push-subscription/',
            {
                'endpoint': 'https://example.com/push/abc',
                'keys': {'p256dh': 'p256-updated', 'auth': 'authkey'},
            },
            format='json',
        )
        self.assertEqual(res2.status_code, 200, res2.data)
        self.assertEqual(PushSubscription.objects.filter(user=self.user).count(), 1)
        self.assertEqual(PushSubscription.objects.get(user=self.user).p256dh, 'p256-updated')

        deleted = self.client.post(
            '/api/v1/notifications/push-subscription/delete/',
            {'endpoint': 'https://example.com/push/abc'},
            format='json',
        )
        self.assertEqual(deleted.status_code, 200, deleted.data)
        self.assertEqual(PushSubscription.objects.filter(user=self.user).count(), 0)

    def test_notify_dedupe_and_unread(self):
        notify('task-demo-1', 'Task assigned: Demo', user=self.user, category='Task', module='Daily Tasks', link='/daily-tasks')
        notify('task-demo-1', 'Task assigned: Demo', user=self.user, category='Task', module='Daily Tasks', link='/daily-tasks')
        self.assertEqual(Notification.objects.filter(dedupe_key='task-demo-1').count(), 1)
        unread = self.client.get('/api/v1/notifications/unread-count/')
        self.assertEqual(unread.status_code, 200)
        self.assertEqual(unread.data['count'], 1)
