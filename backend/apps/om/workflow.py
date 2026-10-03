"""Ticket → Task → Site Visit → Resolution → Closure."""
import base64
import binascii
import json
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_time
from rest_framework.exceptions import ValidationError

from apps.notifications.services import notify
from .models import OmBreakdownTicket, OmMaintenanceTask, OmSiteVisit, OmVisitPart, OmDocument


def _user_label(user):
    return (user.name or user.email) if user else ''


def _date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    parsed = parse_date(str(value))
    if not parsed:
        raise ValidationError(f'Invalid date: {value}')
    return parsed


def _time(value):
    if not value:
        return None
    parsed = parse_time(str(value))
    if not parsed:
        raise ValidationError(f'Invalid time: {value}')
    return parsed


def notify_task_assigned(task):
    if not task.assigned_engineer_id:
        return
    notify(
        f'task-assigned-{task.pk}-{task.assigned_engineer_id}',
        f'Task assigned: {task.title}',
        message=' • '.join(x for x in [
            task.plant.plant_code if task.plant_id else '',
            task.plant.customer_name if task.plant_id else task.site,
            f'Visit {task.visit_date:%d-%m-%Y}' if task.visit_date else '',
        ] if x),
        category='Task', severity='upcoming' if task.priority in ('High', 'Critical') else 'info',
        user=task.assigned_engineer, module='O&M Field Work', plant=task.plant,
        link=f'/om/my-tasks?task={task.pk}',
    )


@transaction.atomic
def create_task_from_ticket(ticket, data, user):
    engineer_id = data.get('assigned_engineer') or ticket.assigned_to_id
    visit_date = _date(data.get('visit_date')) or ticket.expected_visit_date
    task = OmMaintenanceTask.objects.create(
        title=data.get('title') or f'{ticket.complaint_type or "Complaint"}: {ticket.subject}'[:255],
        plant=ticket.plant,
        ticket=ticket,
        project=ticket.project,
        site=ticket.site,
        source='Ticket',
        task_type='Corrective',
        priority=data.get('priority') or ticket.priority,
        assigned_engineer_id=engineer_id or None,
        visit_date=visit_date,
        deadline=_date(data.get('deadline')),
        due_date=visit_date,
        status='Assigned' if engineer_id else 'Pending',
        work_details=data.get('work_details') or ticket.issue_description,
        created_by=user,
    )
    changed = []
    if engineer_id and not ticket.assigned_to_id:
        ticket.assigned_to_id = engineer_id
        changed.append('assigned_to')
    if ticket.status == 'Open':
        ticket.status = 'Assigned' if engineer_id else 'In Progress'
        changed.append('status')
    if changed:
        ticket.save(update_fields=changed + ['updated_at'])
    notify_task_assigned(task)
    return task


def resolve_ticket(ticket, resolution='', close=False):
    now = timezone.now()
    if resolution:
        ticket.resolution = resolution
    if not ticket.resolved_at:
        ticket.resolved_at = now
    ticket.status = 'Closed' if close else 'Resolved'
    if close and not ticket.closed_at:
        ticket.closed_at = now
    ticket.save()
    notify(
        f'ticket-{"closed" if close else "resolved"}-{ticket.pk}',
        f'Ticket {"closed" if close else "resolved"}: BD-{ticket.pk:04d}',
        message=ticket.subject, category='Ticket', severity='info', plant=ticket.plant,
        link=f'/om/complaint-tickets?ticket={ticket.pk}',
    )
    return ticket


def _parse_json(value, default):
    if value in (None, ''):
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        raise ValidationError('Invalid JSON payload.')


def _decimal(value):
    if value in (None, ''):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValidationError(f'Invalid number: {value}')


def _signature_file(value):
    """Accepts an uploaded image or a canvas data URL (data:image/png;base64,...)."""
    if not value:
        return None
    if hasattr(value, 'read'):
        return value
    text = str(value)
    if not text.startswith('data:image/'):
        raise ValidationError({'customer_signature': 'Signature must be an image.'})
    header, _, payload = text.partition(',')
    ext = 'jpg' if 'jpeg' in header else 'png'
    try:
        raw = base64.b64decode(payload)
    except (binascii.Error, ValueError):
        raise ValidationError({'customer_signature': 'Signature image could not be read.'})
    return ContentFile(raw, name=f'signature-{uuid.uuid4().hex[:10]}.{ext}')


VISIT_TEXT_FIELDS = (
    'purpose', 'complaint', 'fault_found', 'diagnosis', 'work_done',
    'engineer_notes', 'customer_remarks', 'final_status', 'remarks',
)


