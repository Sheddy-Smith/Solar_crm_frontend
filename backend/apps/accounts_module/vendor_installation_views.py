"""API for solar vendor installation assignments, stages, payments, templates."""
from datetime import date
from decimal import Decimal, InvalidOperation

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModulePermission
from apps.accounts_module.models import (
    Account,
    VendorInstallationAssignment,
    VendorInstallationStage,
    VendorInstallStageTemplate,
)
from apps.accounts_module.vendor_installation import (
    approve_stage,
    assign_installation_vendor,
    ensure_default_stage_templates,
    realign_assignment_stages,
    record_installation_payment,
    serialize_assignment,
    serialize_stage,
    validate_stage_templates_total,
    vendor_credit_ledger_rows,
    vendor_installation_summary,
)
from apps.projects.models import Project


class VendorInstallStageTemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModulePermission]
    permission_module = 'Vendors'
    queryset = VendorInstallStageTemplate.objects.all()

    def list(self, request, *args, **kwargs):
        ensure_default_stage_templates()
        rows = list(VendorInstallStageTemplate.objects.filter(is_active=True).order_by('sort_order', 'id'))
        return Response([
            {
                'id': r.id,
                'name': r.name,
                'percentage': float(r.percentage),
                'sort_order': r.sort_order,
                'is_active': r.is_active,
            }
            for r in rows
        ] + [{'total_percent': float(validate_stage_templates_total(rows))}])

    def create(self, request, *args, **kwargs):
        name = str(request.data.get('name') or '').strip()
        if not name:
            return Response({'detail': 'Stage name required'}, status=400)
        try:
            pct = Decimal(str(request.data.get('percentage') or '0'))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'detail': 'Invalid percentage'}, status=400)
        row = VendorInstallStageTemplate.objects.create(
            name=name[:120],
            percentage=pct,
            sort_order=int(request.data.get('sort_order') or 0),
            is_active=True,
        )
        return Response({'id': row.id, 'name': row.name, 'percentage': float(row.percentage)}, status=201)

    def partial_update(self, request, *args, **kwargs):
        row = self.get_object()
        if 'name' in request.data:
            row.name = str(request.data.get('name') or row.name).strip()[:120]
        if 'percentage' in request.data:
            try:
                row.percentage = Decimal(str(request.data.get('percentage') or 0))
            except (InvalidOperation, TypeError, ValueError):
                return Response({'detail': 'Invalid percentage'}, status=400)
        if 'sort_order' in request.data:
            row.sort_order = int(request.data.get('sort_order') or 0)
        if 'is_active' in request.data:
            row.is_active = bool(request.data.get('is_active'))
        row.save()
        active = VendorInstallStageTemplate.objects.filter(is_active=True)
        total = validate_stage_templates_total(active)
        return Response({
            'id': row.id,
            'name': row.name,
            'percentage': float(row.percentage),
            'total_percent': float(total),
            'valid': total == Decimal('100') or total == Decimal('100.00'),
        })


class VendorInstallationAssignmentViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, HasModulePermission]
    permission_module = 'Vendors'

    def list(self, request):
        ensure_default_stage_templates()
        qs = VendorInstallationAssignment.objects.select_related(
            'project', 'vendor',
        ).prefetch_related('stages', 'payments').filter(is_cancelled=False)
        vendor_id = request.query_params.get('vendor_id')
        project_id = request.query_params.get('project_id')
        if vendor_id:
            qs = qs.filter(vendor_id=vendor_id)
        if project_id:
            qs = qs.filter(project_id=project_id)
        rows = []
        for assignment in qs[:200]:
            realign_assignment_stages(assignment)
            assignment.refresh_from_db()
            rows.append(serialize_assignment(assignment))
        return Response(rows)

    def retrieve(self, request, pk=None):
        ensure_default_stage_templates()
        assignment = VendorInstallationAssignment.objects.select_related(
            'project', 'vendor',
        ).prefetch_related('stages', 'payments').filter(pk=pk).first()
        if not assignment:
            return Response({'detail': 'Not found'}, status=404)
        realign_assignment_stages(assignment)
        assignment.refresh_from_db()
        return Response(serialize_assignment(assignment))

    def create(self, request):
        project_id = request.data.get('project_id')
        vendor_id = request.data.get('vendor_id')
        project = Project.objects.filter(pk=project_id, is_deleted=False).first()
        vendor = Account.objects.filter(pk=vendor_id, account_type='Vendor').first()
        if not project or not vendor:
            return Response({'detail': 'Valid project_id and vendor_id required'}, status=400)
        try:
            rate = Decimal(str(request.data.get('rate') or '0'))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'detail': 'Invalid rate'}, status=400)
        rate_unit = request.data.get('rate_unit') or VendorInstallationAssignment.RATE_PER_WATT
        start = request.data.get('start_date') or None
        expected = request.data.get('expected_completion_date') or None
        try:
            start_date = date.fromisoformat(str(start)[:10]) if start else None
            expected_date = date.fromisoformat(str(expected)[:10]) if expected else None
        except ValueError:
            return Response({'detail': 'Invalid dates'}, status=400)
        try:
            assignment = assign_installation_vendor(
                project=project,
                vendor=vendor,
                rate=rate,
                rate_unit=rate_unit,
                capacity_kw=request.data.get('capacity_kw'),
                work_description=str(request.data.get('work_description') or ''),
                start_date=start_date,
                expected_completion_date=expected_date,
                advance_payment=request.data.get('advance_payment') or 0,
                payment_terms=str(request.data.get('payment_terms') or ''),
                remarks=str(request.data.get('remarks') or ''),
                user=request.user,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(serialize_assignment(assignment), status=201)

    @action(detail=True, methods=['post'], url_path='approve-stage')
    def approve_stage_action(self, request, pk=None):
        assignment = VendorInstallationAssignment.objects.filter(pk=pk).first()
        if not assignment:
            return Response({'detail': 'Not found'}, status=404)
        stage_id = request.data.get('stage_id')
        stage = assignment.stages.filter(pk=stage_id).first()
        if not stage:
            return Response({'detail': 'Stage not found'}, status=404)
        approve_stage(stage, user=request.user, remarks=str(request.data.get('remarks') or ''))
        assignment.refresh_from_db()
        return Response(serialize_assignment(assignment))

    @action(detail=True, methods=['post'], url_path='update-stage')
    def update_stage_action(self, request, pk=None):
        assignment = VendorInstallationAssignment.objects.filter(pk=pk).first()
        if not assignment:
            return Response({'detail': 'Not found'}, status=404)
        stage = assignment.stages.filter(pk=request.data.get('stage_id')).first()
        if not stage:
            return Response({'detail': 'Stage not found'}, status=404)
        if 'status' in request.data:
            stage.status = str(request.data.get('status'))
        if 'work_remarks' in request.data:
            stage.work_remarks = str(request.data.get('work_remarks') or '')
        if 'start_date' in request.data and request.data.get('start_date'):
            stage.start_date = date.fromisoformat(str(request.data.get('start_date'))[:10])
        if 'completion_date' in request.data and request.data.get('completion_date'):
            stage.completion_date = date.fromisoformat(str(request.data.get('completion_date'))[:10])
        if stage.status == VendorInstallationStage.STATUS_SUBMITTED:
            stage.submitted_by = request.user
        stage.save()
        return Response(serialize_stage(stage))

    @action(detail=True, methods=['post'], url_path='add-payment')
    def add_payment(self, request, pk=None):
        assignment = VendorInstallationAssignment.objects.filter(pk=pk).first()
        if not assignment:
            return Response({'detail': 'Not found'}, status=404)
        try:
            amount = Decimal(str(request.data.get('amount') or '0'))
            pay_date = date.fromisoformat(str(request.data.get('payment_date') or date.today())[:10])
        except (InvalidOperation, TypeError, ValueError):
            return Response({'detail': 'Invalid amount/date'}, status=400)
        try:
            payment = record_installation_payment(
                assignment=assignment,
                amount=amount,
                payment_date=pay_date,
                payment_mode=str(request.data.get('payment_mode') or 'Cash'),
                reference_no=str(request.data.get('reference_no') or ''),
                remarks=str(request.data.get('remarks') or ''),
                proof_url=str(request.data.get('proof_url') or ''),
                is_advance=bool(request.data.get('is_advance')),
                user=request.user,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        assignment.refresh_from_db()
        return Response({
            'payment': {
                'id': payment.id,
                'amount': float(payment.amount),
                'payment_date': payment.payment_date.isoformat(),
            },
            'assignment': serialize_assignment(assignment),
        }, status=201)


class VendorInstallationSummaryView(APIView):
    permission_classes = [IsAuthenticated, HasModulePermission]
    permission_module = 'Vendors'

    def get(self, request, vendor_id):
        vendor = Account.objects.filter(pk=vendor_id, account_type='Vendor').first()
        if not vendor:
            return Response({'detail': 'Vendor not found'}, status=404)
        return Response(vendor_installation_summary(vendor))


class VendorOverallCreditLedgerView(APIView):
    permission_classes = [IsAuthenticated, HasModulePermission]
    permission_module = 'Vendors'

    def get(self, request):
        rows = vendor_credit_ledger_rows()
        total_debit = sum(r['debit'] for r in rows)
        total_credit = sum(r['credit'] for r in rows)
        return Response({
            'rows': rows,
            'totals': {
                'debit': total_debit,
                'credit': total_credit,
                'net': total_credit - total_debit,
                'install_payable': sum(r['install_payable'] for r in rows),
            },
        })
