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
        # Payload is org-wide aggregates (CACHE_SCOPE=crm_global_v1). Do not
        # key by user id — that would fragment the cache and does not add
        # isolation while the builder ignores request.user. Auth + module
        # permission still gate access. If builder becomes user-scoped, pass
        # a stable viewer fingerprint into get_unified_dashboard().
        return Response(get_unified_dashboard(params))