@transaction.atomic
def complete_visit(data, files, user):
    """Save the engineer's service form as a permanent visit record, then
    close the linked task and ticket (Automations 8 + 9)."""
    task = None
    if data.get('task'):
        task = OmMaintenanceTask.objects.select_related('plant', 'ticket').filter(pk=data['task']).first()
        if not task:
            raise ValidationError({'task': 'Task not found.'})
    ticket = task.ticket if task and task.ticket_id else None
    if not ticket and data.get('ticket'):
        ticket = OmBreakdownTicket.objects.filter(pk=data['ticket']).first()
    plant = (task.plant if task else None) or (ticket.plant if ticket else None)
    if not plant and data.get('plant'):
        from .models import OmPlant
        plant = OmPlant.objects.filter(pk=data['plant']).first()
    if not plant:
        raise ValidationError({'plant': 'Select the plant for this visit.'})

    service_type = data.get('service_type') or (
        'Quarterly' if task and task.source == 'Quarterly' else 'Complaint' if ticket else 'Other'
    )
    visit = OmSiteVisit(
        plant=plant, task=task, ticket=ticket, project=plant.project, site=plant.plant_location,
        service_type=service_type,
        engineer=_user_label(user),
        assigned_engineer=(task.assigned_engineer if task and task.assigned_engineer_id else user),
        date=_date(data.get('date')) or date.today(),
        arrival_time=_time(data.get('arrival_time')),
        departure_time=_time(data.get('departure_time')) or timezone.localtime().time().replace(microsecond=0),
        status='Completed',
        plant_generation_kwh=_decimal(data.get('plant_generation_kwh')),
        labour_cost=_decimal(data.get('labour_cost')),
        inspection=_parse_json(data.get('inspection'), {}),
        checklist=_parse_json(data.get('checklist'), []),
        completed_at=timezone.now(),
        created_by=user,
    )
    for field in VISIT_TEXT_FIELDS:
        if data.get(field) is not None:
            setattr(visit, field, data.get(field))
    if not visit.purpose:
        visit.purpose = task.title if task else (ticket.subject if ticket else service_type)
    if not visit.complaint and ticket:
        visit.complaint = ticket.issue_description or ticket.subject
    signature = _signature_file(files.get('customer_signature') or data.get('customer_signature'))
    if signature:
        visit.customer_signature.save(signature.name, signature, save=False)
    visit.save()

    for row in _parse_json(data.get('parts'), []):
        if not row.get('material') and not row.get('description'):
            continue
        OmVisitPart.objects.create(
            visit=visit, plant=plant, ticket=ticket,
            material=row.get('material') or 'Other',
            description=row.get('description') or '',
            inventory_item_id=row.get('inventory_item') or None,
            quantity=_decimal(row.get('quantity')) or Decimal('1'),
            serial_number=row.get('serial_number') or '',
            unit_cost=_decimal(row.get('unit_cost')),
            used_by=user, used_on=visit.date,
        )

    for category, key in (('Before', 'before_photos'), ('After', 'after_photos')):
        for upload in files.getlist(key) if hasattr(files, 'getlist') else []:
            OmDocument.objects.create(
                module='Visit', related_id=visit.pk, plant=plant, category=category,
                name=f'{category} — {upload.name}'[:255], file=upload, uploaded_by=user,
            )

    if task:
        task.status = 'Completed'
        task.completed_at = timezone.now()
        task.visit_date = task.visit_date or visit.date
        task.save(update_fields=['status', 'completed_at', 'visit_date', 'updated_at'])
        notify(
            f'task-completed-{task.pk}', f'Task completed: {task.title}',
            message=f'{plant.plant_code} • {_user_label(user)}', category='Task', severity='info',
            plant=plant, link=f'/om/tasks?task={task.pk}',
        )

    if task and task.source == 'Quarterly':
        upcoming = (
            plant.tasks.filter(source='Quarterly', due_date__gt=visit.date)
            .exclude(status__in=OmMaintenanceTask.CLOSED_STATUSES).order_by('due_date').first()
        )
        visit.next_service_date = upcoming.due_date if upcoming else None
        visit.save(update_fields=['next_service_date'])

    if ticket:
        if visit.final_status in ('', 'Resolved'):
            resolve_ticket(ticket, resolution=visit.work_done, close=True)
        else:
            ticket.status = 'In Progress'
            ticket.save(update_fields=['status', 'updated_at'])
    return visit


def plant_history(plant):
    """Lifetime service history: every visit plus complaints solved on phone."""
    rows = []
    for visit in plant.visits.select_related('assigned_engineer', 'ticket', 'task').order_by('-date', '-id'):
        rows.append({
            'kind': 'visit', 'id': visit.id, 'ref': f'SV-{visit.id:04d}', 'date': visit.date,
            'type': visit.service_type, 'engineer': _user_label(visit.assigned_engineer) or visit.engineer,
            'problem': visit.fault_found or visit.complaint or (visit.ticket.subject if visit.ticket_id else ''),
            'action': visit.work_done or visit.purpose, 'status': visit.status,
            'final_status': visit.final_status,
            'ticket': f'BD-{visit.ticket_id:04d}' if visit.ticket_id else '',
            'task': f'MT-{visit.task_id:04d}' if visit.task_id else '',
        })
    visited_ticket_ids = {v.ticket_id for v in plant.visits.all() if v.ticket_id}
    for ticket in plant.tickets.select_related('assigned_to').exclude(id__in=visited_ticket_ids):
        if ticket.status not in ('Resolved', 'Closed'):
            continue
        when = ticket.resolved_at or ticket.updated_at
        rows.append({
            'kind': 'ticket', 'id': ticket.id, 'ref': f'BD-{ticket.id:04d}', 'date': when.date() if when else None,
            'type': 'Complaint (Phone)', 'engineer': _user_label(ticket.assigned_to),
            'problem': ticket.subject, 'action': ticket.resolution, 'status': ticket.status,
            'final_status': '', 'ticket': f'BD-{ticket.id:04d}', 'task': '',
        })
    rows.sort(key=lambda r: (r['date'] or date.min, r['id']), reverse=True)
    return rows
