"""API views for Manual Sync between Quotation and Material Planning."""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModulePermission
from apps.leads.models import ModuleSyncRun
from apps.leads.module_sync import (
    preview_sync,
    report_types_for_module,
    retry_failed,
    run_sync,
    serialize_run,
)


class ModuleSyncReportTypesView(APIView):
    permission_classes = [IsAuthenticated, HasModulePermission]
    permission_module = 'Quotation'

    def get(self, request):
        module = (request.query_params.get('module') or ModuleSyncRun.MODULE_QUOTATION).strip()
        if module not in (ModuleSyncRun.MODULE_QUOTATION, ModuleSyncRun.MODULE_MATERIAL_PLANNING):
            return Response({'detail': 'module must be quotation or material_planning'}, status=400)
        return Response({'module': module, 'reports': report_types_for_module(module)})


class ModuleSyncPreviewView(APIView):
    permission_classes = [IsAuthenticated, HasModulePermission]
    permission_module = 'Quotation'

    def post(self, request):
        data = request.data or {}
        try:
            result = preview_sync(
                source_module=(data.get('source_module') or '').strip(),
                destination_module=(data.get('destination_module') or '').strip(),
                report_type=(data.get('report_type') or '').strip(),
                project_id=data.get('project_id'),
                quotation_id=data.get('quotation_id'),
                bom_version_id=data.get('bom_version_id'),
                user=request.user,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result)


class ModuleSyncRunView(APIView):
    permission_classes = [IsAuthenticated, HasModulePermission]
    permission_module = 'Quotation'

    def post(self, request):
        data = request.data or {}
        try:
            run = run_sync(
                preview_token=(data.get('preview_token') or '').strip(),
                confirm=bool(data.get('confirm')),
                user=request.user,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(serialize_run(run))


class ModuleSyncHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, HasModulePermission]
    permission_module = 'Quotation'
    queryset = ModuleSyncRun.objects.select_related(
        'project', 'quotation', 'bom_version', 'started_by',
    ).all()

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        module = request.query_params.get('module')
        if module:
            qs = qs.filter(
                models_Q_source_or_dest(module)
            )
        project_id = request.query_params.get('project_id')
        if project_id:
            qs = qs.filter(project_id=project_id)
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        qs = qs[:100]
        return Response([serialize_run(run) for run in qs])

    def retrieve(self, request, *args, **kwargs):
        run = self.get_object()
        data = serialize_run(run)
        data['mappings'] = [
            {
                'id': m.id,
                'source_type': m.source_type,
                'source_id': m.source_id,
                'destination_type': m.destination_type,
                'destination_id': m.destination_id,
                'content_hash': m.content_hash,
                'status': m.status,
                'detail': m.detail,
            }
            for m in run.mappings.all()[:500]
        ]
        return Response(data)

    @action(detail=True, methods=['post'], url_path='retry-failed')
    def retry_failed_action(self, request, pk=None):
        try:
            run = retry_failed(pk, user=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(serialize_run(run))


def models_Q_source_or_dest(module: str):
    from django.db.models import Q
    return Q(source_module=module) | Q(destination_module=module)
