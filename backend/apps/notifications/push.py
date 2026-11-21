"""Web Push (VAPID) helpers — send OS notifications to PWA / TWA devices."""
from __future__ import annotations

import json
import logging

from django.conf import settings
from django.contrib.auth import get_user_model

from apps.accounts.permissions import is_super_admin
from apps.crm_settings.services import get_category_settings

from .models import Notification, PushSubscription
from .services import viewable_modules

logger = logging.getLogger(__name__)
User = get_user_model()


def vapid_configured() -> bool:
    return bool(getattr(settings, 'VAPID_PUBLIC_KEY', '') and getattr(settings, 'VAPID_PRIVATE_KEY', ''))


def push_alerts_enabled() -> bool:
    try:
        cfg = get_category_settings('notification') or {}
    except Exception:
        cfg = {}
    return bool(cfg.get('pushAlerts', True))


def recipients_for_notification(notification: Notification):
    """Users who should receive a device push for this CRM notification row."""
    if notification.user_id:
        return list(User.objects.filter(pk=notification.user_id).select_related('role'))
    module = (notification.module or '').strip()
    users = []
    for user in User.objects.filter(is_active=True).select_related('role'):
        if is_super_admin(user) or (module and module in viewable_modules(user)):
            users.append(user)
    return users


def enqueue_web_push(notification: Notification):
    """Fire-and-forget Celery task after a new CRM notification is created."""
    if not notification or not notification.pk:
        return
    if not push_alerts_enabled() or not vapid_configured():
        return
    try:
        from .tasks import send_web_push_for_notification
        send_web_push_for_notification.delay(notification.pk)
    except Exception:
        logger.exception('Failed to enqueue web push for notification %s', notification.pk)
        try:
            send_web_push_for_notification_id(notification.pk)
        except Exception:
            logger.exception('Inline web push fallback failed for notification %s', notification.pk)


def send_web_push_to_user(user, *, title, body='', url='/', tag='malwa-crm', severity='info'):
    """Send a push payload to every stored subscription for `user`."""
    if not vapid_configured() or not push_alerts_enabled() or not user:
        return {'sent': 0, 'removed': 0}
    subs = list(PushSubscription.objects.filter(user=user))
    return _deliver(subs, title=title, body=body, url=url, tag=tag, severity=severity)


def send_web_push_for_notification_id(notification_id: int):
    try:
        notification = Notification.objects.get(pk=notification_id)
    except Notification.DoesNotExist:
        return {'sent': 0, 'removed': 0, 'error': 'missing'}
    if not push_alerts_enabled() or not vapid_configured():
        return {'sent': 0, 'removed': 0, 'error': 'skipped'}
    recipients = recipients_for_notification(notification)
    if not recipients:
        return {'sent': 0, 'removed': 0}
    subs = list(PushSubscription.objects.filter(user__in=recipients))
    return _deliver(
        subs,
        title=notification.title,
        body=notification.message or '',
        url=notification.link or '/',
        tag=f'crm-notif-{notification.pk}',
        severity=notification.severity or 'info',
    )


def _deliver(subs, *, title, body='', url='/', tag='malwa-crm', severity='info'):
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.error('pywebpush is not installed — cannot send Web Push')
        return {'sent': 0, 'removed': 0, 'error': 'pywebpush_missing'}

    payload = json.dumps({
        'title': title,
        'body': body or '',
        'url': url or '/',
        'tag': tag or 'malwa-crm',
        'severity': severity or 'info',
    })
    vapid_claims = {'sub': getattr(settings, 'VAPID_SUBJECT', 'mailto:noreply@malwasolar.com')}
    sent = 0
    removed = 0
    for sub in subs:
        try:
            webpush(
                subscription_info=sub.as_webpush_info(),
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_public_key=settings.VAPID_PUBLIC_KEY,
                vapid_claims=vapid_claims,
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(getattr(exc, 'response', None), 'status_code', None)
            logger.warning('Web Push failed for sub %s: %s', sub.pk, exc)
            if status in (404, 410):
                PushSubscription.objects.filter(pk=sub.pk).delete()
                removed += 1
        except Exception:
            logger.exception('Unexpected Web Push error for sub %s', sub.pk)
    return {'sent': sent, 'removed': removed}
