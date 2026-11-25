from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import (
    HasModulePermission,
    can_manage_leads,
    is_lead_scoped,
    is_super_admin,
)

from .services import get_unified_dashboard


def _can_filter_teammate(user):
    """Managers / Assign-capable roles may filter dashboard by another assignee."""
    if is_super_admin(user):
        return True
    if can_manage_leads(user):
        return True
    role_name = (getattr(getattr(user, 'role', None), 'name', '') or '').strip().lower()
    return role_name in ('admin', 'branch manager', 'team leader')


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

            # Lead-scoped executives: always own-lead KPIs (created_by | assigned_to).
            # Ignore ?assigned_to= IDOR and strip org-wide embeds in the builder.
            if is_lead_scoped(user):
                params['assigned_to'] = None
                viewer_fingerprint = f'u{user.id}:owned'
            elif not full_access:
                requested = params.get('assigned_to')
                if requested and str(requested) != str(user.id) and not _can_filter_teammate(user):
                    raise PermissionDenied('You cannot filter the dashboard for another user.')
                if not requested:
                    params['assigned_to'] = str(user.id)
                viewer_fingerprint = f'u{user.id}'

        return Response(
            get_unified_dashboard(params, viewer_fingerprint=viewer_fingerprint, user=user)
        )
