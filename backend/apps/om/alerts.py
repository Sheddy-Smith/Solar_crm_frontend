"""O&M alert engine. Idempotent: every alert has a dedupe key, so running the
sync any number of times a day never repeats a notification."""
import logging
from datetime import date, datetime, timedelta

from django.core.cache import cache
from django.utils import timezone

from apps.notifications.services import notify
from .models import OmPlant, OmMaintenanceTask, OmBreakdownTicket, OmInsurance
from .services import compute_om_status

logger = logging.getLogger(__name__)

SYNC_CACHE_KEY = 'om_daily_sync_last_run'
SYNC_STALE_HOURS = 6
SERVICE_DUE_DAYS = 15
FREE_SERVICE_THRESHOLDS = (
    (7, 'critical', 'Free service expiring in {days} days (urgent)'),
    (30, 'upcoming', 'Free service expiring in {days} days'),
    (90, 'info', 'Free service expiring in {days} days (reminder)'),
)
UNASSIGNED_TICKET_HOURS = 4
PENDING_TICKET_DAYS = 3


def _plant_link(plant):
    return f'/om/plants?plant={plant.pk}'


def _sync_plants(today, counts):
    for plant in OmPlant.objects.select_related('amc_contract').filter(is_active=True):
        status = compute_om_status(plant, today)
        if status != plant.om_status:
            plant.om_status = status
            plant.save(update_fields=['om_status', 'updated_at'])
            counts['plants_updated'] += 1
        if plant.amc_contract_id or plant.om_status == 'Paid O&M' or not plant.free_service_end:
            continue
        days = (plant.free_service_end - today).days
        if days < 0:
            _, created = notify(
                f'free-expired-{plant.pk}-{plant.free_service_end}',
                f'AMC Renewal Required: {plant.plant_name}',
                message=f'{plant.plant_code} free O&M service ended on {plant.free_service_end:%d-%m-%Y}. '
                        'Follow up for paid O&M / AMC.',
                category='Free Service', severity='critical', plant=plant, link=_plant_link(plant),
            )
            counts['alerts'] += int(created)
            continue
        if days == 0:
            _, created = notify(
                f'free-expiry-day-{plant.pk}-{plant.free_service_end}',
                f'Free service expires today: {plant.plant_name}',
                message=f'{plant.plant_code} — plan AMC renewal.', category='Free Service',
                severity='critical', plant=plant, link=_plant_link(plant),
            )
            counts['alerts'] += int(created)
            continue
        for threshold, severity, template in FREE_SERVICE_THRESHOLDS:
            if days <= threshold:
                _, created = notify(
                    f'free-{threshold}-{plant.pk}-{plant.free_service_end}',
                    f'{template.format(days=days)}: {plant.plant_name}',
                    message=f'{plant.plant_code} free service ends {plant.free_service_end:%d-%m-%Y}.',
                    category='Free Service', severity=severity, plant=plant, link=_plant_link(plant),
                )
                counts['alerts'] += int(created)
                break


def _sync_quarterly(today, counts):
    open_quarterly = OmMaintenanceTask.objects.select_related('plant', 'assigned_engineer').filter(
        source='Quarterly', plant__is_active=True,
    ).exclude(status__in=OmMaintenanceTask.CLOSED_STATUSES)

    due_soon = open_quarterly.filter(due_date__gte=today, due_date__lte=today + timedelta(days=SERVICE_DUE_DAYS))
    for task in due_soon:
        if task.status == 'Scheduled':
            task.status = 'Pending'
            task.save(update_fields=['status', 'updated_at'])
            counts['tasks_activated'] += 1
        _, created = notify(
            f'service-due-{task.pk}', f'Service due {task.due_date:%d-%m-%Y}: {task.plant.plant_name}',
            message=f'{task.plant.plant_code} • {task.title}'
                    + ('' if task.assigned_engineer_id else ' • Assign an engineer'),
            category='Service', severity='upcoming', plant=task.plant, link=f'/om/quarterly-services?task={task.pk}',
        )
        counts['alerts'] += int(created)

    for task in open_quarterly.filter(due_date__lt=today):
        if task.status == 'Scheduled':
            task.status = 'Pending'
            task.save(update_fields=['status', 'updated_at'])
        _, created = notify(
            f'service-overdue-{task.pk}', f'Service overdue: {task.plant.plant_name}',
            message=f'{task.plant.plant_code} • {task.title} was due {task.due_date:%d-%m-%Y}',
            category='Service', severity='critical', plant=task.plant, link=f'/om/quarterly-services?task={task.pk}',
        )
        counts['alerts'] += int(created)


