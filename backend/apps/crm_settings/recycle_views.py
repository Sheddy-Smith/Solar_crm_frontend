"""CRM Settings → Recycle Bin API (soft-deleted CRM records)."""
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission, is_super_admin
from apps.leads.models import FollowUp, Lead, Quotation
from apps.leads.recycle import (
    RECYCLE_RETENTION_DAYS,
    empty_recycle_bin,
    purge_expired_recycle_items,
    restore_follow_up,
    restore_lead,
    restore_project,
    restore_quotation,
)
from apps.projects.models import Project


class SettingsPermissionMixin:
    permission_classes = [HasModulePermission]
    permission_module = 'Settings'
    permission_action_map = {
        'list': 'can_view',
        'retrieve': 'can_view',
        'create': 'can_add',
        'update': 'can_edit',
        'partial_update': 'can_edit',
        'destroy': 'can_delete',
        'purge': 'can_delete',
        'empty': 'can_delete',
        'restore': 'can_edit',
    }


def _days_left(deleted_at):
    if not deleted_at:
        return RECYCLE_RETENTION_DAYS
    expires = deleted_at + timedelta(days=RECYCLE_RETENTION_DAYS)
    remaining = (expires - timezone.now()).days
    return max(0, remaining)


def _deleted_source(user):
    """Label whether the delete came from Tele Portal or CRM."""
    role = getattr(getattr(user, 'role', None), 'name', '') or ''
    if role == 'Tele Sales Executive':
        return 'Tele Portal'
    return 'CRM'


