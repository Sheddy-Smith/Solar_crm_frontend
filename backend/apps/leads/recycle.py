"""Soft-delete helpers for CRM Recycle Bin (CRM + Tele portal deletes)."""
from datetime import timedelta

from django.utils import timezone

from .models import FollowUp, Lead

RECYCLE_RETENTION_DAYS = 30


def soft_delete_lead(lead, user):
    now = timezone.now()
    lead.is_deleted = True
    lead.deleted_at = now
    lead.deleted_by = user
    lead.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'updated_at'])
    return lead


def restore_lead(lead):
    lead.is_deleted = False
    lead.deleted_at = None
    lead.deleted_by = None
    lead.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'updated_at'])
    return lead


def soft_delete_follow_up(follow_up, user):
    now = timezone.now()
    follow_up.is_deleted = True
    follow_up.deleted_at = now
    follow_up.deleted_by = user
    follow_up.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])
    return follow_up


def restore_follow_up(follow_up):
    follow_up.is_deleted = False
    follow_up.deleted_at = None
    follow_up.deleted_by = None
    follow_up.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])
    return follow_up


def recycle_cutoff():
    return timezone.now() - timedelta(days=RECYCLE_RETENTION_DAYS)


def purge_expired_recycle_items():
    """Permanently delete soft-deleted leads/follow-ups older than retention."""
    cutoff = recycle_cutoff()
    # Follow-ups first (FK to leads); then leads.
    fu_qs = FollowUp.objects.filter(is_deleted=True, deleted_at__lte=cutoff)
    fu_count = fu_qs.count()
    fu_qs.delete()
    lead_qs = Lead.objects.filter(is_deleted=True, deleted_at__lte=cutoff)
    lead_count = lead_qs.count()
    lead_qs.delete()
    return {'leads': lead_count, 'follow_ups': fu_count}
