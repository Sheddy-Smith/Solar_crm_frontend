from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Q, Prefetch
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    OmAsset, OmMaintenanceTask, OmBreakdownTicket,
    OmSiteVisit, OmSparePart, OmReport, OmDocument,
    OmPlant, OmVisitPart, OmInsurance,
)
from .serializers import (
    OmAssetSerializer, OmMaintenanceTaskSerializer, OmBreakdownTicketSerializer,
    OmSiteVisitSerializer, OmSparePartSerializer, OmReportSerializer, OmDocumentSerializer,
    OmPlantSerializer, OmVisitPartSerializer, OmInsuranceSerializer,
)
from .permissions import OmOrFieldWorkPermission, has_full_om_access
from apps.accounts.permissions import HasModulePermission, lead_owner_filter
from apps.inventory.models import InventoryItem


def _sync_inventory_requested(value):
    return str(value).lower() in ('1', 'true', 'yes')


def _maybe_sync_linked_inventory(spare_part, sync=False):
    """When requested, mirror spare-part stock onto the linked inventory row (BUG-069)."""
    if not sync or not spare_part.linked_inventory_item_id:
        return
    InventoryItem.objects.filter(pk=spare_part.linked_inventory_item_id).update(
        current_stock=Decimal(spare_part.stock_qty),
    )


class OmBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [OmOrFieldWorkPermission]
    permission_module = 'O&M'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering = ['-created_at']
    # Engineers with only "O&M Field Work" may use these actions, scoped to their own work.
    field_work_actions = ()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _scope(self, qs, prefix='project__lead__'):
        # Sales / Tele Sales Executives only see O&M records tied to their
        # own leads' projects.
        filt = lead_owner_filter(self.request.user, prefix=prefix)
        return qs.filter(**filt) if filt else qs

    def _field_only(self):
        return not has_full_om_access(self.request.user)


class OmAssetViewSet(OmBaseViewSet):
    serializer_class = OmAssetSerializer
    filterset_fields = ['project', 'status', 'asset_type']
    search_fields = ['name', 'site', 'manufacturer', 'project__project_name']

    def get_queryset(self):
        return self._scope(OmAsset.objects.select_related('project', 'created_by').all())


class OmPlantViewSet(OmBaseViewSet):
    serializer_class = OmPlantSerializer
    field_work_actions = ('retrieve', 'history')
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'commissioning_date', 'free_service_end', 'capacity_kw', 'customer_name']

    def get_queryset(self):
        from .dashboard import filter_plants
        qs = OmPlant.objects.select_related('project', 'lead', 'customer', 'amc_contract').prefetch_related(
            'tasks', 'tickets', 'insurances', 'visits',
        )
        qs = self._scope(qs)
        if self._field_only():
            qs = qs.filter(tasks__assigned_engineer=self.request.user).distinct()
        if self.action == 'list':
            qs = filter_plants(qs, self.request.query_params)
        return qs

    def create(self, request, *args, **kwargs):
        """Manual activation for a project whose commissioning was recorded elsewhere."""
        from apps.projects.models import Project
        from .services import activate_plant
        project = Project.objects.filter(pk=request.data.get('project'), is_deleted=False).first()
        if not project:
            raise ValidationError({'project': 'Select a project.'})
        commissioning_date = request.data.get('commissioning_date')
        if not commissioning_date:
            raise ValidationError({'commissioning_date': 'Commissioning date is required.'})
        plant, created = activate_plant(project, date.fromisoformat(str(commissioning_date)), user=request.user)
        data = self.get_serializer(self.get_queryset().get(pk=plant.pk)).data
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        from .workflow import plant_history
        return Response(plant_history(self.get_object()))

    @action(detail=True, methods=['post'], url_path='refresh')
    def refresh(self, request, pk=None):
        """Re-pull blank fields from the project; an optional new commissioning
        date also moves the free-service window and unvisited quarterly dates."""
        from .services import activate_plant
        plant = self.get_object()
        new_date = request.data.get('commissioning_date')
        try:
            commissioning_date = date.fromisoformat(str(new_date)) if new_date else plant.commissioning_date
        except ValueError:
            raise ValidationError({'commissioning_date': 'Use YYYY-MM-DD.'})
        activate_plant(plant.project, commissioning_date, user=request.user)
        return Response(self.get_serializer(self.get_queryset().get(pk=plant.pk)).data)

    permission_action_map = {'history': 'can_view', 'refresh': 'can_edit'}


