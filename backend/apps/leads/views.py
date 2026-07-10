from datetime import date, timedelta

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.utils import timezone
from django.db.models import Q, Count
from django.db.models.functions import TruncMonth
from .models import Lead, FollowUp, AdminApproval, Quotation, LeadSiteSurvey, LeadSurveyPhoto
from .serializers import (
    LeadListSerializer, LeadDetailSerializer, LeadCreateSerializer,
    FollowUpSerializer, AdminApprovalSerializer, QuotationSerializer,
    LeadSiteSurveySerializer, LeadSurveyPhotoSerializer,
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
        qs = Lead.objects.select_related('assigned_to', 'created_by', 'site_survey')
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

        # `anchor` lets the dashboard's date-picker look at a period other than
        # the current one (e.g. a past month), defaulting to today when absent
        # or malformed.
        anchor = today
        date_param = request.query_params.get('date')
        if date_param:
            try:
                anchor = date.fromisoformat(date_param)
            except ValueError:
                anchor = today

        # `period` scopes the headline counts to leads created in the anchored
        # day / week / month / year, for the dashboard's period toggle.
        # `today_followups` and `overdue` stay absolute — they describe
        # what's due today, not when the lead was created.
        period = request.query_params.get('period')
        range_start = range_end = None
        if period == 'day':
            range_start = range_end = anchor
            period_qs = qs.filter(created_at__date=anchor)
        elif period == 'week':
            range_start = anchor - timedelta(days=anchor.weekday())
            range_end = range_start + timedelta(days=6)
            period_qs = qs.filter(created_at__date__gte=range_start, created_at__date__lte=range_end)
        elif period == 'month':
            range_start = anchor.replace(day=1)
            next_month = (range_start.replace(day=28) + timedelta(days=4)).replace(day=1)
            range_end = next_month - timedelta(days=1)
            period_qs = qs.filter(created_at__year=anchor.year, created_at__month=anchor.month)
        elif period == 'year':
            range_start = anchor.replace(month=1, day=1)
            range_end = anchor.replace(month=12, day=31)
            period_qs = qs.filter(created_at__year=anchor.year)
        else:
            period_qs = qs

        return Response({
            'total': period_qs.count(),
            'new': period_qs.filter(status='New').count(),
            'follow_up': period_qs.filter(status='Follow-up').count(),
            'today_followups': qs.filter(next_follow_up__date=today).count(),
            'quotation': period_qs.filter(status='Quotation').count(),
            'won': period_qs.filter(status='Won').count(),
            'lost': period_qs.filter(status='Lost').count(),
            'overdue': qs.filter(next_follow_up__lt=timezone.now(), status__in=['New', 'Follow-up']).count(),
            'range_start': range_start.isoformat() if range_start else None,
            'range_end': range_end.isoformat() if range_end else None,
        })

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        from .analytics_service import lead_analytics
        return Response(lead_analytics(
            date_from=request.query_params.get('date_from'),
            date_to=request.query_params.get('date_to'),
            project_type=request.query_params.get('project_type'),
            status_filter=request.query_params.get('status'),
            assigned_to=request.query_params.get('assigned_to'),
        ))

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

    @action(detail=True, methods=['get', 'put'])
    def site_survey(self, request, pk=None):
        lead = self.get_object()
        survey = getattr(lead, 'site_survey', None)
        if request.method == 'GET':
            if not survey:
                return Response(None)
            return Response(LeadSiteSurveySerializer(survey).data)
        if not survey:
            survey = LeadSiteSurvey(lead=lead)
        serializer = LeadSiteSurveySerializer(survey, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LeadSurveyPhotoViewSet(viewsets.ModelViewSet):
    queryset = LeadSurveyPhoto.objects.select_related('survey', 'survey__lead', 'uploaded_by').all()
    serializer_class = LeadSurveyPhotoSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Leads'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['survey']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


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
        self._sync_lead_next_follow_up(follow_up.lead)

    def perform_update(self, serializer):
        # BUG-053: without this override, PATCHing an existing follow-up's
        # status to Completed/Missed never touched `lead.next_follow_up` —
        # only `perform_create` synced it, so a lead kept showing as
        # overdue/due-today forever after the rep actually completed the
        # follow-up. Recompute from the lead's remaining state on every save.
        follow_up = serializer.save()
        self._sync_lead_next_follow_up(follow_up.lead)

    @staticmethod
    def _sync_lead_next_follow_up(lead):
        """Set `lead.next_follow_up` to the earliest remaining `Scheduled`
        follow-up's `scheduled_at`, or null if none remain."""
        next_scheduled = (
            lead.follow_ups.filter(status='Scheduled')
            .order_by('scheduled_at')
            .values_list('scheduled_at', flat=True)
            .first()
        )
        if lead.next_follow_up != next_scheduled:
            lead.next_follow_up = next_scheduled
            lead.save(update_fields=['next_follow_up'])


class AdminApprovalViewSet(viewsets.ModelViewSet):
    queryset = AdminApproval.objects.select_related('lead', 'requested_by', 'approved_by').all()
    serializer_class = AdminApprovalSerializer
    permission_classes = [HasModulePermission]
    # BUG-017: duplicate-IVRS approval *requests* are an IVRS Management
    # action; reviewing/approving/rejecting them is Approvals.
    permission_module = 'Approvals'
    permission_module_map = {'create': 'IVRS Management'}
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
        # BUG-054: this used to only flip `status` to 'Approved' — the Lead
        # requested via `requested_payload` (the duplicate-IVRS lead blocked
        # at creation time by LeadCreateSerializer.validate_ivrs_number) was
        # never actually created, so approving a request was a dead end.
        approval = self.get_object()
        with transaction.atomic():
            if not approval.created_lead_id:
                payload = dict(approval.requested_payload or {})
                # This request exists specifically because the originally
                # submitted ivrs_number collided with an existing Lead.
                # Approving is an explicit override to create the lead
                # anyway — don't reuse the colliding number (it would just
                # fail the same unique constraint); let the model mint a
                # fresh one via its `default=generate_ivrs`.
                payload.pop('ivrs_number', None)
                payload.pop('id', None)
                payload.pop('created_at', None)
                serializer = LeadCreateSerializer(data=payload)
                serializer.is_valid(raise_exception=True)
                lead = serializer.save(created_by=approval.requested_by)
                approval.created_lead = lead
            approval.status = 'Approved'
            approval.approved_by = request.user
            approval.reason = request.data.get('reason', '')
            approval.save()
        return Response(AdminApprovalSerializer(approval).data)

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
