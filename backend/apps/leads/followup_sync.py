"""Keep `Lead.next_follow_up` and Extra High alerts in sync with the timeline.

Logging a completed call (or scheduling a later date) used to leave the old
`Scheduled` row open. Extra High Alert then kept showing that past date even
though the executive had already updated the lead.
"""
from django.db.models import Q
from django.utils import timezone

CLOSED_LEAD_STATUSES = ('Won', 'Lost')


def close_scheduled_follow_ups_for_closed_lead(lead):
    """Won/Lost leads should leave High Alert / Extra High — close open schedules."""
    if not lead or lead.status not in CLOSED_LEAD_STATUSES:
        return 0
    now = timezone.now()
    open_rows = list(
        lead.follow_ups.filter(status='Scheduled', is_deleted=False)
    )
    if not open_rows:
        if lead.next_follow_up is not None:
            lead.next_follow_up = None
            lead.save(update_fields=['next_follow_up'])
        return 0

    note = f'Auto-closed — lead marked {lead.status}'
    closed = 0
    for fu in open_rows:
        fu.status = 'Completed'
        fu.completed_at = now
        if not (fu.outcome or '').strip():
            fu.outcome = note
        fu.save(update_fields=['status', 'completed_at', 'outcome'])
        closed += 1

    if lead.next_follow_up is not None:
        lead.next_follow_up = None
        lead.save(update_fields=['next_follow_up'])
    return closed


SUPERSEDED_NOTE = 'Replaced by a newer follow-up'


def close_superseded_scheduled_follow_ups(lead):
    """Close Scheduled rows once a later update exists on the lead.

    A row is superseded when the lead has a Completed follow-up at/after it,
    a later Scheduled follow-up (reschedule), or any call/visit logged after the
    row was created — the latest update is the plan that counts. Notes never
    replace a planned follow-up.

    Past-due rows become Missed; replaced future rows are closed as Completed
    so they never surface in High / Extra High alerts on their old date.
    """
    now = timezone.now()
    open_rows = list(lead.follow_ups.filter(status='Scheduled', is_deleted=False))
    if not open_rows:
        return 0

    others = lead.follow_ups.filter(is_deleted=False)
    closed = 0
    for fu in open_rows:
        candidates = others.exclude(pk=fu.pk)
        is_past = bool(fu.scheduled_at and fu.scheduled_at < now)
        superseded = candidates.filter(
            created_at__gt=fu.created_at,
            status__in=['Completed', 'Scheduled'],
        ).exclude(follow_up_type='Note').exists()
        if not superseded and is_past:
            superseded = candidates.filter(
                Q(status='Completed', created_at__gte=fu.scheduled_at)
                | Q(status='Completed', completed_at__gte=fu.scheduled_at)
                | Q(status='Scheduled', scheduled_at__gt=fu.scheduled_at)
            ).exists()
        if not superseded:
            continue
        if is_past:
            fu.status = 'Missed'
            fu.save(update_fields=['status'])
        else:
            fu.status = 'Completed'
            fu.completed_at = now
            if not (fu.outcome or '').strip():
                fu.outcome = SUPERSEDED_NOTE
            fu.save(update_fields=['status', 'completed_at', 'outcome'])
        closed += 1
    return closed


def _local_date(value):
    if value is None:
        return None
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return value.date()


def _follow_up_moment(value):
    """Keep a date-only form value on that calendar day at 10:00 local."""
    if value is None:
        return None
    local = timezone.localtime(value) if timezone.is_aware(value) else timezone.make_aware(value)
    if local.hour == 0 and local.minute == 0 and local.second == 0:
        local = local.replace(hour=10, minute=0, second=0, microsecond=0)
    return local


def reschedule_open_follow_ups(lead, new_when):
    """Move the open plan when the lead follow-up date itself is edited.

    High Alert / Extra High Alert read the Scheduled row, not only
    `lead.next_follow_up`. A date change on the lead form has to move that
    row, otherwise the old day stays on the alert.
    """
    if not lead:
        return 0
    rows = list(
        lead.follow_ups.filter(status='Scheduled', is_deleted=False).order_by('scheduled_at', 'id')
    )
    now = timezone.now()
    if new_when is None:
        closed = 0
        for fu in rows:
            fu.status = 'Completed'
            fu.completed_at = now
            if not (fu.outcome or '').strip():
                fu.outcome = 'Follow-up date cleared'
            fu.save(update_fields=['status', 'completed_at', 'outcome'])
            closed += 1
        return closed

    moment = _follow_up_moment(new_when)
    if not rows:
        lead.follow_ups.create(
            follow_up_type='Call',
            scheduled_at=moment,
            status='Scheduled',
            notes='Follow-up date updated.',
        )
        return 1

    primary = rows[-1]
    primary.scheduled_at = moment
    primary.save(update_fields=['scheduled_at'])
    closed = 0
    for fu in rows[:-1]:
        if fu.scheduled_at and fu.scheduled_at < now:
            fu.status = 'Missed'
            fu.save(update_fields=['status'])
        else:
            fu.status = 'Completed'
            fu.completed_at = now
            if not (fu.outcome or '').strip():
                fu.outcome = SUPERSEDED_NOTE
            fu.save(update_fields=['status', 'completed_at', 'outcome'])
        closed += 1
    return closed + 1


def align_alerts_to_lead_follow_up_date(lead, previous_next):
    """Drop or move alerts when the lead follow-up date changes."""
    if not lead or getattr(lead, '_aligning_follow_up', False):
        return
    if _local_date(previous_next) == _local_date(lead.next_follow_up):
        return
    lead._aligning_follow_up = True
    try:
        reschedule_open_follow_ups(lead, lead.next_follow_up)
        sync_lead_next_follow_up(lead)
    finally:
        lead._aligning_follow_up = False


def sync_lead_next_follow_up(lead):
    """Point `lead.next_follow_up` at the earliest remaining Scheduled row."""
    if lead and lead.status in CLOSED_LEAD_STATUSES:
        close_scheduled_follow_ups_for_closed_lead(lead)
        return None
    close_superseded_scheduled_follow_ups(lead)
    next_scheduled = (
        lead.follow_ups.filter(status='Scheduled', is_deleted=False)
        .order_by('scheduled_at')
        .values_list('scheduled_at', flat=True)
        .first()
    )
    if lead.next_follow_up != next_scheduled:
        lead.next_follow_up = next_scheduled
        lead.save(update_fields=['next_follow_up'])
    return next_scheduled
