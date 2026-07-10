from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission

from .services import reports_dashboard


class ReportsViewSet(viewsets.ViewSet):
    # BUG-017: this viewset only serves the cross-module reports dashboard
    # (`/reports/dashboard/`). Gate it with the 'Dashboard' matrix module so
    # the Dashboard permission row actually applies; detailed report exports
    # would use 'Reports' if added later as separate endpoints.
    permission_classes = [HasModulePermission]
    permission_module = 'Dashboard'
    permission_action_map = {'dashboard': 'can_view'}

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        return Response(reports_dashboard(date_from=date_from, date_to=date_to))
