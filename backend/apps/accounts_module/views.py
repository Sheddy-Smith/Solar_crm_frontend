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
        # Won Client Ledger: only parties linked to at least one Won lead (by mobile).
        won_only = str(self.request.query_params.get('won_only') or '').lower() in ('1', 'true', 'yes')
        if won_only:
            from apps.leads.models import Lead
            from django.db.models import Q

            phones = set()
            for mobile in Lead.objects.filter(is_deleted=False, status='Won').exclude(mobile_number='').values_list('mobile_number', flat=True):
                key = normalize_phone(mobile)
                if key:
                    phones.add(key)
            if not phones:
                return qs.none()
            phone_q = Q()
            for key in phones:
                phone_q |= Q(phone=key) | Q(phone__endswith=key)
            qs = qs.filter(account_type='Customer').filter(phone_q).distinct()
        return qs

    def _normalize_customer_phone(self, validated_data, instance=None):
        account_type = validated_data.get('account_type') or (instance.account_type if instance else 'Customer')
        if account_type != 'Customer':
            return
        if 'phone' not in validated_data and instance is not None:
            return
        phone = normalize_phone(validated_data.get('phone', instance.phone if instance else ''))
        if not phone:
            if account_type == 'Customer' and not instance:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'phone': 'Mobile number is required for customers.'})
            return
        existing = find_party_by_phone(phone)
        if existing and (instance is None or existing.id != instance.id):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'phone': f'Customer already exists for mobile {phone}. One mobile = one customer (multiple projects allowed).',
            })
        validated_data['phone'] = phone

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

        Lead-scoped roles only sync their own assigned/created leads."""
        from apps.leads.models import Lead

        lead_qs = Lead.objects.filter(is_deleted=False)
        owner_q = lead_owner_q(request.user)
        if owner_q is not None:
            lead_qs = lead_qs.filter(owner_q)
        result = ensure_customers_from_all_leads(created_by=request.user, lead_qs=lead_qs)
        return Response({'ok': True, **result})

    @action(detail=False, methods=['get'], url_path='customer-directory')
    def customer_directory(self, request):
        """Customer Details feed: sync from leads, then return customers + lead/project counts."""
        from apps.leads.models import Lead
        from apps.projects.models import Project

        lead_qs = Lead.objects.filter(is_deleted=False)
        owner_q = lead_owner_q(request.user)
        if owner_q is not None:
            lead_qs = lead_qs.filter(owner_q)

        sync = ensure_customers_from_all_leads(created_by=request.user, lead_qs=lead_qs)
        parties_qs = Account.objects.filter(account_type='Customer').select_related('created_by').order_by('-updated_at')
        parties = list(filter_customer_parties_for_user(parties_qs, request.user))

        leads = list(
            lead_qs.exclude(mobile_number='')
            .values('id', 'customer_name', 'mobile_number', 'project_name', 'status', 'category', 'priority', 'address', 'city')
        )
        leads_by_phone = {}
        for lead in leads:
            key = normalize_phone(lead['mobile_number'])
            if not key:
                continue
            leads_by_phone.setdefault(key, []).append(lead)

        project_qs = Project.objects.filter(is_deleted=False)
        if owner_q is not None:
            project_qs = project_qs.filter(lead_owner_q(request.user, prefix='lead__'))
        project_rows = list(
            project_qs.values('id', 'project_name', 'customer_name', 'lead_id', 'lead__mobile_number', 'status')
        )
        projects_by_phone = {}
        for project in project_rows:
            key = normalize_phone(project.get('lead__mobile_number'))
            if not key:
                continue
            projects_by_phone.setdefault(key, []).append(project)

        results = []
        for party in parties:
            key = normalize_phone(party.phone)
            party_leads = leads_by_phone.get(key, [])
            party_projects = projects_by_phone.get(key, [])
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
            data = AccountSerializer(party).data
            data['leads_count'] = len(party_leads)
            data['projects_count'] = max(len(party_projects), len(projects))
            data['project_labels'] = project_labels
            data['projects'] = projects
            data['lead_statuses'] = sorted({(lead.get('status') or 'New') for lead in party_leads})
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

        from .customer_ledger import build_ledger_entries, infer_relation, party_totals, visit_count, ledger_summary
        from apps.projects.work_completion import party_work_profile

        entries = build_ledger_entries(party, start=start, end=end)
        totals = party_totals(party)
        summary = ledger_summary(party, entries, start=start)
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
        }
        return Response({
            'party': AccountSerializer(party).data,
            'visits': visit_count(party),
            'relation': infer_relation(party, totals['net'], totals['yearly']),
            'totals': {
                'opening': float(totals['opening']),
                'debit': float(totals['debit']),
                'credit': float(totals['credit']),
                'net': float(totals['net']),
            },
            'summary': summary,
            'work_profile': work,
            'results': entries,
        })

    @action(detail=False, methods=['post'], url_path='fix-duplicates')
    def fix_duplicates(self, request):
        from apps.leads.models import Lead
        from .customer_ledger import merge_duplicate_customers_by_phone

        lead_qs = Lead.objects.filter(is_deleted=False)
        owner_q = lead_owner_q(request.user)
        if owner_q is not None:
            lead_qs = lead_qs.filter(owner_q)
        sync = ensure_customers_from_all_leads(created_by=request.user, lead_qs=lead_qs)
        # Duplicate merge is global admin work — scoped users only sync their customers.
        if owner_q is not None:
            return Response({'ok': True, 'sync': sync, 'merge': {'skipped': True, 'reason': 'scoped_user'}})
        merge = merge_duplicate_customers_by_phone()
        return Response({'ok': True, 'sync': sync, 'merge': merge})

    @action(detail=False, methods=['get'], url_path='credit-ledger')
    def credit_ledger(self, request):
        from .customer_ledger import credit_ledger_rows

        rows = credit_ledger_rows()
        keys = owned_customer_phone_keys(request.user)
        if keys is None:
            return Response(rows)
        scoped = [row for row in rows if normalize_phone(row.get('phone')) in keys]
        return Response(scoped)

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

        entry = CustomerLedgerManualEntry.objects.create(
            party=party,
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
                for project in projects_for_party(party):
                    if not project.total_value or project.total_value == 0:
                        project.total_value = amount
                        project.save(update_fields=['total_value', 'updated_at'])
                    lead = getattr(project, 'lead', None)
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
            },
            'party': AccountSerializer(party).data,
        }, status=status.HTTP_201_CREATED)

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
        payload = {
            'entry_date': entry_date,
            'vehicle_no': str(request.data.get('vehicle_no') or '').strip()[:40],
            'wheeler': str(request.data.get('wheeler') or '').strip()[:40],
            'owner_name': str(request.data.get('owner_name') or '').strip()[:200],
            'work': str(request.data.get('work') or request.data.get('particulars') or '').strip(),
            'debit': debit,
            'credit': credit,
        }
        return payload, None

    @staticmethod
    def _vendor_manual_entry_payload(entry):
        return {
            'id': entry.id,
            'entry_date': entry.entry_date.isoformat(),
            'vehicle_no': entry.vehicle_no,
            'wheeler': entry.wheeler,
            'owner_name': entry.owner_name,
            'work': entry.work,
            'debit': float(entry.debit),
            'credit': float(entry.credit),
        }

    @action(detail=True, methods=['post'], url_path='add-vendor-manual-entry')
    def add_vendor_manual_entry(self, request, pk=None):
        """Vendor Ledger — Add Manual Entry (Date / Vehicle / Work / Debit / Credit)."""
        party = self.get_object()
        if party.account_type != 'Vendor':
            return Response({'detail': 'Manual vendor entries are only for Vendor accounts.'}, status=status.HTTP_400_BAD_REQUEST)
        payload, error = self._parse_vendor_manual_payload(request)
        if error:
            return error
        entry = VendorLedgerManualEntry.objects.create(party=party, created_by=request.user, **payload)
        if payload['vehicle_no'] and not (party.vehicle_number or '').strip():
            party.vehicle_number = payload['vehicle_no']
            party.save(update_fields=['vehicle_number', 'updated_at'])
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
