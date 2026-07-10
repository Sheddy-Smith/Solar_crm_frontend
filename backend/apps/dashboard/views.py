from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModulePermission

from .services import get_unified_dashboard


class UnifiedDashboardView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = 'Dashboard'
    permission_method_map = {'GET': 'can_view'}

    def get(self, request):
        params = {
            'date_from': request.query_params.get('date_from'),
            'date_to': request.query_params.get('date_to'),
            'project_type': request.query_params.get('project_type'),
            'status': request.query_params.get('status'),
            'assigned_to': request.query_params.get('assigned_to'),
        }
        return Response(get_unified_dashboard(params))
