from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission
from apps.projects.models import Project

from . import pending_flow


def _truthy(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ('1', 'true', 'yes', 'done', 'packed')


class PendingFlowViewSet(viewsets.ViewSet):
    """O&M pending-work lists: Work Orders → Quotations → Dispatch →
    Installation → Invoice, plus short-listed (short) material."""
    permission_classes = [HasModulePermission]
    permission_module = 'O&M'
    permission_action_map = {
        'summary': 'can_view',
        'work_orders': 'can_view',
        'quotations': 'can_view',
        'dispatch_list': 'can_view',
        'installation': 'can_view',
        'invoices': 'can_view',
        'materials': 'can_view',
        'mark_packed': 'can_edit',
        'installation_status': 'can_edit',
    }

    def _list(self, request, key):
        rows = pending_flow.LISTS[key](request.user)
        return Response({'count': len(rows), 'results': rows})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        return Response(pending_flow.pending_summary(request.user))

    @action(detail=False, methods=['get'], url_path='work-orders')
    def work_orders(self, request):
        return self._list(request, 'work_orders')

    @action(detail=False, methods=['get'])
    def quotations(self, request):
        return self._list(request, 'quotations')

    # Named dispatch_list: `dispatch` is APIView's request entry point.
    @action(detail=False, methods=['get'], url_path='dispatch')
    def dispatch_list(self, request):
        rows = pending_flow.pending_dispatch(request.user)
        return Response({
            'count': len(rows), 'results': rows, 'delay_days': pending_flow.DISPATCH_DELAY_DAYS,
        })

    @action(detail=False, methods=['get'])
    def installation(self, request):
        return self._list(request, 'installation')

    @action(detail=False, methods=['get'])
    def invoices(self, request):
        return self._list(request, 'invoices')

    @action(detail=False, methods=['get'])
    def materials(self, request):
        return self._list(request, 'materials')

    @action(detail=False, methods=['post'], url_path='mark-packed')
    def mark_packed(self, request):
        project_id = request.data.get('project')
        if not project_id:
            return Response({'project': 'Select a project.'}, status=status.HTTP_400_BAD_REQUEST)
        line_ids = request.data.get('lines') or None
        try:
            changed = pending_flow.set_packed(
                request.user, project_id, packed=_truthy(request.data.get('packed')), line_ids=line_ids,
            )
        except (Project.DoesNotExist, ValueError, TypeError):
            return Response({'project': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'updated': changed})

    @action(detail=False, methods=['post'], url_path='installation-status')
    def installation_status(self, request):
        project_id = request.data.get('project')
        if not project_id:
            return Response({'project': 'Select a project.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            project = pending_flow.set_installation_status(
                request.user, project_id, done=_truthy(request.data.get('done')),
            )
        except (Project.DoesNotExist, ValueError, TypeError):
            return Response({'project': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'id': project.id,
            'installation_status': project.installation_status,
            'installation_done_on': project.installation_done_on,
        })
