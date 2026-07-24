"""CRM Settings → Recycle Bin API (soft-deleted leads & follow-ups)."""
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission
from apps.leads.models import FollowUp, Lead
from apps.leads.recycle import (
    RECYCLE_RETENTION_DAYS,
    purge_expired_recycle_items,
    restore_follow_up,
    restore_lead,
)


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


class RecycleBinViewSet(SettingsPermissionMixin, viewsets.ViewSet):
    """List / restore / permanently delete soft-deleted CRM records."""

    permission_action_map = {
        **SettingsPermissionMixin.permission_action_map,
        'purge': 'can_delete',
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

        return Response({'detail': 'Unsupported entity_type.'}, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        """Permanent delete: pk format `lead-<id>` or `followup-<id>`."""
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

        return Response({'detail': 'Invalid recycle bin item id.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def purge(self, request):
        result = purge_expired_recycle_items()
        return Response({'detail': 'Expired items purged.', **result})
