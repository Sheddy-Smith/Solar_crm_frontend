from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission

from .services import reports_dashboard


class ReportsViewSet(viewsets.ViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Reports'
    permission_action_map = {'dashboard': 'can_view'}

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        return Response(reports_dashboard(date_from=date_from, date_to=date_to))
