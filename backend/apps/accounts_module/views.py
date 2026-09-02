from datetime import date
from decimal import Decimal, InvalidOperation
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import ChartOfAccount, Account, BankAccount, Payment, Cheque, Transaction, AccountCategoryMap
from .serializers import (
    ChartOfAccountSerializer, AccountSerializer, BankAccountSerializer,
    PaymentSerializer, ChequeSerializer, TransactionSerializer, AccountCategoryMapSerializer,
)
from .services import after_payment_saved, before_payment_delete, after_payment_deleted, accounts_dashboard_summary, recalculate_party_balance, ensure_customers_from_all_leads, find_party_by_phone, normalize_phone
from apps.accounts.permissions import HasModulePermission


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
    serializer_class = AccountSerializer
    filterset_fields = ['account_type', 'status']
    search_fields = ['name', 'contact_person', 'company', 'phone', 'email', 'city', 'gstin', 'address', 'vehicle_number', 'vendor_type']

    def get_queryset(self):
        return Account.objects.select_related('created_by').all()

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
        """Create/update Customer parties from all leads (any status), keyed by mobile."""
        result = ensure_customers_from_all_leads(created_by=request.user)
        return Response({'ok': True, **result})

    @action(detail=False, methods=['get'], url_path='customer-directory')
    def customer_directory(self, request):
        """Customer Details feed: sync from leads, then return customers + lead/project counts."""
        from apps.leads.models import Lead
        from apps.projects.models import Project

        sync = ensure_customers_from_all_leads(created_by=request.user)
        parties = list(Account.objects.filter(account_type='Customer').select_related('created_by').order_by('-updated_at'))

        leads = list(
            Lead.objects.filter(is_deleted=False)
            .exclude(mobile_number='')
            .values('id', 'customer_name', 'mobile_number', 'project_name', 'status', 'category', 'priority', 'address', 'city')
        )
        leads_by_phone = {}
        for lead in leads:
            key = normalize_phone(lead['mobile_number'])
            if not key:
                continue
            leads_by_phone.setdefault(key, []).append(lead)

        project_rows = list(
            Project.objects.filter(is_deleted=False)
            .values('id', 'project_name', 'customer_name', 'lead_id', 'lead__mobile_number', 'status')
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
            project_labels = []
            seen = set()
            for lead in party_leads:
                label = (lead.get('project_name') or '').strip() or f"Lead #{lead['id']} ({lead.get('status') or 'New'})"
                if label not in seen:
                    seen.add(label)
                    project_labels.append(label)
            for project in party_projects:
                label = (project.get('project_name') or project.get('customer_name') or '').strip() or f"Project #{project['id']}"
                if label not in seen:
                    seen.add(label)
                    project_labels.append(label)

            data = AccountSerializer(party).data
            data['leads_count'] = len(party_leads)
            data['projects_count'] = max(len(party_projects), len(project_labels))
            data['project_labels'] = project_labels
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
            from .supplier_ledger import build_supplier_ledger_entries, supplier_totals
            entries = build_supplier_ledger_entries(party, start=start, end=end, category=category)
            totals = supplier_totals(party)
            return Response({
                'party': AccountSerializer(party).data,
                'totals': {
                    'opening': float(totals['opening']),
                    'debit': float(totals['debit']),
                    'credit': float(totals['credit']),
                    'net': float(totals['net']),
                },
                'results': entries,
            })

        if party.account_type == 'Vendor':
            from .vendor_ledger import build_vendor_ledger_entries, vendor_totals
            entries = build_vendor_ledger_entries(party, start=start, end=end, category=category)
            totals = vendor_totals(party)
            return Response({
                'party': AccountSerializer(party).data,
                'totals': {
                    'opening': float(totals['opening']),
                    'debit': float(totals['debit']),
                    'credit': float(totals['credit']),
                    'net': float(totals['net']),
                },
                'results': entries,
            })

        from .customer_ledger import build_ledger_entries, infer_relation, party_totals, visit_count, ledger_summary
        entries = build_ledger_entries(party, start=start, end=end)
        totals = party_totals(party)
        summary = ledger_summary(party, entries, start=start)
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
            'results': entries,
        })

    @action(detail=False, methods=['post'], url_path='fix-duplicates')
    def fix_duplicates(self, request):
        from .customer_ledger import merge_duplicate_customers_by_phone
        from .services import ensure_customers_from_all_leads
        sync = ensure_customers_from_all_leads(created_by=request.user)
        merge = merge_duplicate_customers_by_phone()
        return Response({'ok': True, 'sync': sync, 'merge': merge})

    @action(detail=False, methods=['get'], url_path='credit-ledger')
    def credit_ledger(self, request):
        from .customer_ledger import credit_ledger_rows
        return Response(credit_ledger_rows())

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
        payment = Payment.objects.create(
            direction='Made' if is_payee else 'Received',
            payment_date=pay_date,
            party=party,
            party_name=party.name,
            payment_mode=request.data.get('payment_mode') or 'Cash',
            amount=amount,
            description=request.data.get('remarks') or ('Vendor payment' if is_payee else 'Settlement payment'),
            particulars=request.data.get('remarks') or ('Vendor payment' if is_payee else 'Settlement'),
            status='Completed',
            created_by=request.user,
        )
        after_payment_saved(payment)
        party.refresh_from_db()
        return Response(AccountSerializer(party).data, status=status.HTTP_201_CREATED)


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