def _sync_insurance(today, counts):
    for policy in OmInsurance.objects.select_related('plant').filter(status='Insured', expiry_date__isnull=False):
        days = (policy.expiry_date - today).days
        plant = policy.plant
        if days < 0:
            policy.status = 'Expired'
            policy.save(update_fields=['status', 'updated_at'])
            _, created = notify(
                f'ins-expired-{policy.pk}-{policy.expiry_date}', f'Insurance Expired: {plant.plant_name}',
                message=f'{plant.plant_code} • {policy.company} {policy.policy_number} expired {policy.expiry_date:%d-%m-%Y}',
                category='Insurance', severity='critical', plant=plant, link=f'/om/insurance?policy={policy.pk}',
            )
        elif days <= 7:
            _, created = notify(
                f'ins-7-{policy.pk}-{policy.expiry_date}', f'Insurance Expiring Soon: {plant.plant_name}',
                message=f'{plant.plant_code} • expires in {days} days ({policy.expiry_date:%d-%m-%Y})',
                category='Insurance', severity='critical', plant=plant, link=f'/om/insurance?policy={policy.pk}',
            )
        elif days <= 30:
            _, created = notify(
                f'ins-30-{policy.pk}-{policy.expiry_date}', f'Insurance Expiring in 30 Days: {plant.plant_name}',
                message=f'{plant.plant_code} • expires {policy.expiry_date:%d-%m-%Y}',
                category='Insurance', severity='upcoming', plant=plant, link=f'/om/insurance?policy={policy.pk}',
            )
        else:
            continue
        counts['alerts'] += int(created)


def _sync_tickets(today, counts):
    now = timezone.now()
    open_tickets = OmBreakdownTicket.objects.select_related('plant').filter(status__in=OmBreakdownTicket.OPEN_STATUSES)
    for ticket in open_tickets:
        link = f'/om/complaint-tickets?ticket={ticket.pk}'
        if not ticket.assigned_to_id and ticket.created_at <= now - timedelta(hours=UNASSIGNED_TICKET_HOURS):
            _, created = notify(
                f'ticket-unassigned-{ticket.pk}', f'Ticket unassigned: BD-{ticket.pk:04d}',
                message=ticket.subject, category='Ticket', severity='upcoming', plant=ticket.plant, link=link,
            )
            counts['alerts'] += int(created)
        if ticket.expected_visit_date and ticket.expected_visit_date < today:
            _, created = notify(
                f'ticket-overdue-{ticket.pk}-{ticket.expected_visit_date}', f'Ticket overdue: BD-{ticket.pk:04d}',
                message=f'{ticket.subject} • visit was expected {ticket.expected_visit_date:%d-%m-%Y}',
                category='Ticket', severity='critical', plant=ticket.plant, link=link,
            )
            counts['alerts'] += int(created)
        elif ticket.created_at <= now - timedelta(days=PENDING_TICKET_DAYS):
            _, created = notify(
                f'ticket-pending-{ticket.pk}', f'Ticket pending {PENDING_TICKET_DAYS}+ days: BD-{ticket.pk:04d}',
                message=ticket.subject, category='Ticket', severity='upcoming', plant=ticket.plant, link=link,
            )
            counts['alerts'] += int(created)


def _sync_tasks(today, counts):
    open_tasks = OmMaintenanceTask.objects.select_related('plant', 'assigned_engineer').filter(
        assigned_engineer__isnull=False,
    ).exclude(status__in=OmMaintenanceTask.CLOSED_STATUSES)
    for task in open_tasks:
        when = task.visit_date or task.due_date
        deadline = task.effective_deadline
        link = f'/om/my-tasks?task={task.pk}'
        if when == today:
            _, created = notify(
                f'task-due-{task.pk}-{today}', f'Task due today: {task.title}',
                message=task.plant.plant_name if task.plant_id else task.site,
                category='Task', severity='upcoming', user=task.assigned_engineer,
                module='O&M Field Work', plant=task.plant, link=link,
            )
            counts['alerts'] += int(created)
        if deadline and deadline < today:
            _, created = notify(
                f'task-overdue-{task.pk}-{deadline}', f'Task overdue: {task.title}',
                message=f'Deadline was {deadline:%d-%m-%Y}', category='Task', severity='critical',
                user=task.assigned_engineer, module='O&M Field Work', plant=task.plant, link=link,
            )
            counts['alerts'] += int(created)


def run_daily_sync(today=None):
    today = today or date.today()
    counts = {'plants_updated': 0, 'tasks_activated': 0, 'alerts': 0}
    _sync_plants(today, counts)
    _sync_quarterly(today, counts)
    _sync_insurance(today, counts)
    _sync_tickets(today, counts)
    _sync_tasks(today, counts)
    cache.set(SYNC_CACHE_KEY, timezone.now().isoformat(), timeout=None)
    return counts


def run_sync_if_stale():
    """Lazy safety net when the systemd timer isn't installed or missed a run."""
    last = cache.get(SYNC_CACHE_KEY)
    if last:
        try:
            if timezone.now() - datetime.fromisoformat(last) < timedelta(hours=SYNC_STALE_HOURS):
                return None
        except (TypeError, ValueError):
            pass
    try:
        return run_daily_sync()
    except Exception:
        logger.exception('O&M lazy sync failed')
        return None