def _require_super_admin(request):
    if not is_super_admin(request.user):
        return Response(
            {'detail': 'Only Super Admin can permanently delete recycle bin items.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _serialize_lead(lead):
    return {
        'id': f'lead-{lead.id}',
        'entity_type': 'Lead',
        'object_id': lead.id,
        'title': lead.customer_name or f'Lead #{lead.id}',
        'subtitle': lead.mobile_number or lead.ivrs_number or '',
        'meta': {
            'project_name': lead.project_name or '',
            'status': lead.status,
            'ivrs_number': lead.ivrs_number or '',
        },
        'deleted_at': lead.deleted_at.isoformat() if lead.deleted_at else None,
        'deleted_by': lead.deleted_by_id,
        'deleted_by_name': getattr(lead.deleted_by, 'name', None) or '—',
        'days_left': _days_left(lead.deleted_at),
        'source': _deleted_source(lead.deleted_by),
    }


def _serialize_follow_up(item):
    lead = item.lead
    return {
        'id': f'followup-{item.id}',
        'entity_type': 'Follow-up',
        'object_id': item.id,
        'title': f'{item.follow_up_type} — {getattr(lead, "customer_name", "Lead")}',
        'subtitle': getattr(lead, 'mobile_number', '') or '',
        'meta': {
            'status': item.status,
            'scheduled_at': item.scheduled_at.isoformat() if item.scheduled_at else None,
            'lead_id': lead.id if lead else None,
        },
        'deleted_at': item.deleted_at.isoformat() if item.deleted_at else None,
        'deleted_by': item.deleted_by_id,
        'deleted_by_name': getattr(item.deleted_by, 'name', None) or '—',
        'days_left': _days_left(item.deleted_at),
        'source': _deleted_source(item.deleted_by),
    }


def _serialize_quotation(item):
    lead = item.lead
    return {
        'id': f'quotation-{item.id}',
        'entity_type': 'Quotation',
        'object_id': item.id,
        'title': item.quotation_number or f'Quotation #{item.id}',
        'subtitle': getattr(lead, 'customer_name', '') or item.company_name or '',
        'meta': {
            'status': item.status,
            'grand_total': str(item.grand_total or 0),
            'lead_id': lead.id if lead else None,
        },
        'deleted_at': item.deleted_at.isoformat() if item.deleted_at else None,
        'deleted_by': item.deleted_by_id,
        'deleted_by_name': getattr(item.deleted_by, 'name', None) or '—',
        'days_left': _days_left(item.deleted_at),
        'source': _deleted_source(item.deleted_by),
    }


def _serialize_project(item):
    return {
        'id': f'project-{item.id}',
        'entity_type': 'Project',
        'object_id': item.id,
        'title': item.project_name or item.project_id or f'Project #{item.id}',
        'subtitle': item.customer_name or item.project_id or '',
        'meta': {
            'status': item.status,
            'project_id': item.project_id or '',
            'capacity_kwp': str(item.capacity_kwp or 0),
        },
        'deleted_at': item.deleted_at.isoformat() if item.deleted_at else None,
        'deleted_by': item.deleted_by_id,
        'deleted_by_name': getattr(item.deleted_by, 'name', None) or '—',
        'days_left': _days_left(item.deleted_at),
        'source': _deleted_source(item.deleted_by),
    }


class RecycleBinViewSet(SettingsPermissionMixin, viewsets.ViewSet):
    """List / restore / permanently delete soft-deleted CRM records."""

    permission_action_map = {
        **SettingsPermissionMixin.permission_action_map,
        'purge': 'can_delete',
        'empty': 'can_delete',
        'restore': 'can_edit',
    }

    def list(self, request):
        purge_expired_recycle_items()
        entity = (request.query_params.get('entity_type') or '').strip()
        search = (request.query_params.get('search') or '').strip().lower()

        items = []
        if entity in ('', 'Lead', 'All'):
            leads = Lead.objects.filter(is_deleted=True).select_related(
                'deleted_by', 'deleted_by__role', 'created_by',
            )
            if search:
                leads = leads.filter(
                    Q(customer_name__icontains=search)
                    | Q(mobile_number__icontains=search)
                    | Q(ivrs_number__icontains=search)
                    | Q(project_name__icontains=search)
                )
            items.extend(_serialize_lead(lead) for lead in leads)

        if entity in ('', 'Follow-up', 'FollowUp', 'All'):
            follow_ups = FollowUp.objects.filter(is_deleted=True).select_related(
                'deleted_by', 'deleted_by__role', 'lead',
            )
            if search:
                follow_ups = follow_ups.filter(
                    Q(lead__customer_name__icontains=search)
                    | Q(lead__mobile_number__icontains=search)
                    | Q(notes__icontains=search)
                    | Q(follow_up_type__icontains=search)
                )
            items.extend(_serialize_follow_up(item) for item in follow_ups)

        if entity in ('', 'Quotation', 'All'):
            quotations = Quotation.objects.filter(is_deleted=True).select_related(
                'deleted_by', 'deleted_by__role', 'lead',
            )
            if search:
                quotations = quotations.filter(
                    Q(quotation_number__icontains=search)
                    | Q(company_name__icontains=search)
                    | Q(lead__customer_name__icontains=search)
                    | Q(lead__mobile_number__icontains=search)
                )
            items.extend(_serialize_quotation(item) for item in quotations)

        if entity in ('', 'Project', 'All'):
            projects = Project.objects.filter(is_deleted=True).select_related(
                'deleted_by', 'deleted_by__role',
            )
            if search:
                projects = projects.filter(
                    Q(project_name__icontains=search)
                    | Q(customer_name__icontains=search)
                    | Q(project_id__icontains=search)
                    | Q(site__icontains=search)
                )
            items.extend(_serialize_project(item) for item in projects)

        items.sort(key=lambda row: row.get('deleted_at') or '', reverse=True)
        return Response({
            'retention_days': RECYCLE_RETENTION_DAYS,
            'count': len(items),
            'results': items,
        })

    @action(detail=False, methods=['post'])
    def restore(self, request):
        entity_type = (request.data.get('entity_type') or '').strip()
        object_id = request.data.get('object_id')
        if not entity_type or object_id is None:
            return Response({'detail': 'entity_type and object_id are required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            object_id = int(object_id)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid object_id.'}, status=status.HTTP_400_BAD_REQUEST)

        if entity_type == 'Lead':
            try:
                lead = Lead.objects.get(pk=object_id, is_deleted=True)
            except Lead.DoesNotExist:
                return Response({'detail': 'Lead not found in recycle bin.'}, status=status.HTTP_404_NOT_FOUND)
            restore_lead(lead)
            return Response({'detail': 'Lead restored.', 'id': f'lead-{lead.id}'})

        if entity_type in ('Follow-up', 'FollowUp'):
            try:
                item = FollowUp.objects.get(pk=object_id, is_deleted=True)
            except FollowUp.DoesNotExist:
                return Response({'detail': 'Follow-up not found in recycle bin.'}, status=status.HTTP_404_NOT_FOUND)
            if item.lead_id and Lead.objects.filter(pk=item.lead_id, is_deleted=True).exists():
                return Response(
                    {'detail': 'Restore the parent lead first, then this follow-up.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            restore_follow_up(item)
            return Response({'detail': 'Follow-up restored.', 'id': f'followup-{item.id}'})

        if entity_type == 'Quotation':
            try:
                item = Quotation.objects.get(pk=object_id, is_deleted=True)
            except Quotation.DoesNotExist:
                return Response({'detail': 'Quotation not found in recycle bin.'}, status=status.HTTP_404_NOT_FOUND)
            if item.lead_id and Lead.objects.filter(pk=item.lead_id, is_deleted=True).exists():
                return Response(
                    {'detail': 'Restore the parent lead first, then this quotation.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            restore_quotation(item)
            return Response({'detail': 'Quotation restored.', 'id': f'quotation-{item.id}'})

        if entity_type == 'Project':
            try:
                item = Project.objects.get(pk=object_id, is_deleted=True)
            except Project.DoesNotExist:
                return Response({'detail': 'Project not found in recycle bin.'}, status=status.HTTP_404_NOT_FOUND)
            restore_project(item)
            return Response({'detail': 'Project restored.', 'id': f'project-{item.id}'})

        return Response({'detail': 'Unsupported entity_type.'}, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        """Permanent delete — Super Admin only. pk format `lead-<id>` / `followup-<id>` / …"""
        denied = _require_super_admin(request)
        if denied:
            return denied

        key = pk or ''
        if key.startswith('lead-'):
            try:
                lead_id = int(key.split('-', 1)[1])
                lead = Lead.objects.get(pk=lead_id, is_deleted=True)
            except (ValueError, Lead.DoesNotExist):
                return Response({'detail': 'Lead not found in recycle bin.'}, status=status.HTTP_404_NOT_FOUND)
            lead.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        if key.startswith('followup-'):
            try:
                fu_id = int(key.split('-', 1)[1])
                item = FollowUp.objects.get(pk=fu_id, is_deleted=True)
            except (ValueError, FollowUp.DoesNotExist):
                return Response({'detail': 'Follow-up not found in recycle bin.'}, status=status.HTTP_404_NOT_FOUND)
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        if key.startswith('quotation-'):
            try:
                q_id = int(key.split('-', 1)[1])
                item = Quotation.objects.get(pk=q_id, is_deleted=True)
            except (ValueError, Quotation.DoesNotExist):
                return Response({'detail': 'Quotation not found in recycle bin.'}, status=status.HTTP_404_NOT_FOUND)
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        if key.startswith('project-'):
            try:
                p_id = int(key.split('-', 1)[1])
                item = Project.objects.get(pk=p_id, is_deleted=True)
            except (ValueError, Project.DoesNotExist):
                return Response({'detail': 'Project not found in recycle bin.'}, status=status.HTTP_404_NOT_FOUND)
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        return Response({'detail': 'Invalid recycle bin item id.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def purge(self, request):
        denied = _require_super_admin(request)
        if denied:
            return denied
        result = purge_expired_recycle_items()
        return Response({'detail': 'Expired items purged.', **result})

    @action(detail=False, methods=['post'])
    def empty(self, request):
        """Permanently delete all recycle-bin items — Super Admin only."""
        denied = _require_super_admin(request)
        if denied:
            return denied
        result = empty_recycle_bin()
        return Response({'detail': 'Recycle bin emptied.', **result})