class OmMaintenanceTaskViewSet(OmBaseViewSet):
    serializer_class = OmMaintenanceTaskSerializer
    filterset_fields = ['project', 'plant', 'ticket', 'status', 'task_type', 'priority', 'source', 'assigned_engineer']
    search_fields = [
        'title', 'site', 'engineer', 'project__project_name', 'plant__plant_name',
        'plant__customer_name', 'plant__mobile_number',
    ]
    ordering_fields = ['due_date', 'visit_date', 'created_at', 'priority']
    field_work_actions = ('list', 'retrieve', 'accept', 'start', 'my_tasks')
    permission_action_map = {
        'accept': 'can_edit', 'start': 'can_edit', 'cancel': 'can_edit',
        'assign_engineer': 'can_edit', 'my_tasks': 'can_view',
    }

    def get_queryset(self):
        qs = OmMaintenanceTask.objects.select_related(
            'project', 'plant', 'ticket', 'assigned_engineer', 'created_by',
        )
        qs = self._scope(qs)
        if self._field_only():
            qs = qs.filter(assigned_engineer=self.request.user)
        params = self.request.query_params
        today = date.today()
        if params.get('overdue') in ('1', 'true'):
            qs = qs.exclude(status__in=OmMaintenanceTask.CLOSED_STATUSES).filter(
                Q(deadline__lt=today) | Q(deadline__isnull=True, due_date__lt=today)
            )
        if params.get('open') in ('1', 'true'):
            qs = qs.exclude(status__in=OmMaintenanceTask.CLOSED_STATUSES)
        if params.get('due_from'):
            qs = qs.filter(due_date__gte=params['due_from'])
        if params.get('due_to'):
            qs = qs.filter(due_date__lte=params['due_to'])
        return qs

    def perform_create(self, serializer):
        task = serializer.save(created_by=self.request.user)
        from .workflow import notify_task_assigned
        notify_task_assigned(task)

    def perform_update(self, serializer):
        before = serializer.instance.assigned_engineer_id
        task = serializer.save()
        if task.assigned_engineer_id and task.assigned_engineer_id != before:
            from .workflow import notify_task_assigned
            notify_task_assigned(task)

    def _set_status(self, task, new_status):
        task.status = new_status
        task.save(update_fields=['status', 'updated_at'])
        if task.ticket_id and new_status in ('Accepted', 'In Progress'):
            ticket = task.ticket
            target = 'Site Visit' if new_status == 'In Progress' else 'In Progress'
            if ticket.status in ('Open', 'Assigned', 'In Progress'):
                ticket.status = target
                ticket.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        return self._set_status(self.get_object(), 'Accepted')

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        return self._set_status(self.get_object(), 'In Progress')

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        return self._set_status(self.get_object(), 'Cancelled')

    @action(detail=True, methods=['post'], url_path='assign-engineer')
    def assign_engineer(self, request, pk=None):
        task = self.get_object()
        serializer = self.get_serializer(task, data={
            'assigned_engineer': request.data.get('assigned_engineer'),
            'visit_date': request.data.get('visit_date') or task.visit_date,
        }, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='my-tasks')
    def my_tasks(self, request):
        """Engineer view: my open tasks grouped by today / overdue / upcoming."""
        today = date.today()
        qs = (
            OmMaintenanceTask.objects.select_related('plant', 'ticket', 'project', 'assigned_engineer')
            .filter(assigned_engineer=request.user)
        )
        open_qs = qs.exclude(status__in=OmMaintenanceTask.CLOSED_STATUSES)
        groups = {'today': [], 'overdue': [], 'upcoming': [], 'completed': []}
        for task in open_qs.order_by('visit_date', 'due_date'):
            when = task.visit_date or task.due_date
            if when and when < today:
                groups['overdue'].append(task)
            elif when == today:
                groups['today'].append(task)
            else:
                groups['upcoming'].append(task)
        groups['completed'] = list(
            qs.filter(status='Completed', completed_at__gte=timezone.now() - timedelta(days=7)).order_by('-completed_at')[:20]
        )
        data = {k: self.get_serializer(v, many=True).data for k, v in groups.items()}
        data['counts'] = {
            'today': len(groups['today']),
            'overdue': len(groups['overdue']),
            'upcoming': len(groups['upcoming']),
            'quarterly_today': sum(1 for t in groups['today'] if t.source == 'Quarterly'),
            'complaints_today': sum(1 for t in groups['today'] if t.source == 'Ticket'),
            'emergency_today': sum(1 for t in groups['today'] if t.priority == 'Critical'),
        }
        return Response(data)


