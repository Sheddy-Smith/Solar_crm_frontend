from datetime import date
from decimal import Decimal, InvalidOperation
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    ChartOfAccount, Account, BankAccount, Payment, Cheque, Transaction,
    AccountCategoryMap, CustomerLedgerManualEntry, VendorLedgerManualEntry,
)
from .serializers import (
    ChartOfAccountSerializer, AccountSerializer, BankAccountSerializer,
    PaymentSerializer, ChequeSerializer, TransactionSerializer, AccountCategoryMapSerializer,
)
from .services import (
    after_payment_saved, before_payment_delete, after_payment_deleted, accounts_dashboard_summary,
    recalculate_party_balance, ensure_customers_from_all_leads, find_party_by_phone, normalize_phone,
    filter_customer_parties_for_user, owned_customer_phone_keys,
)
from apps.accounts.permissions import HasModulePermission, lead_owner_q


class AccountsBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [HasModulePermission]
    permission_module = 'Accounts'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AccountCategoryMapViewSet(viewsets.ModelViewSet):
    queryset = AccountCategoryMap.objects.select_related('chart_account').all()
    serializer_class = AccountCategoryMapSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Accounts'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['business_module', 'is_active', 'chart_account']
    search_fields = ['business_category', 'notes', 'chart_account__account_code', 'chart_account__account_name']
    ordering = ['business_module', 'business_category']

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        from .category_map import ensure_recommended_coa
        result = ensure_recommended_coa()
        return Response({'ok': True, **result})


class ChartOfAccountViewSet(viewsets.ModelViewSet):
    queryset = ChartOfAccount.objects.select_related('parent').all()
    serializer_class = ChartOfAccountSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Accounts'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['account_type', 'is_active']
    search_fields = ['account_code', 'account_name']

    @action(detail=False, methods=['post'], url_path='seed-recommended')
    def seed_recommended(self, request):
        from .category_map import ensure_recommended_coa
        result = ensure_recommended_coa()
        return Response({'ok': True, **result})


