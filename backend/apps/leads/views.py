from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Q, Count
from django.db.models.functions import TruncMonth
from .models import Lead, FollowUp, AdminApproval, Quotation
from .serializers import (
    LeadListSerializer, LeadDetailSerializer, LeadCreateSerializer,
    FollowUpSerializer, AdminApprovalSerializer, QuotationSerializer,
)
from apps.accounts.permissions import HasModulePermission


class LeadViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Leads'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'category', 'assigned_to']
    search_fields = ['customer_name', 'mobile_number', 'ivrs_number', 'project_name']
    ordering_fields = ['created_at', 'next_follow_up', 'customer_name']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Lead.objects.select_related('assigned_to', 'created_by')
        # Sales Executive sees only their own leads
        if getattr(user.role, 'name', '') == 'Sales Executive':
            qs = qs.filter(assigned_to=user)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return LeadCreateSerializer
        if self.action in ['retrieve', 'update', 'partial_update']:
            return LeadDetailSerializer
        return LeadListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        qs = self.get_queryset().filter(
            next_follow_up__lt=timezone.now(),
            status__in=['New', 'Follow-up'],
        )
        serializer = LeadListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today_followups(self, request):
        today = timezone.now().date()
        qs = self.get_queryset().filter(next_follow_up__date=today)
        serializer = LeadListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        today = timezone.now().date()
        return Response({
            'total': qs.count(),
            'new': qs.filter(status='New').count(),
            'follow_up': qs.filter(status='Follow-up').count(),
            'today_followups': qs.filter(next_follow_up__date=today).count(),
            'quotation': qs.filter(status='Quotation').count(),
            'won': qs.filter(status='Won').count(),
            'lost': qs.filter(status='Lost').count(),
            'overdue': qs.filter(next_follow_up__lt=timezone.now(), status__in=['New', 'Follow-up']).count(),
        })

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        qs = self.get_queryset()
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        status_dist = list(qs.values('status').annotate(count=Count('id')).order_by('status'))

        monthly = list(
            qs.annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(
                new=Count('id', filter=Q(status='New')),
                follow_up=Count('id', filter=Q(status='Follow-up')),
                won=Count('id', filter=Q(status='Won')),
                total=Count('id'),
            )
            .order_by('month')
        )
        for m in monthly:
            m['month'] = m['month'].strftime('%b %Y') if m['month'] else '—'

        employee_stats = list(
            qs.filter(assigned_to__isnull=False)
            .values('assigned_to__name')
            .annotate(
                total=Count('id'),
                won=Count('id', filter=Q(status='Won')),
                lost=Count('id', filter=Q(status='Lost')),
            )
            .order_by('-total')[:10]
        )
        for e in employee_stats:
            total = e['total'] or 1
            e['conversion'] = round((e['won'] / total) * 100, 1)
            e['name'] = e.pop('assigned_to__name') or 'Unassigned'

        project_type_stats = list(
            qs.values('project_type')
            .annotate(
                total=Count('id'),
                won=Count('id', filter=Q(status='Won')),
            )
            .order_by('-total')
        )
        for p in project_type_stats:
            total = p['total'] or 1
            p['conversion'] = round((p['won'] / total) * 100, 1)
            p['type'] = p.pop('project_type') or 'Unknown'

        priority_stats = list(
            qs.values('priority').annotate(count=Count('id')).order_by('-count')
        )
        source_stats = list(
            qs.values('source').annotate(count=Count('id')).order_by('-count')[:6]
        )

        total = qs.count()
        won = qs.filter(status='Won').count()
        return Response({
            'total': total,
            'won': won,
            'lost': qs.filter(status='Lost').count(),
            'conversion_rate': round((won / total * 100), 1) if total else 0,
            'overdue': qs.filter(next_follow_up__lt=timezone.now(), status__in=['New', 'Follow-up']).count(),
            'status_distribution': status_dist,
            'monthly_trend': monthly,
            'employee_stats': employee_stats,
            'project_type_stats': project_type_stats,
            'priority_stats': priority_stats,
            'source_stats': source_stats,
        })

    @action(detail=False, methods=['get'])
    def recent(self, request):
        qs = self.get_queryset().order_by('-created_at')[:5]
        serializer = LeadListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        lead = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(Lead.STATUS_CHOICES):
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        lead.status = new_status
        lead.save(update_fields=['status', 'updated_at'])
        return Response({'status': lead.status})

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        from django.contrib.auth import get_user_model
        lead = self.get_object()
        user_id = request.data.get('assigned_to')
        if user_id is not None and not get_user_model().objects.filter(pk=user_id, is_active=True).exists():
            return Response({'error': 'Invalid or inactive user.'}, status=status.HTTP_400_BAD_REQUEST)
        lead.assigned_to_id = user_id
        lead.save(update_fields=['assigned_to', 'updated_at'])
        return Response({'assigned_to': lead.assigned_to_id})


class FollowUpViewSet(viewsets.ModelViewSet):
    queryset = FollowUp.objects.select_related('lead', 'created_by').all()
    serializer_class = FollowUpSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Follow-ups'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['lead', 'follow_up_type', 'status']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        follow_up = serializer.save(created_by=self.request.user)
        # Sync lead's next_follow_up with scheduled follow-ups
        if follow_up.status == 'Scheduled':
            follow_up.lead.next_follow_up = follow_up.scheduled_at
            follow_up.lead.save(update_fields=['next_follow_up'])


class AdminApprovalViewSet(viewsets.ModelViewSet):
    queryset = AdminApproval.objects.select_related('lead', 'requested_by', 'approved_by').all()
    serializer_class = AdminApprovalSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Approvals'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status']
    search_fields = [
        'ivrs_number',
        'requested_customer_name',
        'requested_mobile_number',
        'requested_project_name',
        'lead__customer_name',
        'lead__mobile_number',
        'lead__project_name',
    ]
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        approval = self.get_object()
        approval.status = 'Approved'
        approval.approved_by = request.user
        approval.reason = request.data.get('reason', '')
        approval.save()
        return Response({'status': 'Approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        approval = self.get_object()
        approval.status = 'Rejected'
        approval.approved_by = request.user
        approval.reason = request.data.get('reason', '')
        approval.save()
        return Response({'status': 'Rejected'})


class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.select_related('lead', 'created_by').prefetch_related('items').all()
    serializer_class = QuotationSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Leads'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['lead', 'status']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
