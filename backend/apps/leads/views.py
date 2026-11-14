from datetime import date

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django_filters import rest_framework as df
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
    HasModulePermission, is_lead_scoped, lead_owner_q,
    is_own_lead, can_manage_leads,
)
from .datetime_filters import filter_field_on_local_date, period_created_at_queryset
from .followup_sync import sync_lead_next_follow_up
from .recycle import soft_delete_follow_up, soft_delete_lead, soft_delete_quotation


class LeadFilter(df.FilterSet):
    """Explicit filters — avoid AutoFilterSet crashing if model/filter fields drift during local reload."""

    status = df.CharFilter(field_name='status')
    category = df.CharFilter(field_name='category')
    assigned_to = df.NumberFilter(field_name='assigned_to_id')
    # Accept both ?customer= and ?customer_id= via customer_id column (no FK Meta introspection).
    customer = df.NumberFilter(field_name='customer_id')
    customer_id = df.NumberFilter(field_name='customer_id')

    class Meta:
        model = Lead
        fields = []


class LeadViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Lead'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = LeadFilter
    search_fields = ['customer_name', 'mobile_number', 'ivrs_number', 'project_name']
    ordering_fields = ['created_at', 'next_follow_up', 'customer_name', 'last_activity_at']
    ordering = ['-last_activity_at', '-created_at']

    def get_queryset(self):
        from django.db.models import OuterRef, Subquery
        from apps.projects.models import SiteSurvey

        user = self.request.user
        project_survey_status = SiteSurvey.objects.filter(
            project__lead_id=OuterRef('pk'),
        ).order_by('-updated_at').values('status')[:1]
        qs = Lead.objects.select_related(
            'assigned_to', 'created_by', 'site_survey', 'customer',
        ).annotate(
            list_survey_status=Subquery(project_survey_status),
        ).filter(is_deleted=False)
        owner_q = lead_owner_q(user)
        if owner_q is not None:
            qs = qs.filter(owner_q)

        # Lead List category chips (New/Hot/Warm/Cool/Won/Lost) — server-side so
        # counts and pages match full book, not only the current page slice.
        bucket = (self.request.query_params.get('category_bucket') or '').strip().lower()
        if bucket == 'won':
            qs = qs.filter(status='Won')
        elif bucket == 'lost':
            qs = qs.filter(status='Lost')
        elif bucket == 'hot':
            qs = qs.exclude(status__in=['Won', 'Lost']).filter(
                Q(priority='High') | Q(category='Hot')
            )
        elif bucket == 'cool':
            qs = qs.exclude(status__in=['Won', 'Lost']).exclude(
                Q(priority='High') | Q(category='Hot')
            ).filter(Q(priority='Low') | Q(category='Cool'))
        elif bucket == 'warm':
            qs = qs.exclude(status__in=['Won', 'Lost']).exclude(
                Q(priority='High') | Q(priority='Low') | Q(category='Hot') | Q(category='Cool')
            ).filter(Q(status='Quotation') | Q(category='Warm'))
        elif bucket == 'new':
            qs = qs.filter(status='New').exclude(
                Q(priority='High') | Q(priority='Low') | Q(category='Hot') | Q(category='Cool') | Q(category='Warm')
            )
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return LeadCreateSerializer
        if self.action in ['retrieve', 'update', 'partial_update']:
            return LeadDetailSerializer
        return LeadListSerializer

    def perform_create(self, serializer):
        from django.utils import timezone
        user = self.request.user
        now = timezone.now()
        # Sales + Tele Sales Executives auto-own leads they personally add
        # (Tele My Leads is assigned_to-only, so create must set assigned_to=self
        # or the new lead vanishes from their portal after save).
        # New leads get last_activity_at so they sort with recently-worked list.
        if is_lead_scoped(user):
            serializer.save(created_by=user, assigned_to=user, last_activity_at=now)
        else:
            serializer.save(created_by=user, last_activity_at=now)

    def perform_update(self, serializer):
        from django.utils import timezone
        user = self.request.user
        if is_lead_scoped(user) and not is_own_lead(user, serializer.instance):
            raise PermissionDenied('You can only edit leads you added or that are assigned to you.')
        # Scoped executives cannot reassign leads via PATCH unless they have
        # Lead → Assign in the permission matrix (Settings → Roles).
        # Successful Save/Update bumps last_activity_at so the lead rises to top of Lead List.
        if is_lead_scoped(user) and not can_manage_leads(user):
            serializer.save(assigned_to=serializer.instance.assigned_to, last_activity_at=timezone.now())
        else:
            serializer.save(last_activity_at=timezone.now())

    def perform_destroy(self, instance):
        user = self.request.user
        if is_lead_scoped(user) and not is_own_lead(user, instance):
            raise PermissionDenied('You can only delete leads you added or that are assigned to you.')
        # Won leads may only be deleted by the management tier (or Assign perm).
        if instance.status == 'Won' and not can_manage_leads(user):
            raise PermissionDenied('Only a Manager or Super Admin can delete a Won lead.')
        # Soft-delete → CRM Settings Recycle Bin (auto-purge after 30 days).
        soft_delete_lead(instance, user)

    @action(detail=False, methods=['get'], url_path='check-ivrs')
    def check_ivrs(self, request):
        """Global IVRS uniqueness check (not lead-scoped).

        Tele/Sales executives only see their own leads in list/search, so an
        IVRS owned by another user looked "available" in the UI and then failed
        on create. This endpoint matches LeadCreateSerializer / DB unique.
        """
        ivrs = (request.query_params.get('ivrs') or '').strip()
        if not ivrs:
            return Response({'detail': 'ivrs required'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Lead.objects.filter(ivrs_number=ivrs)
        exclude_id = (request.query_params.get('exclude_id') or '').strip()
        if exclude_id.isdigit():
            qs = qs.exclude(pk=int(exclude_id))

        lead = qs.only('id', 'customer_name', 'mobile_number', 'ivrs_number', 'is_deleted', 'status').first()
        if not lead:
            return Response({'available': True, 'ivrs': ivrs})

        payload = {
            'available': False,
            'ivrs': ivrs,
            'id': lead.id,
            'customer_name': lead.customer_name,
            'status': lead.status,
            'is_deleted': bool(lead.is_deleted),
        }
        # Scoped roles may learn a collision exists, but not another owner's mobile.
        if not is_lead_scoped(request.user) or is_own_lead(request.user, lead):
            payload['mobile_number'] = lead.mobile_number
        return Response(payload)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        qs = self.get_queryset().filter(
            next_follow_up__lt=timezone.now(),
            status__in=Lead.OPEN_STATUSES,
        )[:200]
        serializer = LeadListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today_followups(self, request):
        today = timezone.localdate()
        qs = filter_field_on_local_date(self.get_queryset(), 'next_follow_up', today)[:200]
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

        # One aggregate round-trip for status + Lead List category chips.
        from django.db.models import Count, Q
        open_q = Q(status__in=Lead.OPEN_STATUSES)
        hot_q = ~Q(status__in=['Won', 'Lost']) & (Q(priority='High') | Q(category='Hot'))
        cool_q = (
            ~Q(status__in=['Won', 'Lost'])
            & ~Q(priority='High') & ~Q(category='Hot')
            & (Q(priority='Low') | Q(category='Cool'))
        )
        warm_q = (
            ~Q(status__in=['Won', 'Lost'])
            & ~Q(priority='High') & ~Q(priority='Low')
            & ~Q(category='Hot') & ~Q(category='Cool')
            & (Q(status='Quotation') | Q(category='Warm'))
        )
        new_cat_q = (
            Q(status='New')
            & ~Q(priority='High') & ~Q(priority='Low')
            & ~Q(category='Hot') & ~Q(category='Cool') & ~Q(category='Warm')
        )
        buckets = qs.aggregate(
            total=Count('id'),
            new=Count('id', filter=Q(status='New')),
            quotation=Count('id', filter=Q(status='Quotation')),
            won=Count('id', filter=Q(status='Won')),
            lost=Count('id', filter=Q(status='Lost')),
            overdue=Count(
                'id',
                filter=Q(next_follow_up__lt=timezone.now()) & open_q,
            ),
            cat_new=Count('id', filter=new_cat_q),
            cat_hot=Count('id', filter=hot_q),
            cat_warm=Count('id', filter=warm_q),
            cat_cool=Count('id', filter=cool_q),
        )
        period_buckets = period_qs.aggregate(
            created_in_period=Count('id'),
            won_in_period=Count('id', filter=Q(status='Won')),
        )

        return Response({
            'total': buckets['total'] or 0,
            'new': buckets['new'] or 0,
            # Legacy key kept at 0 — Follow-up is no longer a lead status.
            'follow_up': 0,
            'today_followups': filter_field_on_local_date(qs, 'next_follow_up', today).count(),
            'quotation': buckets['quotation'] or 0,
            'won': buckets['won'] or 0,
            'lost': buckets['lost'] or 0,
            'created_in_period': period_buckets['created_in_period'] or 0,
            'won_in_period': period_buckets['won_in_period'] or 0,
            'overdue': buckets['overdue'] or 0,
            'categories': {
                'New leads': buckets['cat_new'] or 0,
                'Hot leads': buckets['cat_hot'] or 0,
                'Warm leads': buckets['cat_warm'] or 0,
                'Cool leads': buckets['cat_cool'] or 0,
                'Won leads': buckets['won'] or 0,
                'Lost leads': buckets['lost'] or 0,
            },
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
        # get_object() already scopes lead-scoped roles to their own leads.
        lead = self.get_object()
        new_status = request.data.get('status')
        if new_status == 'Follow-up':
            new_status = 'New'
        if new_status not in dict(Lead.STATUS_CHOICES):
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        lead.status = new_status
        lead.save(update_fields=['status', 'updated_at'])
        if new_status in ('Won', 'Lost'):
            from .followup_sync import close_scheduled_follow_ups_for_closed_lead
            close_scheduled_follow_ups_for_closed_lead(lead)
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

        # Tele Sales Executives are valid assignees (Tele portal My Leads =
        # assigned_to filter). Any other active non-deleted account is fine too.
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
    queryset = FollowUp.objects.select_related('lead', 'lead__assigned_to', 'lead__created_by', 'created_by').all()
    serializer_class = FollowUpSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Lead'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['lead', 'follow_up_type', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset().filter(is_deleted=False, lead__is_deleted=False)
        user = self.request.user
        owner_q = lead_owner_q(user, prefix='lead__')
        if owner_q is not None:
            return qs.filter(owner_q)
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
    queryset = Quotation.objects.select_related('lead', 'project', 'customer', 'created_by').prefetch_related('items').all()
    serializer_class = QuotationSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Quotation'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['lead', 'status', 'customer', 'project']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset().filter(is_deleted=False)
        category = (self.request.query_params.get('category') or '').strip().lower()
        # Final Quotation page: active Final only (Approved). Superseded drops out automatically.
        if category in ('final', 'final_quotation'):
            qs = qs.filter(status='Approved').filter(Q(lead__isnull=True) | Q(lead__is_deleted=False))
        elif category in ('previous_final', 'superseded'):
            qs = qs.filter(status='Superseded').filter(Q(lead__isnull=True) | Q(lead__is_deleted=False))
        else:
            qs = qs.filter(lead__is_deleted=False)
        # Sales / Tele Sales Executives see only quotations on their own leads
        owner_q = lead_owner_q(self.request.user, prefix='lead__')
        if owner_q is not None:
            qs = qs.filter(owner_q)
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

    @action(detail=True, methods=['post'], url_path='mark-as-final')
    def mark_as_final(self, request, pk=None):
        """Mark this quotation as the single active Final Quotation for its project/lead.

        Previous Final (Approved) quotes for the same project (preferred) or lead
        become Superseded — records are never deleted or duplicated.
        Locks the Project/Lead parent row to prevent concurrent dual-Final races.
        """
        from apps.projects.models import Project

        quotation = self.get_object()
        with transaction.atomic():
            locked = Quotation.objects.select_for_update().filter(pk=quotation.pk, is_deleted=False).first()
            if not locked:
                raise PermissionDenied('Quotation not found.')

            # Lock stable parent scope first (Project preferred, else Lead).
            if locked.project_id:
                Project.objects.select_for_update().filter(pk=locked.project_id).first()
            elif locked.lead_id:
                Lead.objects.select_for_update().filter(pk=locked.lead_id).first()

            # Idempotent: already the active Final.
            if locked.status == 'Approved' and locked.pricing_frozen:
                return Response(self.get_serializer(locked).data)

            scope = Quotation.objects.select_for_update().filter(is_deleted=False)
            if locked.project_id:
                scope = scope.filter(project_id=locked.project_id)
            elif locked.lead_id:
                scope = scope.filter(lead_id=locked.lead_id)
            else:
                scope = scope.filter(pk=locked.pk)
            scope.filter(status='Approved').exclude(pk=locked.pk).update(
                status='Superseded',
                pricing_frozen=True,
            )
            locked.status = 'Approved'
            locked.pricing_frozen = True
            locked.finalized_by = request.user if getattr(request.user, 'is_authenticated', False) else None
            locked.finalized_at = timezone.now()
            locked.save(update_fields=[
                'status', 'pricing_frozen', 'finalized_by', 'finalized_at', 'updated_at',
            ])
        return Response(self.get_serializer(locked).data)

    @action(detail=True, methods=['post'], url_path='create-revision')
    def create_revision(self, request, pk=None):
        """Clone a frozen Final quotation into a new editable Draft revision."""
        from apps.leads.models import QuotationItem

        source = self.get_object()
        with transaction.atomic():
            revision = Quotation.objects.get(pk=source.pk)
            revision.pk = None
            revision.id = None
            revision.quotation_number = None
            revision.status = 'Draft'
            revision.pricing_frozen = False
            revision.revision_of_id = source.pk
            revision.created_by = request.user
            revision.save()
            for item in source.items.all():
                QuotationItem.objects.create(
                    quotation=revision,
                    item_name=item.item_name,
                    brand=item.brand,
                    specification=item.specification,
                    quantity=item.quantity,
                    unit=item.unit,
                    rate=item.rate,
                    amount=item.amount,
                )
            revision.recalculate_totals()
        return Response(self.get_serializer(revision).data, status=status.HTTP_201_CREATED)
