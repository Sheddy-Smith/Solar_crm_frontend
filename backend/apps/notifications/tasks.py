"""Celery tasks for Web Push delivery and Daily Task due reminders."""
from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name='notifications.send_web_push_for_notification')
def send_web_push_for_notification(notification_id: int):
    from .push import send_web_push_for_notification_id
    return send_web_push_for_notification_id(notification_id)


@shared_task(name='notifications.notify_due_daily_tasks')
def notify_due_daily_tasks():
    """Create CRM + Web Push alerts for staff Daily Tasks due today / overdue."""
    from apps.daily_tasks.models import StaffDailyTask
    from .services import notify

    today = timezone.localdate()
    rows = (
        StaffDailyTask.objects.filter(status=StaffDailyTask.STATUS_NOT_COMPLETED)
        .filter(Q(due_date__lte=today) | Q(due_date__isnull=True, task_date__lte=today))
        .select_related('assigned_to')
    )
    created = 0
    for task in rows:
        if not task.assigned_to_id:
            continue
        overdue = bool(task.due_date and task.due_date < today) or (
            not task.due_date and task.task_date and task.task_date < today
        )
        label = 'Overdue' if overdue else 'Due today'
        _, was_created = notify(
            f'staff-daily-due-{task.pk}-{today.isoformat()}',
            f'Daily Task {label}: {task.title}',
            message=(task.description or '')[:500],
            category='Task',
            severity='critical' if overdue else 'upcoming',
            module='Daily Tasks',
            user=task.assigned_to,
            link='/daily-tasks',
            channel='crm',
        )
        if was_created:
            created += 1
    logger.info('notify_due_daily_tasks created=%s', created)
    return {'created': created}


@shared_task(name='notifications.notify_upcoming_daily_tasks')
def notify_upcoming_daily_tasks():
    """Remind assignees one day before due date."""
    from apps.daily_tasks.models import StaffDailyTask
    from .services import notify

    tomorrow = timezone.localdate() + timedelta(days=1)
    rows = (
        StaffDailyTask.objects.filter(
            status=StaffDailyTask.STATUS_NOT_COMPLETED,
            due_date=tomorrow,
        ).select_related('assigned_to')
    )
    created = 0
    for task in rows:
        if not task.assigned_to_id:
            continue
        _, was_created = notify(
            f'staff-daily-upcoming-{task.pk}-{tomorrow.isoformat()}',
            f'Daily Task tomorrow: {task.title}',
            message=(task.description or '')[:500],
            category='Task',
            severity='info',
            module='Daily Tasks',
            user=task.assigned_to,
            link='/daily-tasks',
            channel='crm',
        )
        if was_created:
            created += 1
    return {'created': created}
