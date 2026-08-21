from datetime import date

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.utils import timezone
from django.db.models import Q, Count
from .models import Lead, FollowUp, AdminApproval, Quotation, LeadSiteSurvey, LeadSurveyPhoto
from .serializers import (
    LeadListSerializer, LeadDetailSerializer, LeadCreateSerializer,
    FollowUpSerializer, AdminApprovalSerializer, QuotationSerializer,
    LeadSiteSurveySerializer, LeadSurveyPhotoSerializer,
)
from apps.accounts.permissions import (
    HasModulePermission, is_lead_scoped, lead_owner_filter, is_own_lead, can_manage_leads,
)
from .datetime_filters import filter_field_on_local_date, period_created_at_queryset
from .followup_sync import sync_lead_next_follow_up
from .recycle import soft_delete_follow_up, soft_delete_lead, soft_delete_quotation


class LeadViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Lead'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'category', 'assigned_to']
    search_fields = ['customer_name', 'mobile_number', 'ivrs_number', 'project_name']
    ordering_fields = ['created_at', 'next_follow_up', 'customer_name']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Lead.objects.select_related('assigned_to', 'created_by', 'site_survey').filter(is_deleted=False)
        role = getattr(getattr(user, 'role', None), 'name', '')
        if role == 'Sales Executive':
            # Sales Executives see only leads assigned to them
            qs = qs.filter(assigned_to=user)
        elif role == 'Tele Sales Executive':
            # Tele portal: only the leads this executive created that are still
            # unassigned, or leads explicitly assigned to them. Once a manager
            # hands a lead to a field Sales Executive, it leaves the tele list —
            # Tele Sales Executives are never valid field assignees.
            qs = qs.filter(
                Q(created_by=user, assigned_to__isnull=True) | Q(assigned_to=user)
            )
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return LeadCreateSerializer
        if self.action in ['retrieve', 'update', 'partial_update']:
            return LeadDetailSerializer
        return LeadListSerializer

    def perform_create(self, serializer):
        # Newly created leads are never auto-assigned to their creator —
        # they land unassigned in the Manager/Super Admin pool until
        # explicitly handed out via the `assign` action.
        if is_lead_scoped(self.request.user):
            serializer.save(created_by=self.request.user, assigned_to=None)
        else:
            serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        user = self.request.user
        role = getattr(getattr(user, 'role', None), 'name', '')
        if role == 'Tele Sales Executive' and serializer.instance.created_by_id != user.id:
            raise PermissionDenied('You can only edit leads you added.')
        # Scoped executives cannot reassign leads via PATCH unless they have
        # Lead → Assign in the permission matrix (Settings → Roles).
        if is_lead_scoped(user) and not can_manage_leads(user):
            locked = {'assigned_to': serializer.instance.assigned_to}
            # A Sales Executive can update lead details/follow-ups but must never
            # change the pipeline status — a Won lead stays Won in their account.
            if role == 'Sales Executive':
                locked['status'] = serializer.instance.status
            serializer.save(**locked)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        role = getattr(getattr(user, 'role', None), 'name', '')
        if role == 'Tele Sales Executive' and instance.created_by_id != user.id:
            raise PermissionDenied('You can only delete leads you added.')
        # Won leads may only be deleted by the management tier (Super Admin /
        # Admin / Branch Manager). A Sales Executive can never delete a lead.
        if role == 'Sales Executive':
            raise PermissionDenied('Sales Executives cannot delete leads.')
        if instance.status == 'Won' and not can_manage_leads(user):
            raise PermissionDenied('Only a Manager or Super Admin can delete a Won lead.')
        # Soft-delete → CRM Settings Recycle Bin (auto-purge after 30 days).
        soft_delete_lead(instance, user)

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
        today = timezone.localdate()
        qs = filter_field_on_local_date(self.get_queryset(), 'next_follow_up', today)
        serializer = LeadListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        today = timezone.localdate()

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

        # Headline KPIs are the live pipeline (all non-deleted leads). The
        # day/week/month/year toggle only scopes "created / won in this period"
        # so a month with no *new* leads does not zero out Total Leads while
        # Recent Leads still shows the existing book.
        # `today_followups` and `overdue` stay absolute — they describe
        # what's due today, not when the lead was created.
        #
        # Use aware datetime bounds (not __date/__year/__month) so counts work
        # on MySQL hosts without timezone tables.
        period = request.query_params.get('period')
        period_qs, range_start, range_end = period_created_at_queryset(qs, period, anchor)

        return Response({
            'total': qs.count(),
            'new': qs.filter(status='New').count(),
            'follow_up': qs.filter(status='Follow-up').count(),
            'today_followups': filter_field_on_local_date(qs, 'next_follow_up', today).count(),
            'quotation': qs.filter(status='Quotation').count(),
            'won': qs.filter(status='Won').count(),
            'lost': qs.filter(status='Lost').count(),
            'created_in_period': period_qs.count(),
            'won_in_period': period_qs.filter(status='Won').count(),
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
        # A Sales Executive must never change a lead's pipeline status — the
        # status their manager set (e.g. Won) stays fixed in their account.
        role = getattr(getattr(request.user, 'role', None), 'name', '')
        if role == 'Sales Executive':
            return Response(
                {'error': 'Sales Executives cannot change lead status.'},
                status=status.HTTP_403_FORBIDDEN,
            )
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
        # Gated by Settings → Roles & Permissions → Lead → Assign (or full_access).
        if not can_manage_leads(request.user):
            return Response(
                {'error': 'Lead assignment requires Assign permission on the Lead module.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        lead = self.get_object()
        user_id = request.data.get('assigned_to')
        # Clearing assignment (null / empty) is allowed.
        if user_id in (None, '', 'null'):
            lead.assigned_to_id = None
            lead.save(update_fields=['assigned_to', 'updated_at'])
            return Response({'assigned_to': None})

        User = get_user_model()
        try:
            assignee = User.objects.select_related('role').get(pk=user_id, is_active=True, is_deleted=False)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Invalid or inactive user.'}, status=status.HTTP_400_BAD_REQUEST)

        # Field assignment is Sales Executive only — Tele Sales Executive must
        # never receive an assigned_to lead (they create/nurture, managers hand
        # off to field Sales Executives).
        role_name = getattr(getattr(assignee, 'role', None), 'name', '') or ''
        if role_name == 'Tele Sales Executive':
            return Response(
                {'error': 'Leads cannot be assigned to a Tele Sales Executive. Assign to a Sales Executive instead.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role_name != 'Sales Executive':
            return Response(
                {'error': 'Leads can only be assigned to a Sales Executive.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lead.assigned_to_id = assignee.pk
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
    permission_module = 'Lead'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['survey']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class FollowUpViewSet(viewsets.ModelViewSet):
    queryset = FollowUp.objects.select_related('lead', 'lead__assigned_to', 'created_by').all()
    serializer_class = FollowUpSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Lead'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['lead', 'follow_up_type', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset().filter(is_deleted=False, lead__is_deleted=False)
        user = self.request.user
        role = getattr(getattr(user, 'role', None), 'name', '')
        # Match LeadViewSet: tele only sees follow-ups on their unassigned
        # created leads, or leads assigned to them — not leads already handed
        # to a field Sales Executive.
        if role == 'Tele Sales Executive':
            return qs.filter(
                Q(lead__created_by=user, lead__assigned_to__isnull=True) | Q(lead__assigned_to=user)
            )
        filt = lead_owner_filter(user, prefix='lead__')
        if filt:
            qs = qs.filter(**filt)
        return qs

    def perform_create(self, serializer):
        lead = serializer.validated_data.get('lead')
        if is_lead_scoped(self.request.user) and lead and not is_own_lead(self.request.user, lead):
            raise PermissionDenied('You can only add follow-ups to your own leads.')
        follow_up = serializer.save(created_by=self.request.user)
        sync_lead_next_follow_up(follow_up.lead)

    def perform_update(self, serializer):
        # A scoped executive must not be able to re-point their follow-up at
        # another executive's lead (the `lead` field is writable on PATCH too).
        lead = serializer.validated_data.get('lead')
        if is_lead_scoped(self.request.user) and lead and not is_own_lead(self.request.user, lead):
            raise PermissionDenied('You can only move follow-ups to your own leads.')
        # BUG-053: without this override, PATCHing an existing follow-up's
        # status to Completed/Missed never touched `lead.next_follow_up` —
        # only `perform_create` synced it, so a lead kept showing as
        # overdue/due-today forever after the rep actually completed the
        # follow-up. Recompute from the lead's remaining state on every save.
        old_lead = serializer.instance.lead
        follow_up = serializer.save()
        sync_lead_next_follow_up(follow_up.lead)
        # If the follow-up was moved to a different lead, the old lead's
        # next_follow_up would otherwise keep pointing at the moved record.
        if old_lead.pk != follow_up.lead_id:
            sync_lead_next_follow_up(old_lead)

    def perform_destroy(self, instance):
        # Soft-delete → Recycle Bin; resync lead next_follow_up afterwards.
        lead = instance.lead
        soft_delete_follow_up(instance, self.request.user)
        sync_lead_next_follow_up(lead)


class AdminApprovalViewSet(viewsets.ModelViewSet):
    queryset = AdminApproval.objects.select_related('lead', 'requested_by', 'approved_by').all()
    serializer_class = AdminApprovalSerializer
    permission_classes = [HasModulePermission]
    # Lead matrix covers approvals + IVRS duplicate requests (sidebar-aligned).
    permission_module = 'Lead'
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
    permission_module = 'Quotation'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['lead', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset().filter(is_deleted=False, lead__is_deleted=False)
        # Sales / Tele Sales Executives see only quotations on their own leads
        filt = lead_owner_filter(self.request.user, prefix='lead__')
        if filt:
            qs = qs.filter(**filt)
        return qs

    def perform_create(self, serializer):
        lead = serializer.validated_data.get('lead')
        if is_lead_scoped(self.request.user) and lead and not is_own_lead(self.request.user, lead):
            raise PermissionDenied('You can only create quotations for your own leads.')
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        # Same rule on PATCH: the `lead` field is writable, so block scoped
        # executives from re-pointing a quotation at someone else's lead.
        lead = serializer.validated_data.get('lead')
        if is_lead_scoped(self.request.user) and lead and not is_own_lead(self.request.user, lead):
            raise PermissionDenied('You can only move quotations to your own leads.')
        serializer.save()

    def perform_destroy(self, instance):
        soft_delete_quotation(instance, self.request.user)
