from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModulePermission, is_super_admin

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
        user = request.user
        viewer_fingerprint = ''
        # Super Admin / Dashboard full_access keep org-wide aggregates.
        # Other viewers are scoped to their own assigned leads unless they
        # explicitly pass assigned_to (managers filtering a teammate).
        if user and user.is_authenticated and not is_super_admin(user):
            role = getattr(user, 'role', None)
            perm = None
            if role is not None:
                perm_map = getattr(request, '_role_perm_by_module', None)
                if perm_map is None:
                    perm_map = {p.module: p for p in role.permissions.all()}
                    request._role_perm_by_module = perm_map
                perm = perm_map.get('Dashboard')
            full_access = bool(perm and (perm.full_access or False))
            if not full_access:
                if not params.get('assigned_to'):
                    params['assigned_to'] = str(user.id)
                viewer_fingerprint = f'u{user.id}'
        return Response(get_unified_dashboard(params, viewer_fingerprint=viewer_fingerprint))