class OmBreakdownTicketViewSet(OmBaseViewSet):
    serializer_class = OmBreakdownTicketSerializer
    filterset_fields = ['project', 'plant', 'status', 'priority', 'asset', 'complaint_type', 'assigned_to']
    search_fields = [
        'subject', 'site', 'project__project_name', 'asset__name', 'plant__plant_name',
        'plant__customer_name', 'contact_number',
    ]
    permission_action_map = {'create_task': 'can_edit', 'resolve': 'can_edit', 'close': 'can_edit'}

    def get_queryset(self):
        qs = self._scope(
            OmBreakdownTicket.objects.select_related('project', 'plant', 'asset', 'assigned_to', 'created_by')
        )
        params = self.request.query_params
        if params.get('open') in ('1', 'true'):
            qs = qs.filter(status__in=OmBreakdownTicket.OPEN_STATUSES)
        if params.get('overdue') in ('1', 'true'):
            qs = qs.filter(status__in=OmBreakdownTicket.OPEN_STATUSES, expected_visit_date__lt=date.today())
        return qs

    def perform_create(self, serializer):
        ticket = serializer.save(created_by=self.request.user)
        from apps.notifications.services import notify
        notify(
            f'ticket-new-{ticket.pk}', f'New ticket BD-{ticket.pk:04d}: {ticket.subject}',
            message=' • '.join(x for x in [ticket.plant.plant_code if ticket.plant_id else '', ticket.priority] if x),
            category='Ticket', severity='critical' if ticket.priority in ('High', 'Critical') else 'info',
            plant=ticket.plant, link=f'/om/complaint-tickets?ticket={ticket.pk}',
        )

    @action(detail=True, methods=['post'], url_path='create-task')
    def create_task(self, request, pk=None):
        from .workflow import create_task_from_ticket
        task = create_task_from_ticket(self.get_object(), request.data, request.user)
        return Response(OmMaintenanceTaskSerializer(task).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        from .workflow import resolve_ticket
        ticket = resolve_ticket(self.get_object(), request.data.get('resolution', ''), close=False)
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        from .workflow import resolve_ticket
        ticket = resolve_ticket(self.get_object(), request.data.get('resolution', ''), close=True)
        return Response(self.get_serializer(ticket).data)


class OmSiteVisitViewSet(OmBaseViewSet):
    serializer_class = OmSiteVisitSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ['project', 'plant', 'task', 'ticket', 'status', 'service_type', 'assigned_engineer']
    search_fields = ['site', 'purpose', 'engineer', 'project__project_name', 'plant__plant_name', 'plant__customer_name']
    field_work_actions = ('list', 'retrieve', 'complete')
    permission_action_map = {'complete': 'can_edit', 'cancel': 'can_edit'}

    def get_queryset(self):
        qs = self._scope(OmSiteVisit.objects.select_related(
            'project', 'plant', 'task', 'ticket', 'assigned_engineer', 'created_by',
        ).prefetch_related('parts'))
        if self._field_only():
            qs = qs.filter(Q(assigned_engineer=self.request.user) | Q(created_by=self.request.user))
        return qs

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Service visits are permanent history. Cancel the visit instead of deleting it.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=False, methods=['post'])
    def complete(self, request):
        from .workflow import complete_visit
        if self._field_only() and request.data.get('task'):
            if not OmMaintenanceTask.objects.filter(pk=request.data['task'], assigned_engineer=request.user).exists():
                raise ValidationError({'task': 'This task is not assigned to you.'})
        visit = complete_visit(request.data, request.FILES, request.user)
        visit = self.get_queryset().model.objects.select_related(
            'project', 'plant', 'task', 'ticket', 'assigned_engineer', 'created_by',
        ).prefetch_related('parts').get(pk=visit.pk)
        return Response(self.get_serializer(visit).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        visit = self.get_object()
        visit.status = 'Cancelled'
        visit.remarks = '\n'.join(x for x in [visit.remarks, request.data.get('reason', '')] if x)
        visit.save(update_fields=['status', 'remarks', 'updated_at'])
        return Response(self.get_serializer(visit).data)


class OmVisitPartViewSet(OmBaseViewSet):
    serializer_class = OmVisitPartSerializer
    filterset_fields = ['visit', 'plant', 'ticket', 'material']
    search_fields = ['material', 'description', 'serial_number']

    def get_queryset(self):
        return OmVisitPart.objects.select_related('visit', 'plant', 'ticket', 'inventory_item', 'used_by')

    def perform_create(self, serializer):
        serializer.save(used_by=serializer.validated_data.get('used_by') or self.request.user)


class OmInsuranceViewSet(OmBaseViewSet):
    serializer_class = OmInsuranceSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ['plant', 'status', 'duration']
    search_fields = ['company', 'policy_number', 'policy_type', 'plant__plant_name', 'plant__customer_name']
    ordering_fields = ['expiry_date', 'start_date', 'created_at']

    def get_queryset(self):
        qs = OmInsurance.objects.select_related('plant')
        alert = self.request.query_params.get('alert')
        today = date.today()
        if alert == 'expiring':
            qs = qs.filter(status='Insured', expiry_date__gte=today, expiry_date__lte=today + timedelta(days=30))
        elif alert == 'expiring7':
            qs = qs.filter(status='Insured', expiry_date__gte=today, expiry_date__lte=today + timedelta(days=7))
        elif alert == 'expired':
            qs = qs.filter(Q(status='Expired') | Q(status='Insured', expiry_date__lt=today))
        elif alert == 'active':
            qs = qs.filter(status='Insured').filter(Q(expiry_date__gte=today) | Q(expiry_date__isnull=True))
        return qs


class OmDashboardView(APIView):
    permission_classes = [HasModulePermission]
    permission_module = 'O&M'

    def get(self, request):
        from .alerts import run_sync_if_stale
        from .dashboard import dashboard_summary
        run_sync_if_stale()
        return Response(dashboard_summary())


class OmEngineersView(APIView):
    """Active users who can take O&M field work — for assignment dropdowns
    (the full user list needs User Management access)."""
    permission_classes = [HasModulePermission]
    permission_module = 'O&M'

    def get(self, request):
        from django.contrib.auth import get_user_model
        from .permissions import FIELD_WORK_MODULE
        field_roles = Q(role__permissions__module__in=[FIELD_WORK_MODULE, 'O&M']) & (
            Q(role__permissions__can_view=True) | Q(role__permissions__full_access=True)
        )
        users = (
            get_user_model().objects.filter(is_active=True, is_deleted=False)
            .filter(field_roles | Q(is_superuser=True))
            .select_related('role').distinct().order_by('name')
        )
        return Response([
            {'id': u.id, 'name': u.name or u.email, 'role': u.role.name if u.role_id else '', 'mobile': getattr(u, 'mobile', '')}
            for u in users
        ])


class OmSparePartViewSet(OmBaseViewSet):
    serializer_class = OmSparePartSerializer
    filterset_fields = ['category']
    search_fields = ['name', 'site', 'supplier', 'category']

    def get_queryset(self):
        return OmSparePart.objects.select_related('created_by', 'linked_inventory_item').all()

    def perform_create(self, serializer):
        sync = _sync_inventory_requested(self.request.data.get('sync_inventory', False))
        spare_part = serializer.save(created_by=self.request.user)
        _maybe_sync_linked_inventory(spare_part, sync)

    def perform_update(self, serializer):
        sync = _sync_inventory_requested(self.request.data.get('sync_inventory', False))
        spare_part = serializer.save()
        _maybe_sync_linked_inventory(spare_part, sync)


class OmReportViewSet(viewsets.ModelViewSet):
    serializer_class = OmReportSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'O&M'
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['report_type']
    search_fields = ['name', 'report_type']
    ordering = ['-created_at']

    def get_queryset(self):
        return OmReport.objects.select_related('generated_by').all()

    def perform_create(self, serializer):
        serializer.save(generated_by=self.request.user)


class OmDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = OmDocumentSerializer
    permission_classes = [OmOrFieldWorkPermission]
    permission_module = 'O&M'
    field_work_actions = ('list', 'create')
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['module', 'related_id', 'plant', 'category']

    def get_queryset(self):
        qs = OmDocument.objects.select_related('uploaded_by').all()
        if not has_full_om_access(self.request.user):
            qs = qs.filter(uploaded_by=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