class AccountViewSet(AccountsBaseViewSet):
    """Customer UI uses this ViewSet — allow Customer OR Accounts module perms.

    Sales / Tele Sales Executives only see Customer parties linked to leads they
    own (assigned to them or created by them)."""

    serializer_class = AccountSerializer
    permission_modules = ('Customer', 'Accounts')
    filterset_fields = ['account_type', 'status']
    search_fields = ['name', 'contact_person', 'company', 'phone', 'email', 'city', 'gstin', 'address', 'vehicle_number', 'vendor_type']

    def get_queryset(self):
        qs = Account.objects.select_related('created_by').all()
        qs = filter_customer_parties_for_user(qs, self.request.user)
        # Client Ledger: Won leads OR any lead that already has a quotation
        # (quotation materials/pricing post to that customer account).
        won_only = str(self.request.query_params.get('won_only') or '').lower() in ('1', 'true', 'yes')
        if won_only:
            qs = self._won_customer_queryset(qs)
        return qs

    def _won_customer_queryset(self, qs=None):
        """Customers linked to Won leads OR non-rejected quotations (indexed phone + customer FK)."""
        from django.db.models import Q
        from apps.leads.models import Lead, Quotation

        if qs is None:
            qs = Account.objects.select_related('created_by').all()
            qs = filter_customer_parties_for_user(qs, self.request.user)

        lead_qs = Lead.objects.filter(is_deleted=False)
        owner_q = lead_owner_q(self.request.user)
        if owner_q is not None:
            lead_qs = lead_qs.filter(owner_q)

        phones = set(
            lead_qs.filter(status='Won')
            .exclude(normalized_mobile='')
            .values_list('normalized_mobile', flat=True)
        )
        # Backfill sparse rows where normalized_mobile is empty but mobile exists.
        for mobile in (
            lead_qs.filter(status='Won', normalized_mobile='')
            .exclude(mobile_number='')
            .values_list('mobile_number', flat=True)[:2000]
        ):
            key = normalize_phone(mobile)
            if key:
                phones.add(key)

        quoted_lead_ids = (
            Quotation.objects.filter(is_deleted=False)
            .exclude(status='Rejected')
            .values_list('lead_id', flat=True)
            .distinct()
        )
        phones.update(
            lead_qs.filter(id__in=quoted_lead_ids)
            .exclude(normalized_mobile='')
            .values_list('normalized_mobile', flat=True)
        )
        for mobile in (
            lead_qs.filter(id__in=quoted_lead_ids, normalized_mobile='')
            .exclude(mobile_number='')
            .values_list('mobile_number', flat=True)[:2000]
        ):
            key = normalize_phone(mobile)
            if key:
                phones.add(key)

        phones = {p for p in phones if p and len(str(p)) >= 10}
        customer_ids = set(
            lead_qs.filter(status='Won', customer_id__isnull=False)
            .values_list('customer_id', flat=True)
        )
        customer_ids.update(
            lead_qs.filter(id__in=quoted_lead_ids, customer_id__isnull=False)
            .values_list('customer_id', flat=True)
        )

        if not phones and not customer_ids:
            return qs.none()

        match = Q(pk__in=customer_ids) if customer_ids else Q()
        if phones:
            match |= Q(normalized_phone__in=phones) | Q(phone__in=phones)
            # Legacy un-normalized Account.phone (+91 / spaces) still match via endswith.
            for key in phones:
                match |= Q(phone__endswith=key) | Q(alternate_phone__endswith=key)
        return (
            qs.filter(account_type='Customer')
            .exclude(status='Merged')
            .filter(match)
            .distinct()
        )

    def _normalize_customer_phone(self, validated_data, instance=None):
        account_type = validated_data.get('account_type') or (instance.account_type if instance else 'Customer')
        if account_type != 'Customer':
            return
        if 'phone' not in validated_data and instance is not None:
            # Still normalize alternate when present.
            if 'alternate_phone' in validated_data and validated_data.get('alternate_phone'):
                validated_data['alternate_phone'] = normalize_phone(validated_data['alternate_phone']) or validated_data['alternate_phone']
            return
        phone = normalize_phone(validated_data.get('phone', instance.phone if instance else ''))
        if not phone:
            if account_type == 'Customer' and not instance:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'phone': 'Mobile number is required for customers.'})
            return
        # Block create/update onto another Active customer phone — never auto-merge.
        existing = find_party_by_phone(phone)
        if existing and (instance is None or existing.id != instance.id):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'phone': (
                    f'Customer already exists for mobile {phone} '
                    f'(ACC-{existing.id:04d} — {existing.name}). '
                    'Use Customer Merge to combine records intentionally.'
                ),
                'duplicate_customer_id': existing.id,
            })
        validated_data['phone'] = phone
        if 'alternate_phone' in validated_data and validated_data.get('alternate_phone'):
            validated_data['alternate_phone'] = normalize_phone(validated_data['alternate_phone']) or validated_data['alternate_phone']

    def list(self, request, *args, **kwargs):
        # Refresh Vendor Net Balance after payable formula fix
        # (Contract/work credit − payments = Payable, e.g. 5700 − 1000 = 4700).
        if str(request.query_params.get('account_type') or '') == 'Vendor':
            for party_id in (
                self.filter_queryset(self.get_queryset())
                .filter(account_type='Vendor')
                .values_list('id', flat=True)[:300]
            ):
                recalculate_party_balance(party_id)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        self._normalize_customer_phone(serializer.validated_data)
        opening = serializer.validated_data.get('opening_balance', 0)
        serializer.save(created_by=self.request.user, balance=opening)

    def perform_update(self, serializer):
        self._normalize_customer_phone(serializer.validated_data, instance=serializer.instance)
        instance = serializer.save()
        recalculate_party_balance(instance.id)

    @action(detail=False, methods=['post'], url_path='sync-from-leads')
    def sync_from_leads(self, request):
        """Create/update Customer parties from leads, keyed by mobile.

        Lead-scoped roles only sync their own assigned/created leads.
        Pass won_only=1 to sync only Won leads (fast path for Customer Ledger picker)."""
        from apps.leads.models import Lead

        lead_qs = Lead.objects.filter(is_deleted=False)
        owner_q = lead_owner_q(request.user)
        if owner_q is not None:
            lead_qs = lead_qs.filter(owner_q)
        won_only = str(
            request.data.get('won_only') or request.query_params.get('won_only') or ''
        ).lower() in ('1', 'true', 'yes')
        if won_only:
            lead_qs = lead_qs.filter(status='Won')
        result = ensure_customers_from_all_leads(created_by=request.user, lead_qs=lead_qs)
        return Response({'ok': True, **result})

    @action(detail=False, methods=['get'], url_path='won-clients')
    def won_clients(self, request):
        """Fast Customer Ledger picker: all Won/quoted customers (no page_size cap)."""
        from django.db.models import Count
        from apps.leads.models import Lead

        qs = self._won_customer_queryset()
        lead_qs = Lead.objects.filter(is_deleted=False, status='Won')
        owner_q = lead_owner_q(request.user)
        if owner_q is not None:
            lead_qs = lead_qs.filter(owner_q)

        won_by_customer = dict(
            lead_qs.filter(customer_id__isnull=False)
            .values('customer_id')
            .annotate(c=Count('id'))
            .values_list('customer_id', 'c')
        )
        won_by_phone = dict(
            lead_qs.exclude(normalized_mobile='')
            .values('normalized_mobile')
            .annotate(c=Count('id'))
            .values_list('normalized_mobile', 'c')
        )

        results = []
        slim = (
            qs.order_by('name')
            .select_related(None)
            .only('id', 'name', 'phone', 'alternate_phone', 'normalized_phone', 'company', 'city', 'status')
        )
        for party in slim:
            phone = party.normalized_phone or normalize_phone(party.phone) or ''
            won_count = won_by_customer.get(party.id, 0) or won_by_phone.get(phone, 0)
            results.append({
                'id': party.id,
                'record_no': f'ACC-{party.id:04d}',
                'name': party.name,
                'phone': party.phone or '',
                'alternate_phone': party.alternate_phone or '',
                'normalized_phone': phone,
                'company': party.company or '',
                'city': party.city or '',
                'status': party.status,
                'account_type': 'Customer',
                'won_count': won_count,
            })
        return Response({'results': results, 'count': len(results)})

    @action(detail=False, methods=['get'], url_path='customer-directory')
    def customer_directory(self, request):
        """Customer Details feed: customers + lead/project counts (sync optional via ?sync=1)."""
        from django.db.models import Count, Q
        from apps.leads.models import Lead
        from apps.projects.models import Project

        lead_qs = Lead.objects.filter(is_deleted=False)
        owner_q = lead_owner_q(request.user)
        if owner_q is not None:
            lead_qs = lead_qs.filter(owner_q)

        do_sync = str(request.query_params.get('sync') or '').lower() in ('1', 'true', 'yes')
        if do_sync:
            sync = ensure_customers_from_all_leads(created_by=request.user, lead_qs=lead_qs)
        else:
            sync = {'created': 0, 'updated': 0, 'linked': 0, 'skipped_sync': True}

        parties_qs = (
            Account.objects.filter(account_type='Customer')
            .select_related('created_by')
            .annotate(projects_count_db=Count('projects', filter=Q(projects__is_deleted=False)))
            .order_by('-updated_at')
        )
        parties = list(filter_customer_parties_for_user(parties_qs, request.user))

        leads = list(
            lead_qs.exclude(mobile_number='')
            .values(
                'id', 'customer_name', 'mobile_number', 'normalized_mobile',
                'project_name', 'status', 'category', 'priority', 'address', 'city',
            )
        )
        leads_by_phone = {}
        for lead in leads:
            key = lead.get('normalized_mobile') or normalize_phone(lead['mobile_number'])
            if not key:
                continue
            leads_by_phone.setdefault(key, []).append(lead)

        project_qs = Project.objects.filter(is_deleted=False)
        if owner_q is not None:
            project_qs = project_qs.filter(
                Q(lead_owner_q(request.user, prefix='lead__')) | Q(lead__isnull=True, customer__isnull=False)
            )
        project_rows = list(
            project_qs.values(
                'id', 'project_name', 'customer_name', 'customer_id', 'lead_id', 'lead__mobile_number', 'status',
            )
        )
        projects_by_phone = {}
        projects_by_customer = {}
        for project in project_rows:
            if project.get('customer_id'):
                projects_by_customer.setdefault(project['customer_id'], []).append(project)
            key = normalize_phone(project.get('lead__mobile_number'))
            if key:
                projects_by_phone.setdefault(key, []).append(project)

        results = []
        for party in parties:
            key = normalize_phone(party.phone)
            party_leads = leads_by_phone.get(key, [])
            party_projects = list(projects_by_customer.get(party.id, [])) or projects_by_phone.get(key, [])
            projects = []
            used_project_ids = set()
            for lead in party_leads:
                linked = next((p for p in party_projects if p.get('lead_id') == lead['id']), None)
                label = (lead.get('project_name') or '').strip()
                if linked and not label:
                    label = (linked.get('project_name') or linked.get('customer_name') or '').strip()
                if not label:
                    label = f"Lead #{lead['id']} ({lead.get('status') or 'New'})"
                item = {
                    'kind': 'project' if linked else 'lead',
                    'label': label,
                    'status': (linked.get('status') if linked else None) or lead.get('status') or 'New',
                    'lead_id': lead['id'],
                    'project_id': linked['id'] if linked else None,
                }
                if linked:
                    used_project_ids.add(linked['id'])
                projects.append(item)
            for project in party_projects:
                if project['id'] in used_project_ids:
                    continue
                label = (project.get('project_name') or project.get('customer_name') or '').strip() or f"Project #{project['id']}"
                projects.append({
                    'kind': 'project',
                    'label': label,
                    'status': project.get('status') or '—',
                    'lead_id': project.get('lead_id'),
                    'project_id': project['id'],
                })

            project_labels = [p['label'] for p in projects]
            # Slim payload — avoid AccountSerializer N+1 projects_count queries.
            data = {
                'id': party.id,
                'record_no': f'ACC-{party.id:04d}',
                'name': party.name,
                'account_type': party.account_type,
                'contact_person': party.contact_person or '',
                'company': party.company or '',
                'phone': party.phone or '',
                'alternate_phone': party.alternate_phone or '',
                'email': party.email or '',
                'city': party.city or '',
                'state': party.state or '',
                'address': party.address or '',
                'gstin': party.gstin or '',
                'status': party.status,
                'opening_balance': float(party.opening_balance or 0),
                'balance': float(party.balance or 0),
                'leads_count': len(party_leads),
                'projects_count': max(
                    getattr(party, 'projects_count_db', 0) or 0,
                    len(party_projects),
                    len(projects),
                ),
                'project_labels': project_labels,
                'projects': projects,
                'lead_statuses': sorted({(lead.get('status') or 'New') for lead in party_leads}),
            }
            results.append(data)

        return Response({'ok': True, 'sync': sync, 'results': results, 'count': len(results)})

    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        party = self.get_object()
        start = request.query_params.get('start') or None
        end = request.query_params.get('end') or None
        category = request.query_params.get('category') or ''

        if party.account_type == 'Supplier':
            from .supplier_ledger import build_supplier_ledger_entries, supplier_totals, supplier_ledger_summary
            entries = build_supplier_ledger_entries(party, start=start, end=end, category=category)
            totals = supplier_totals(party)
            summary = supplier_ledger_summary(party, entries, start=start)
            return Response({
                'party': AccountSerializer(party).data,
                'totals': {
                    'opening': float(totals['opening']),
                    'debit': float(totals['debit']),
                    'credit': float(totals['credit']),
                    'net': float(totals['net']),
                },
                'summary': summary,
                'results': entries,
            })

        if party.account_type == 'Vendor':
            from .vendor_ledger import build_vendor_ledger_entries, vendor_totals, vendor_ledger_summary, vendor_voucher_qs
            entries = build_vendor_ledger_entries(party, start=start, end=end, category=category)
            totals = vendor_totals(party)
            summary = vendor_ledger_summary(party, entries, start=start)
            vouchers = [
                {
                    'id': v.id,
                    'voucher_no': v.voucher_no or f'VCH-{v.id:04d}',
                    'voucher_date': v.voucher_date.isoformat() if v.voucher_date else None,
                    'category': v.category or '',
                    'particulars': v.particulars or '',
                    'amount': float(v.amount or 0),
                    'status': v.status,
                    'payment_mode': v.payment_mode,
                }
                for v in vendor_voucher_qs(party).order_by('-voucher_date', '-id')[:100]
            ]
            return Response({
                'party': AccountSerializer(party).data,
                'totals': {
                    'opening': float(totals['opening']),
                    'debit': float(totals['debit']),
                    'credit': float(totals['credit']),
                    'net': float(totals['net']),
                    'voucher_count': totals.get('voucher_count', len(vouchers)),
                },
                'summary': summary,
                'vouchers': vouchers,
                'results': entries,
            })

        from .customer_ledger import (
            build_ledger_entries, infer_relation, party_totals, visit_count, ledger_summary,
            project_ledger_breakdown,
        )
        from apps.projects.work_completion import party_work_profile

        project_id = request.query_params.get('project_id') or None
        unallocated_only = str(request.query_params.get('unallocated') or '').lower() in ('1', 'true', 'yes')
        if project_id:
            try:
                project_id = int(project_id)
            except (TypeError, ValueError):
                return Response({'detail': 'Invalid project_id.'}, status=status.HTTP_400_BAD_REQUEST)

        lite = str(request.query_params.get('lite') or '').lower() in ('1', 'true', 'yes')
        entries = build_ledger_entries(
            party, start=start, end=end, project_id=project_id, unallocated_only=unallocated_only,
        )
        totals = party_totals(party, project_id=project_id, unallocated_only=unallocated_only)
        summary = ledger_summary(party, entries, start=start)
        work = None
        if not lite:
            # Prefer ledger credits (payments) as Received Payment; fall back to project payments inside helper.
            work = party_work_profile(party, received_payment=summary.get('total_credit'))
            summary = {
                **summary,
                'project_cost': work['project_cost'],
                'work_completion_pct': work['work_completion_pct'],
                'work_done_value': work['work_done_value'],
                'received_payment': work['received_payment'],
                'outstanding_amount': work['outstanding_amount'],
                'remaining_work_value': work['remaining_work_value'],
                'projects_count': work['projects_count'],
                'scope': (
                    'project' if project_id else ('unallocated' if unallocated_only else 'consolidated')
                ),
                'project_id': project_id,
            }
            party_payload = AccountSerializer(party).data
        else:
            summary = {
                **summary,
                'scope': (
                    'project' if project_id else ('unallocated' if unallocated_only else 'consolidated')
                ),
                'project_id': project_id,
            }
            # Skip AccountSerializer N+1 projects_count on fast path.
            party_payload = {
                'id': party.id,
                'record_no': f'ACC-{party.id:04d}',
                'name': party.name,
                'account_type': party.account_type,
                'company': party.company or '',
                'phone': party.phone or '',
                'alternate_phone': party.alternate_phone or '',
                'opening_balance': float(party.opening_balance or 0),
                'balance': float(party.balance or 0),
                'status': party.status,
            }
        want_breakdown = str(request.query_params.get('breakdown') or ('0' if lite else '1')).lower() in ('1', 'true', 'yes')
        include_breakdown = want_breakdown and not project_id and not unallocated_only
        breakdown = project_ledger_breakdown(party) if include_breakdown else None
        return Response({
            'party': party_payload,
            'visits': 0 if lite else visit_count(party),
            'relation': infer_relation(party, totals['net'], totals['yearly']),
            'totals': {
                'opening': float(totals['opening']),
                'debit': float(totals['debit']),
                'credit': float(totals['credit']),
                'net': float(totals['net']),
                'invoiced': float(totals.get('invoiced') or 0),
                'received': float(totals.get('received') or 0),
                'outstanding': float(totals.get('outstanding') or 0),
            },
            'summary': summary,
            'work_profile': work,
            'breakdown': breakdown,
            'results': entries,
        })

    @action(detail=True, methods=['get'], url_path='project-accounts')
    def project_accounts(self, request, pk=None):
        party = self.get_object()
        if party.account_type != 'Customer':
            return Response({'detail': 'Only Customer parties support project accounts.'}, status=400)
        from .customer_ledger import project_ledger_breakdown
        return Response({'ok': True, 'party_id': party.id, **project_ledger_breakdown(party)})

    @action(detail=True, methods=['get'], url_path='profile')
    def profile(self, request, pk=None):
        party = self.get_object()
        if party.account_type != 'Customer':
            return Response({'detail': 'Profile is only available for Customer parties.'}, status=400)
        from .project_reconciliation import build_customer_profile
        return Response({'ok': True, **build_customer_profile(party)})

    @action(detail=False, methods=['get'], url_path='orphan-projects')
    def orphan_projects(self, request):
        from .project_reconciliation import orphan_reconciliation_report
        return Response({'ok': True, **orphan_reconciliation_report()})

    @action(detail=False, methods=['post'], url_path='link-orphan-project')
    def link_orphan_project(self, request):
        from .project_reconciliation import link_project_to_customer
        try:
            result = link_project_to_customer(
                project_id=int(request.data.get('project_id')),
                customer_id=int(request.data.get('customer_id')),
                user=request.user,
                notes=str(request.data.get('notes') or ''),
                match_reason=str(request.data.get('match_reason') or 'manual_ui'),
            )
        except (TypeError, ValueError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='create-customer-for-orphan')
    def create_customer_for_orphan(self, request):
        from .project_reconciliation import create_customer_and_link_project
        try:
            result = create_customer_and_link_project(
                project_id=int(request.data.get('project_id')),
                name=str(request.data.get('name') or ''),
                phone=str(request.data.get('phone') or ''),
                alternate_phone=str(request.data.get('alternate_phone') or ''),
                user=request.user,
                notes=str(request.data.get('notes') or ''),
            )
        except (TypeError, ValueError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='skip-orphan-project')
    def skip_orphan_project(self, request):
        from .project_reconciliation import skip_orphan_for_review
        try:
            result = skip_orphan_for_review(
                project_id=int(request.data.get('project_id')),
                user=request.user,
                notes=str(request.data.get('notes') or ''),
            )
        except (TypeError, ValueError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='apply-orphan-reconciliation')
    def apply_orphan_reconciliation(self, request):
        """Admin bulk reconcile: exact-name link + optional create-from-name."""
        if not (
            getattr(request.user, 'is_super_admin', False)
            or getattr(request.user, 'is_superuser', False)
        ):
            return Response({'detail': 'Only super admins can bulk-reconcile orphans.'}, status=status.HTTP_403_FORBIDDEN)
        from .project_reconciliation import apply_orphan_reconciliation as apply_fn
        dry_run = str(request.data.get('dry_run') or '').lower() in ('1', 'true', 'yes')
        create_missing = str(request.data.get('create_missing', 'true')).lower() in ('1', 'true', 'yes')
        try:
            result = apply_fn(user=request.user, create_missing=create_missing, dry_run=dry_run)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        actions = result.get('actions') or []
        result = {**result, 'actions': actions[:50], 'actions_total': len(actions)}
        return Response({'ok': True, **result})

    @action(detail=False, methods=['get'], url_path='detect-duplicates')
    def detect_duplicates(self, request):
        """Suggestion-only duplicate groups — never merges automatically."""
        from .customer_merge import detect_duplicate_customers
        return Response({'ok': True, 'results': detect_duplicate_customers()})

    @action(detail=False, methods=['post'], url_path='merge-preview')
    def merge_preview(self, request):
        from .customer_merge import preview_customer_merge
        try:
            source_id = int(request.data.get('source_id'))
            target_id = int(request.data.get('target_id'))
            preview = preview_customer_merge(source_id, target_id)
        except (TypeError, ValueError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'ok': True, **preview})

    @action(detail=False, methods=['post'], url_path='merge')
    def merge_customers(self, request):
        """Authorized manual Customer merge. Requires confirm=true. No auto phone merge."""
        from .customer_merge import execute_customer_merge
        if not (
            getattr(request.user, 'is_super_admin', False)
            or getattr(request.user, 'is_superuser', False)
            or HasModulePermission().has_permission(request, self)
        ):
            return Response({'detail': 'Not authorized to merge customers.'}, status=status.HTTP_403_FORBIDDEN)
        # Lead-scoped executives cannot merge globally.
        if lead_owner_q(request.user) is not None and not getattr(request.user, 'is_super_admin', False):
            return Response({'detail': 'Scoped users cannot merge Customer masters.'}, status=status.HTTP_403_FORBIDDEN)
        confirm = str(request.data.get('confirm') or '').lower() in ('1', 'true', 'yes')
        try:
            result = execute_customer_merge(
                source_id=int(request.data.get('source_id')),
                target_id=int(request.data.get('target_id')),
                user=request.user,
                notes=str(request.data.get('notes') or ''),
                confirm=confirm,
            )
        except (TypeError, ValueError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=False, methods=['get'], url_path='merge-audits')
    def merge_audits(self, request):
        from .models import CustomerMergeAudit
        rows = CustomerMergeAudit.objects.select_related('source', 'target', 'merged_by').order_by('-created_at')[:100]
        return Response({
            'results': [
                {
                    'id': row.id,
                    'source_id': row.source_id,
                    'source_name': row.source.name,
                    'target_id': row.target_id,
                    'target_name': row.target.name,
                    'merged_by': getattr(row.merged_by, 'name', None) or getattr(row.merged_by, 'email', '') or '',
                    'affected_counts': row.affected_counts,
                    'financial_snapshot': row.financial_snapshot,
                    'result': row.result,
                    'notes': row.notes,
                    'created_at': row.created_at.isoformat() if row.created_at else None,
                }
                for row in rows
            ]
        })

    @action(detail=False, methods=['post'], url_path='allocate-payment')
    def allocate_payment(self, request):
        from .customer_merge import allocate_payment_to_project
        try:
            result = allocate_payment_to_project(
                payment_id=int(request.data.get('payment_id')),
                project_id=int(request.data.get('project_id')),
                amount=request.data.get('amount'),
                user=request.user,
                notes=str(request.data.get('notes') or ''),
            )
        except (TypeError, ValueError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='fix-duplicates')
    def fix_duplicates(self, request):
        """Legacy endpoint: sync from leads + detect duplicates only (no automatic merge)."""
        from apps.leads.models import Lead
        from .customer_merge import detect_duplicate_customers

        lead_qs = Lead.objects.filter(is_deleted=False)
        owner_q = lead_owner_q(request.user)
        if owner_q is not None:
            lead_qs = lead_qs.filter(owner_q)
        sync = ensure_customers_from_all_leads(created_by=request.user, lead_qs=lead_qs)
        duplicates = detect_duplicate_customers() if owner_q is None else []
        return Response({
            'ok': True,
            'sync': sync,
            'merge': {
                'skipped': True,
                'reason': 'auto_merge_disabled_use_merge_endpoint',
                'duplicate_groups': len(duplicates),
            },
            'duplicates': duplicates,
        })

    @action(detail=False, methods=['get'], url_path='credit-ledger')
    def credit_ledger(self, request):
        from .customer_ledger import credit_ledger_rows

        rows = credit_ledger_rows()
        keys = owned_customer_phone_keys(request.user)
        if keys is None:
            return Response(rows)
        scoped = [row for row in rows['results'] if normalize_phone(row.get('phone')) in keys]
        return Response({
            **rows,
            'results': scoped,
            'total_debit': sum(float(r.get('debit') or 0) for r in scoped),
            'total_credit': sum(float(r.get('credit') or 0) for r in scoped),
            'net_balance': sum(float(r.get('net') or 0) for r in scoped),
        })

    @action(detail=True, methods=['post'])
    def settle(self, request, pk=None):
        party = self.get_object()
        try:
            amount = Decimal(str(request.data.get('amount') or '0'))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'detail': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({'detail': 'Settlement amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
        raw_date = request.data.get('payment_date') or ''
        try:
            pay_date = date.fromisoformat(str(raw_date)[:10]) if raw_date else date.today()
        except ValueError:
            pay_date = date.today()
        is_payee = party.account_type in ('Vendor', 'Supplier')
        notes = str(request.data.get('notes') or '').strip()
        particulars = str(
            request.data.get('particulars')
            or request.data.get('remarks')
            or ''
        ).strip()
        if notes and particulars:
            description = f'{particulars}\n{notes}'
        else:
            description = particulars or notes or (
                'Supplier payment' if party.account_type == 'Supplier'
                else ('Vendor payment' if is_payee else 'Settlement payment')
            )
        payment = Payment.objects.create(
            direction='Made' if is_payee else 'Received',
            payment_date=pay_date,
            party=party,
            party_name=party.name,
            payment_mode=request.data.get('payment_mode') or 'Cash',
            amount=amount,
            reference_no=str(
                request.data.get('voucher_no')
                or request.data.get('reference_no')
                or ''
            ).strip()[:100],
            description=description,
            particulars=particulars or description,
            status='Completed',
            created_by=request.user,
        )
        after_payment_saved(payment)
        party.refresh_from_db()
        return Response(AccountSerializer(party).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='add-ledger-entry')
    def add_ledger_entry(self, request, pk=None):
        """Manual Customer Ledger entry: Sale (Debit) / Payment / Discount (Credit)."""
        party = self.get_object()
        if party.account_type != 'Customer':
            return Response({'detail': 'Ledger entries can only be added for customers.'}, status=status.HTTP_400_BAD_REQUEST)

        entry_type = str(request.data.get('entry_type') or request.data.get('type') or 'sale').strip().lower()
        type_aliases = {
            'sale': 'sale',
            'sale (debit)': 'sale',
            'debit': 'sale',
            'payment': 'payment',
            'payment (credit)': 'payment',
            'credit': 'payment',
            'discount': 'discount',
            'discount (credit)': 'discount',
        }
        entry_type = type_aliases.get(entry_type, entry_type)
        valid_types = {choice[0] for choice in CustomerLedgerManualEntry.TYPE_CHOICES}
        if entry_type not in valid_types:
            return Response(
                {'detail': 'Type must be Sale (Debit), Payment (Credit), or Discount (Credit).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = Decimal(str(request.data.get('amount') or '0'))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'detail': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({'detail': 'Amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        raw_date = request.data.get('entry_date') or request.data.get('date') or ''
        try:
            entry_date = date.fromisoformat(str(raw_date)[:10]) if raw_date else date.today()
        except ValueError:
            return Response({'detail': 'Invalid date. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        vehicle_no = str(request.data.get('vehicle_no') or request.data.get('vehicle_number') or '').strip()[:40]
        reference_no = str(
            request.data.get('reference_no')
            or request.data.get('challan_no')
            or request.data.get('receipt_no')
            or ''
        ).strip()[:100]
        work = str(request.data.get('work') or request.data.get('description') or '').strip()
        payment_mode = str(request.data.get('payment_mode') or '').strip()
        valid_modes = {choice[0] for choice in CustomerLedgerManualEntry.PAYMENT_MODE_CHOICES}
        if payment_mode and payment_mode not in valid_modes:
            return Response(
                {'detail': 'Invalid payment mode.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = None
        raw_project = request.data.get('project_id') or request.data.get('project') or ''
        if str(raw_project).strip() and str(raw_project).strip() not in ('__unallocated__', 'null', 'None'):
            from .customer_ledger import resolve_project_for_customer
            try:
                project = resolve_project_for_customer(party, raw_project)
            except (TypeError, ValueError):
                project = None
            if not project:
                return Response(
                    {'detail': 'Selected project does not belong to this customer (check primary / alternate number).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        entry = CustomerLedgerManualEntry.objects.create(
            party=party,
            project=project,
            entry_date=entry_date,
            entry_type=entry_type,
            payment_mode=payment_mode,
            amount=amount,
            vehicle_no=vehicle_no,
            reference_no=reference_no,
            work=work,
            created_by=request.user,
        )
        if vehicle_no and not (party.vehicle_number or '').strip():
            party.vehicle_number = vehicle_no
            party.save(update_fields=['vehicle_number', 'updated_at'])
        # Sale amount → seed Project Cost when project/lead still has ₹0.
        if entry_type == 'sale' and amount > 0:
            try:
                from apps.projects.work_completion import projects_for_party
                from apps.accounts_module.services import normalize_phone
                from apps.leads.models import Lead
                targets = [project] if project else list(projects_for_party(party))
                for proj in targets:
                    if not proj:
                        continue
                    if not proj.total_value or proj.total_value == 0:
                        proj.total_value = amount
                        proj.save(update_fields=['total_value', 'updated_at'])
                    lead = getattr(proj, 'lead', None)
                    if lead and (not lead.project_cost or lead.project_cost == 0):
                        lead.project_cost = amount
                        lead.save(update_fields=['project_cost', 'updated_at'])
                # Won lead without project total_value path (rare) — still stamp lead.project_cost.
                key = normalize_phone(party.phone)
                if key:
                    for lead in Lead.objects.filter(is_deleted=False, status='Won').exclude(mobile_number=''):
                        if normalize_phone(lead.mobile_number) == key and (not lead.project_cost or lead.project_cost == 0):
                            lead.project_cost = amount
                            lead.save(update_fields=['project_cost', 'updated_at'])
            except Exception:
                pass
        recalculate_party_balance(party.id)
        party.refresh_from_db()
        return Response({
            'ok': True,
            'entry': {
                'id': entry.id,
                'entry_date': entry.entry_date.isoformat(),
                'entry_type': entry.entry_type,
                'payment_mode': entry.payment_mode,
                'amount': float(entry.amount),
                'vehicle_no': entry.vehicle_no,
                'reference_no': entry.reference_no,
                'work': entry.work,
                'project_id': entry.project_id,
                'project_code': getattr(entry.project, 'project_id', None) if entry.project_id else '',
                'project_name': getattr(entry.project, 'project_name', None) if entry.project_id else '',
            },
            'party': AccountSerializer(party).data,
        }, status=status.HTTP_201_CREATED)

    def _parse_customer_manual_payload(self, request, party):
        entry_type = str(request.data.get('entry_type') or request.data.get('type') or 'sale').strip().lower()
        type_aliases = {
            'sale': 'sale', 'sale (debit)': 'sale', 'debit': 'sale',
            'payment': 'payment', 'payment (credit)': 'payment', 'credit': 'payment',
            'discount': 'discount', 'discount (credit)': 'discount',
        }
        entry_type = type_aliases.get(entry_type, entry_type)
        valid_types = {choice[0] for choice in CustomerLedgerManualEntry.TYPE_CHOICES}
        if entry_type not in valid_types:
            return None, Response(
                {'detail': 'Type must be Sale (Debit), Payment (Credit), or Discount (Credit).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            amount = Decimal(str(request.data.get('amount') or '0'))
        except (InvalidOperation, TypeError, ValueError):
            return None, Response({'detail': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return None, Response({'detail': 'Amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
        raw_date = request.data.get('entry_date') or request.data.get('date') or ''
        try:
            entry_date = date.fromisoformat(str(raw_date)[:10]) if raw_date else date.today()
        except ValueError:
            return None, Response({'detail': 'Invalid date. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        payment_mode = str(request.data.get('payment_mode') or '').strip()
        valid_modes = {choice[0] for choice in CustomerLedgerManualEntry.PAYMENT_MODE_CHOICES}
        if payment_mode and payment_mode not in valid_modes:
            return None, Response({'detail': 'Invalid payment mode.'}, status=status.HTTP_400_BAD_REQUEST)
        project = None
        raw_project = request.data.get('project_id') or request.data.get('project') or ''
        if str(raw_project).strip() and str(raw_project).strip() not in ('__unallocated__', 'null', 'None'):
            from .customer_ledger import resolve_project_for_customer
            try:
                project = resolve_project_for_customer(party, raw_project)
            except (TypeError, ValueError):
                project = None
            if not project:
                return None, Response(
                    {'detail': 'Selected project does not belong to this customer (check primary / alternate number).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return {
            'entry_date': entry_date,
            'entry_type': entry_type,
            'payment_mode': payment_mode,
            'amount': amount,
            'vehicle_no': str(request.data.get('vehicle_no') or request.data.get('vehicle_number') or '').strip()[:40],
            'reference_no': str(
                request.data.get('reference_no')
                or request.data.get('challan_no')
                or request.data.get('receipt_no')
                or ''
            ).strip()[:100],
            'work': str(request.data.get('work') or request.data.get('description') or '').strip(),
            'project': project,
        }, None

    @action(detail=True, methods=['patch', 'put', 'delete'], url_path=r'manual-ledger-entries/(?P<entry_id>[^/.]+)')
    def update_manual_ledger_entry(self, request, pk=None, entry_id=None):
        party = self.get_object()
        if party.account_type != 'Customer':
            return Response({'detail': 'Ledger entries can only be updated for customers.'}, status=status.HTTP_400_BAD_REQUEST)
        entry = CustomerLedgerManualEntry.objects.filter(pk=entry_id, party_id=party.id).select_related('project').first()
        if not entry:
            return Response({'detail': 'Manual ledger entry not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            entry.delete()
            recalculate_party_balance(party.id)
            party.refresh_from_db()
            return Response({
                'ok': True,
                'deleted': True,
                'entry_id': int(entry_id),
                'party': AccountSerializer(party).data,
            })
        payload, error = self._parse_customer_manual_payload(request, party)
        if error:
            return error
        for key, value in payload.items():
            setattr(entry, key, value)
        entry.save()
        recalculate_party_balance(party.id)
        party.refresh_from_db()
        return Response({
            'ok': True,
            'entry': {
                'id': entry.id,
                'entry_date': entry.entry_date.isoformat(),
                'entry_type': entry.entry_type,
                'payment_mode': entry.payment_mode,
                'amount': float(entry.amount),
                'vehicle_no': entry.vehicle_no,
                'reference_no': entry.reference_no,
                'work': entry.work,
                'project_id': entry.project_id,
                'project_code': getattr(entry.project, 'project_id', None) if entry.project_id else '',
                'project_name': getattr(entry.project, 'project_name', None) if entry.project_id else '',
            },
            'party': AccountSerializer(party).data,
        })

    def _parse_vendor_manual_payload(self, request):
        raw_date = request.data.get('entry_date') or request.data.get('date') or ''
        try:
            entry_date = date.fromisoformat(str(raw_date)[:10]) if raw_date else date.today()
        except ValueError:
            return None, Response({'detail': 'Invalid date. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            debit = Decimal(str(request.data.get('debit') or '0'))
            credit = Decimal(str(request.data.get('credit') or '0'))
        except (InvalidOperation, TypeError, ValueError):
            return None, Response({'detail': 'Invalid debit/credit amount.'}, status=status.HTTP_400_BAD_REQUEST)
        if debit < 0 or credit < 0:
            return None, Response({'detail': 'Debit and credit cannot be negative.'}, status=status.HTTP_400_BAD_REQUEST)
        if debit <= 0 and credit <= 0:
            return None, Response({'detail': 'Enter Debit or Credit amount greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
        if debit > 0 and credit > 0:
            return None, Response({'detail': 'Enter either Debit or Credit, not both.'}, status=status.HTTP_400_BAD_REQUEST)
        project_id = request.data.get('project_id') or None
        payload = {
            'entry_date': entry_date,
            'vehicle_no': '',
            'wheeler': '',
            'owner_name': '',
            'work': str(request.data.get('work') or request.data.get('particulars') or '').strip(),
            'debit': debit,
            'credit': credit,
            'project_id': int(project_id) if project_id else None,
        }
        return payload, None

    @staticmethod
    def _vendor_manual_entry_payload(entry):
        return {
            'id': entry.id,
            'entry_date': entry.entry_date.isoformat(),
            'project_id': entry.project_id,
            'work': entry.work,
            'debit': float(entry.debit),
            'credit': float(entry.credit),
        }

    @action(detail=True, methods=['post'], url_path='add-vendor-manual-entry')
    def add_vendor_manual_entry(self, request, pk=None):
        """Vendor Ledger — Add Manual Entry (Date / Work / Debit / Credit / optional Project)."""
        party = self.get_object()
        if party.account_type != 'Vendor':
            return Response({'detail': 'Manual vendor entries are only for Vendor accounts.'}, status=status.HTTP_400_BAD_REQUEST)
        payload, error = self._parse_vendor_manual_payload(request)
        if error:
            return error
        entry = VendorLedgerManualEntry.objects.create(party=party, created_by=request.user, **payload)
        recalculate_party_balance(party.id)
        party.refresh_from_db()
        return Response({
            'ok': True,
            'entry': self._vendor_manual_entry_payload(entry),
            'party': AccountSerializer(party).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'put'], url_path=r'vendor-manual-entries/(?P<entry_id>[^/.]+)')
    def update_vendor_manual_entry(self, request, pk=None, entry_id=None):
        party = self.get_object()
        if party.account_type != 'Vendor':
            return Response({'detail': 'Manual vendor entries are only for Vendor accounts.'}, status=status.HTTP_400_BAD_REQUEST)
        entry = VendorLedgerManualEntry.objects.filter(pk=entry_id, party_id=party.id).first()
        if not entry:
            return Response({'detail': 'Manual entry not found.'}, status=status.HTTP_404_NOT_FOUND)
        payload, error = self._parse_vendor_manual_payload(request)
        if error:
            return error
        for key, value in payload.items():
            setattr(entry, key, value)
        entry.save()
        recalculate_party_balance(party.id)
        party.refresh_from_db()
        return Response({
            'ok': True,
            'entry': self._vendor_manual_entry_payload(entry),
            'party': AccountSerializer(party).data,
        })

    @action(detail=True, methods=['delete'], url_path=r'vendor-manual-entries/(?P<entry_id>[^/.]+)/delete')
    def delete_vendor_manual_entry(self, request, pk=None, entry_id=None):
        party = self.get_object()
        if party.account_type != 'Vendor':
            return Response({'detail': 'Manual vendor entries are only for Vendor accounts.'}, status=status.HTTP_400_BAD_REQUEST)
        entry = VendorLedgerManualEntry.objects.filter(pk=entry_id, party_id=party.id).first()
        if not entry:
            return Response({'detail': 'Manual entry not found.'}, status=status.HTTP_404_NOT_FOUND)
        entry.delete()
        recalculate_party_balance(party.id)
        party.refresh_from_db()
        return Response({'ok': True, 'party': AccountSerializer(party).data})


class BankAccountViewSet(AccountsBaseViewSet):
    serializer_class = BankAccountSerializer
    filterset_fields = ['status', 'account_type']
    search_fields = ['account_name', 'bank_name', 'account_number', 'ifsc', 'branch']

    def get_queryset(self):
        return BankAccount.objects.select_related('created_by').all()

    def perform_create(self, serializer):
        opening = serializer.validated_data.get('opening_balance', 0)
        serializer.save(created_by=self.request.user, balance=opening)


class PaymentViewSet(AccountsBaseViewSet):
    serializer_class = PaymentSerializer
    filterset_fields = ['direction', 'status', 'payment_mode', 'project']
    search_fields = ['reference_no', 'party_name', 'project_ref', 'description']
    ordering = ['-payment_date', '-created_at']

    def get_queryset(self):
        return Payment.objects.select_related(
            'party', 'bank_account', 'project', 'created_by',
        ).all()

    def perform_create(self, serializer):
        payment = serializer.save(created_by=self.request.user)
        after_payment_saved(payment)

    def perform_update(self, serializer):
        old_party = serializer.instance.party_id
        old_bank = serializer.instance.bank_account_id
        payment = serializer.save()
        after_payment_saved(payment, old_party_id=old_party, old_bank_id=old_bank)

    def perform_destroy(self, instance):
        party_id = instance.party_id
        bank_id = instance.bank_account_id
        before_payment_delete(instance)
        instance.delete()
        after_payment_deleted(party_id, bank_id)


class ChequeViewSet(AccountsBaseViewSet):
    serializer_class = ChequeSerializer
    filterset_fields = ['status', 'cheque_type']
    search_fields = ['cheque_no', 'payee_name']
    ordering = ['-cheque_date', '-created_at']

    def get_queryset(self):
        return Cheque.objects.select_related('bank_account', 'created_by').all()

    def perform_update(self, serializer):
        cheque = serializer.save()
        if cheque.payment_id and cheque.status == 'Cleared':
            payment = cheque.payment
            if payment and payment.status != 'Completed':
                payment.status = 'Completed'
                payment.save(update_fields=['status'])
                after_payment_saved(payment)


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.select_related(
        'debit_account', 'credit_account', 'party', 'bank_account', 'created_by', 'source_payment',
    ).all()
    serializer_class = TransactionSerializer
    permission_classes = [HasModulePermission]
    permission_module = 'Accounts'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['transaction_type', 'status']
    search_fields = ['reference_number', 'description']
    ordering = ['-transaction_date', '-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.source_payment_id or instance.source_payment_voucher_id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Auto journal entries cannot be deleted. Delete the payment/voucher instead.')
        instance.delete()

    @action(detail=False, methods=['get'])
    def summary(self, request):
        return Response(accounts_dashboard_summary())

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        return Response(accounts_dashboard_summary())
