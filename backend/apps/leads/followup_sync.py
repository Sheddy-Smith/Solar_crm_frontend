"""Keep `Lead.next_follow_up` and Extra High alerts in sync with the timeline.

Logging a completed call (or scheduling a later date) used to leave the old
`Scheduled` row open. Extra High Alert then kept showing that past date even
though the executive had already updated the lead.
"""
from django.db.models import Q
from django.utils import timezone


def close_superseded_scheduled_follow_ups(lead):
    """Mark past Scheduled rows Missed once a later update exists.

    A row is superseded when the lead has a Completed follow-up at/after it,
    or a later Scheduled follow-up (reschedule).
    """
    now = timezone.now()
    past_scheduled = list(
        lead.follow_ups.filter(status='Scheduled', is_deleted=False, scheduled_at__lt=now)
    )
    if not past_scheduled:
        return 0

    others = lead.follow_ups.filter(is_deleted=False)
    closed = 0
    for fu in past_scheduled:
        superseded = others.exclude(pk=fu.pk).filter(
            Q(status='Completed', created_at__gte=fu.scheduled_at)
            | Q(status='Completed', completed_at__gte=fu.scheduled_at)
            | Q(status='Scheduled', scheduled_at__gt=fu.scheduled_at)
        ).exists()
        if not superseded:
            continue
        fu.status = 'Missed'
        fu.save(update_fields=['status'])
        closed += 1
    return closed


def sync_lead_next_follow_up(lead):
    """Point `lead.next_follow_up` at the earliest remaining Scheduled row."""
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
