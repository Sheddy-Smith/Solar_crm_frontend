"""Auto-create / sync Daily Task + Staff Task + CRM notification for Commissioning."""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.daily_tasks.models import DailyTask, StaffDailyTask
from apps.notifications.services import notify


def _project_bits(project):
    return {
        'project_id': getattr(project, 'project_id', '') or '',
        'project_name': getattr(project, 'project_name', '') or '',
        'customer_name': getattr(project, 'customer_name', '') or '',
        'site_address': getattr(project, 'site_address', '') or getattr(project, 'site', '') or '',
    }


def _task_title(bits):
    return f"Complete Solar Plant Commissioning — {bits['project_name'] or bits['project_id'] or 'Project'}"


def _task_description(commissioning, bits):
    date_label = commissioning.date.isoformat() if commissioning.date else 'TBD'
    return (
        f"New Commissioning Task Assigned\n"
        f"Project: {bits['project_name']}\n"
        f"Project ID: {bits['project_id']}\n"
        f"Customer: {bits['customer_name']}\n"
        f"Site Address: {bits['site_address'] or '—'}\n"
        f"Commissioning Date: {date_label}\n"
        f"Engineer: {commissioning.engineer or '—'}\n"
        f"Remarks: {(commissioning.remarks or '').strip() or '—'}\n\n"
        f"Please complete the assigned task as per schedule."
    )


@transaction.atomic
def sync_commissioning_tasks(commissioning, *, actor=None):
    """Create or update linked DailyTask / StaffDailyTask / Notification."""
    project = commissioning.project
    bits = _project_bits(project)
    title = _task_title(bits)
    description = _task_description(commissioning, bits)
    due = commissioning.date or timezone.localdate()
    employee = commissioning.assigned_employee

    if commissioning.status == 'Cancelled':
        _cancel_linked_tasks(commissioning)
        return commissioning

    # Daily Task (Employee-assigned operational log)
    details = {
        **bits,
        'commissioning_id': commissioning.id,
        'engineer': commissioning.engineer or '',
        'commissioning_date': due.isoformat(),
        'remarks': commissioning.remarks or '',
        'work_done': description,
        'project_label': bits['project_name'],
    }
    if commissioning.daily_task_id:
        task = commissioning.daily_task
        task.task_date = due
        task.assigned_to = employee
        task.status = 'Completed' if commissioning.status == 'Completed' else 'Pending'
        task.notes = description
        task.details = details
        task.category = 'commissioning'
        task.save()
    else:
        task = DailyTask.objects.create(
            category='commissioning',
            task_date=due,
            status='Completed' if commissioning.status == 'Completed' else 'Pending',
            notes=description,
            details=details,
            assigned_to=employee,
            created_by=actor,
        )
        commissioning.daily_task = task

    # Staff Daily Task + CRM notification when employee has a CRM login
    user = getattr(employee, 'user', None) if employee else None
    if user:
        if commissioning.staff_task_id:
            st = commissioning.staff_task
            st.title = title[:255]
            st.description = description
            st.assigned_to = user
            st.task_date = due
            st.due_date = due
            if commissioning.status == 'Completed':
                st.status = StaffDailyTask.STATUS_COMPLETED
            elif st.status != StaffDailyTask.STATUS_COMPLETED:
                st.status = StaffDailyTask.STATUS_NOT_COMPLETED
            st.save()
        else:
            st = StaffDailyTask.objects.create(
                title=title[:255],
                description=description,
                assigned_by=actor,
                assigned_to=user,
                task_date=due,
                due_date=due,
                status=StaffDailyTask.STATUS_COMPLETED if commissioning.status == 'Completed' else StaffDailyTask.STATUS_NOT_COMPLETED,
            )
            commissioning.staff_task = st

        notify(
            dedupe_key=f'lc-commissioning-task:{commissioning.id}:{user.id}',
            title='New Commissioning Task Assigned',
            message=description,
            category='Task',
            severity='info',
            module='Daily Tasks',
            user=user,
            link='/daily-tasks',
            channel='crm',
        )
        # Push channel row for mobile clients (dispatcher can pick up later).
        notify(
            dedupe_key=f'lc-commissioning-push:{commissioning.id}:{user.id}',
            title='New Commissioning Task Assigned',
            message=(
                f"Project: {bits['project_name']}\n"
                f"Project ID: {bits['project_id']}\n"
                f"Task: Complete Solar Plant Commissioning\n"
                f"Commissioning Date: {due.isoformat()}"
            ),
            category='Task',
            severity='info',
            module='Daily Tasks',
            user=user,
            link='/daily-tasks',
            channel='push',
        )

    commissioning.engineer = (employee.name if employee else commissioning.engineer) or ''
    commissioning.save(update_fields=[
        'engineer', 'daily_task', 'staff_task', 'updated_at',
    ])
    return commissioning


def _cancel_linked_tasks(commissioning):
    if commissioning.daily_task_id:
        DailyTask.objects.filter(pk=commissioning.daily_task_id).update(status='Completed', notes='Commissioning cancelled')
    if commissioning.staff_task_id:
        StaffDailyTask.objects.filter(pk=commissioning.staff_task_id).update(
            status=StaffDailyTask.STATUS_COMPLETED,
            description='Commissioning cancelled — task closed.',
        )


def delete_commissioning_tasks(commissioning):
    daily_id = commissioning.daily_task_id
    staff_id = commissioning.staff_task_id
    if daily_id:
        DailyTask.objects.filter(pk=daily_id).delete()
    if staff_id:
        StaffDailyTask.objects.filter(pk=staff_id).delete()
