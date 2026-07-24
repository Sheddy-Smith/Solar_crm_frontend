"""Soft-delete helpers for CRM Recycle Bin (CRM + Tele portal deletes)."""
from datetime import timedelta

from django.utils import timezone

from .models import FollowUp, Lead, Quotation

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


def soft_delete_quotation(quotation, user):
    now = timezone.now()
    quotation.is_deleted = True
    quotation.deleted_at = now
    quotation.deleted_by = user
    quotation.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'updated_at'])
    return quotation


def restore_quotation(quotation):
    quotation.is_deleted = False
    quotation.deleted_at = None
    quotation.deleted_by = None
    quotation.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'updated_at'])
    return quotation


def soft_delete_project(project, user):
    now = timezone.now()
    project.is_deleted = True
    project.deleted_at = now
    project.deleted_by = user
    project.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'updated_at'])
    return project


def restore_project(project):
    project.is_deleted = False
    project.deleted_at = None
    project.deleted_by = None
    project.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'updated_at'])
    return project


def recycle_cutoff():
    return timezone.now() - timedelta(days=RECYCLE_RETENTION_DAYS)


def _hard_delete_soft_deleted(filter_extra=None):
    """Permanently delete soft-deleted records. Optional extra Q/dict filters."""
    from apps.projects.models import Project

    extra = filter_extra or {}
    # Children / dependents first, then parents.
    fu_qs = FollowUp.objects.filter(is_deleted=True, **extra)
    fu_count = fu_qs.count()
    fu_qs.delete()

    quotation_qs = Quotation.objects.filter(is_deleted=True, **extra)
    quotation_count = quotation_qs.count()
    quotation_qs.delete()

    project_qs = Project.objects.filter(is_deleted=True, **extra)
    project_count = project_qs.count()
    project_qs.delete()

    lead_qs = Lead.objects.filter(is_deleted=True, **extra)
    lead_count = lead_qs.count()
    lead_qs.delete()

    return {
        'leads': lead_count,
        'follow_ups': fu_count,
        'quotations': quotation_count,
        'projects': project_count,
    }


def purge_expired_recycle_items():
    """Permanently delete soft-deleted records older than retention."""
    return _hard_delete_soft_deleted({'deleted_at__lte': recycle_cutoff()})


def empty_recycle_bin():
    """Permanently delete every soft-deleted record in the recycle bin."""
    return _hard_delete_soft_deleted()
