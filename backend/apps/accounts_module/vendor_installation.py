"""Solar installation vendor assignment, stages, payments, and ledger sync."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Optional

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import (
    Account,
    Payment,
    VendorInstallationAssignment,
    VendorInstallationPayment,
    VendorInstallationStage,
    VendorInstallStageTemplate,
    VendorLedgerManualEntry,
)
from .services import recalculate_party_balance

# Canonical Installation Work Stages (must total 100%).
# Order + percentages match Project Management → Installation design.
DEFAULT_STAGES = [
    ('Structure Installation', Decimal('30')),
    ('Civil Foundation Work', Decimal('10')),
    ('Electrical - Cable & Conduiting', Decimal('15')),
    ('Earthing Work', Decimal('15')),
    ('Solar Panel Installation', Decimal('20')),
    ('Inverter Installation', Decimal('10')),
]


def _d(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')


def ensure_default_stage_templates(force_sync=True):
    """Ensure active stage templates match DEFAULT_STAGES (name, %, order).

    When force_sync is True (default), stale templates from older builds are
    deactivated and replaced so new assignments always get the design stages.
    """
    desired = list(DEFAULT_STAGES)
    existing = list(
        VendorInstallStageTemplate.objects.filter(is_active=True).order_by('sort_order', 'id')
    )
    matches = (
        len(existing) == len(desired)
        and all(
            e.name == name and _d(e.percentage) == pct and int(e.sort_order or 0) == idx
            for idx, ((name, pct), e) in enumerate(zip(desired, existing))
        )
    )
    if matches:
        return existing
    if not force_sync and existing:
        return existing

    VendorInstallStageTemplate.objects.filter(is_active=True).update(is_active=False)
    rows = []
    for idx, (name, pct) in enumerate(desired):
        rows.append(VendorInstallStageTemplate.objects.create(
            name=name, percentage=pct, sort_order=idx, is_active=True,
        ))
    return rows


def _stage_match_key(name: str) -> str:
    """Normalize stage labels so old/new names rematch (e.g. Structure Installation Work)."""
    n = str(name or '').lower()
    if 'structure' in n:
        return 'structure'
    if 'civil' in n or 'foundation' in n:
        return 'civil'
    if 'earthing' in n:
        return 'earthing'
    if 'panel' in n or ('solar' in n and 'inverter' not in n):
        return 'panel'
    if 'inverter' in n and 'electrical' not in n:
        return 'inverter'
    if 'electrical' in n or 'cable' in n or 'conduiting' in n:
        return 'electrical'
    return n.strip()


def realign_assignment_stages(assignment: VendorInstallationAssignment) -> VendorInstallationAssignment:
    """Rebuild assignment stages to match DEFAULT_STAGES while preserving Approved progress.

    Matching is keyword-based so renamed stages (e.g. Structure Installation Work →
    Structure Installation) keep approval. Payment earned % recalculates from the
    new allocated weights automatically.
    """
    templates = ensure_default_stage_templates()
    stages = list(assignment.stages.all().order_by('sort_order', 'id'))
    current = [(s.stage_name, _d(s.allocated_percent), int(s.sort_order or 0)) for s in stages]
    desired = [(t.name, _d(t.percentage), int(t.sort_order or 0)) for t in templates]
    if current == desired:
        return assignment

    approved_by_key = {}
    for stage in stages:
        if stage.status != VendorInstallationStage.STATUS_APPROVED:
            continue
        key = _stage_match_key(stage.stage_name)
        # Prefer first approved match per key.
        approved_by_key.setdefault(key, stage)

    assignment.stages.all().delete()
    for idx, tmpl in enumerate(templates):
        prev = approved_by_key.get(_stage_match_key(tmpl.name))
        VendorInstallationStage.objects.create(
            assignment=assignment,
            stage_name=tmpl.name,
            allocated_percent=tmpl.percentage,
            sort_order=tmpl.sort_order if tmpl.sort_order is not None else idx,
            status=(
                VendorInstallationStage.STATUS_APPROVED
                if prev is not None
                else VendorInstallationStage.STATUS_NOT_STARTED
            ),
            start_date=getattr(prev, 'start_date', None) if prev else None,
            completion_date=getattr(prev, 'completion_date', None) if prev else None,
            approved_by_id=getattr(prev, 'approved_by_id', None) if prev else None,
            approval_date=getattr(prev, 'approval_date', None) if prev else None,
            work_remarks=(getattr(prev, 'work_remarks', '') or '') if prev else '',
            proof_url=(getattr(prev, 'proof_url', '') or '') if prev else '',
        )
    cache = getattr(assignment, '_prefetched_objects_cache', None)
    if cache is not None:
        cache.pop('stages', None)
        cache.pop('payments', None)
    recalculate_assignment_amounts(assignment)
    return assignment


def validate_stage_templates_total(templates=None) -> Decimal:
    qs = templates if templates is not None else VendorInstallStageTemplate.objects.filter(is_active=True)
    total = sum((_d(t.percentage) for t in qs), Decimal('0'))
    return total


def compute_contract_amount(capacity_kw, capacity_watt, rate, rate_unit) -> Decimal:
    rate = _d(rate)
    if rate_unit == VendorInstallationAssignment.RATE_PER_KW:
        return (rate * _d(capacity_kw)).quantize(Decimal('0.01'))
    watts = _d(capacity_watt)
    if watts <= 0:
        watts = (_d(capacity_kw) * Decimal('1000')).quantize(Decimal('0.01'))
    return (rate * watts).quantize(Decimal('0.01'))


def serialize_assignment(assignment: VendorInstallationAssignment) -> dict:
    stages = list(assignment.stages.all())
    approved = [s for s in stages if s.status == VendorInstallationStage.STATUS_APPROVED]
    payments = list(assignment.payments.all())
    return {
        'id': assignment.id,
        'project_id': assignment.project_id,
        'project_code': getattr(assignment.project, 'project_id', ''),
        'project_name': getattr(assignment.project, 'project_name', ''),
        'customer_name': getattr(assignment.project, 'customer_name', ''),
        'vendor_id': assignment.vendor_id,
        'vendor_name': assignment.vendor.name if assignment.vendor_id else '',
        'vendor_phone': getattr(assignment.vendor, 'phone', ''),
        'capacity_kw': float(assignment.capacity_kw or 0),
        'capacity_watt': float(assignment.capacity_watt or 0),
        'rate': float(assignment.rate or 0),
        'rate_unit': assignment.rate_unit,
        'rate_unit_label': '₹/kW' if assignment.rate_unit == VendorInstallationAssignment.RATE_PER_KW else '₹/Watt',
        'contract_amount': float(assignment.contract_amount or 0),
        'work_description': assignment.work_description,
        'start_date': assignment.start_date.isoformat() if assignment.start_date else None,
        'expected_completion_date': (
            assignment.expected_completion_date.isoformat()
            if assignment.expected_completion_date else None
        ),
        'advance_payment': float(assignment.advance_payment or 0),
        'payment_terms': assignment.payment_terms,
        'remarks': assignment.remarks,
        'status': assignment.status,
        'approved_percent': float(assignment.approved_percent or 0),
        'earned_amount': float(assignment.earned_amount or 0),
        'total_paid': float(assignment.total_paid or 0),
        'remaining_earned_payable': float(assignment.remaining_earned_payable),
        'pending_work_amount': float(assignment.pending_work_amount),
        'pending_percent': float(max(Decimal('100') - _d(assignment.approved_percent), Decimal('0'))),
        'completed_stages': len(approved),
        'pending_stages': len(stages) - len(approved),
        'total_stages': len(stages),
        'daily_task_id': assignment.daily_task_id,
        'assigned_at': assignment.assigned_at.isoformat() if assignment.assigned_at else None,
        'is_cancelled': assignment.is_cancelled,
        'stages': [serialize_stage(s) for s in stages],
        'payments': [serialize_payment(p) for p in payments],
    }


def serialize_stage(stage: VendorInstallationStage) -> dict:
    return {
        'id': stage.id,
        'stage_name': stage.stage_name,
        'allocated_percent': float(stage.allocated_percent or 0),
        'sort_order': stage.sort_order,
        'status': stage.status,
        'start_date': stage.start_date.isoformat() if stage.start_date else None,
        'completion_date': stage.completion_date.isoformat() if stage.completion_date else None,
        'work_remarks': stage.work_remarks,
        'proof_url': stage.proof_url,
        'submitted_by': stage.submitted_by_id,
        'approved_by': stage.approved_by_id,
        'approved_by_name': getattr(stage.approved_by, 'name', None) if stage.approved_by_id else None,
        'approval_date': stage.approval_date.isoformat() if stage.approval_date else None,
    }


def serialize_payment(payment: VendorInstallationPayment) -> dict:
    return {
        'id': payment.id,
        'assignment_id': payment.assignment_id,
        'vendor_id': payment.vendor_id,
        'project_id': payment.project_id,
        'payment_date': payment.payment_date.isoformat() if payment.payment_date else None,
        'amount': float(payment.amount or 0),
        'payment_mode': payment.payment_mode,
        'reference_no': payment.reference_no,
        'remarks': payment.remarks,
        'proof_url': payment.proof_url,
        'is_advance': payment.is_advance,
        'accounts_payment_id': payment.accounts_payment_id,
        'created_at': payment.created_at.isoformat() if payment.created_at else None,
    }


@transaction.atomic
def assign_installation_vendor(
    *,
    project,
    vendor: Account,
    rate,
    rate_unit=VendorInstallationAssignment.RATE_PER_WATT,
    capacity_kw=None,
    work_description='',
    start_date=None,
    expected_completion_date=None,
    advance_payment=0,
    payment_terms='',
    remarks='',
    user=None,
) -> VendorInstallationAssignment:
    if vendor.account_type != 'Vendor':
        raise ValueError('Selected party must be a Vendor.')
    if VendorInstallationAssignment.objects.filter(
        project=project, vendor=vendor, is_cancelled=False,
    ).exists():
        raise ValueError('This vendor already has an active installation assignment on this project.')

    templates = ensure_default_stage_templates()
    total_pct = validate_stage_templates_total(templates)
    if total_pct != Decimal('100.00') and total_pct != Decimal('100'):
        raise ValueError(f'Stage templates must total 100% (currently {total_pct}%).')

    kw = _d(capacity_kw if capacity_kw is not None else getattr(project, 'capacity_kwp', 0))
    watt = (kw * Decimal('1000')).quantize(Decimal('0.01'))
    contract = compute_contract_amount(kw, watt, rate, rate_unit)

    assignment = VendorInstallationAssignment.objects.create(
        project=project,
        vendor=vendor,
        capacity_kw=kw,
        capacity_watt=watt,
        rate=_d(rate),
        rate_unit=rate_unit,
        contract_amount=contract,
        work_description=work_description or f'Installation work — {project.project_name}',
        start_date=start_date,
        expected_completion_date=expected_completion_date,
        advance_payment=_d(advance_payment),
        payment_terms=payment_terms or '',
        remarks=remarks or '',
        status=VendorInstallationAssignment.STATUS_ASSIGNED,
        assigned_by=user if getattr(user, 'pk', None) else None,
    )
    for idx, tmpl in enumerate(templates):
        VendorInstallationStage.objects.create(
            assignment=assignment,
            stage_name=tmpl.name,
            allocated_percent=tmpl.percentage,
            sort_order=tmpl.sort_order if tmpl.sort_order is not None else idx,
            status=VendorInstallationStage.STATUS_NOT_STARTED,
        )

    # Ledger work credit (contract) — not an actual payment.
    VendorLedgerManualEntry.objects.create(
        party=vendor,
        entry_date=timezone.localdate(),
        work=(
            f'Installation assigned — {project.project_name} '
            f'({kw} kW @ {rate} {rate_unit}) contract ₹{contract}'
        ),
        credit=contract,
        debit=Decimal('0'),
        project=project,
        installation_assignment=assignment,
        created_by=user if getattr(user, 'pk', None) else None,
    )

    if _d(advance_payment) > 0:
        record_installation_payment(
            assignment=assignment,
            amount=advance_payment,
            payment_date=timezone.localdate(),
            payment_mode='Cash',
            reference_no='',
            remarks='Advance on assignment',
            is_advance=True,
            user=user,
        )

    # Daily Task + Staff Daily Task visibility
    try:
        from apps.daily_tasks.models import DailyTask, StaffDailyTask
        rate_label = 'kW' if rate_unit == VendorInstallationAssignment.RATE_PER_KW else 'Watt'
        desc = (
            f'Vendor: {vendor.name} · Capacity: {kw} kW · Rate: ₹{rate}/{rate_label} · '
            f'Contract: ₹{contract} · Assignment #{assignment.id}'
        )
        task = DailyTask.objects.create(
            task_date=timezone.localdate(),
            category='installation_progress',
            status='Pending',
            notes=desc,
            details={
                'title': f'Install: {project.project_name}',
                'description': desc,
                'work_done': f'Assigned to {vendor.name} — {kw} kW installation',
                'project_label': project.project_name,
                'project_id': project.id,
                'project_code': getattr(project, 'project_id', ''),
                'vendor_id': vendor.id,
                'vendor_name': vendor.name,
                'assignment_id': assignment.id,
                'contract_amount': float(contract),
                'rate': float(_d(rate)),
                'rate_unit': rate_unit,
                'status': 'Assigned',
            },
            created_by=user if getattr(user, 'pk', None) else None,
        )
        assignment.daily_task = task
        assignment.save(update_fields=['daily_task', 'updated_at'])
        if getattr(user, 'pk', None):
            StaffDailyTask.objects.create(
                title=f'Install: {project.project_name} → {vendor.name}',
                description=desc,
                assigned_by=user,
                assigned_to=user,
                task_date=timezone.localdate(),
                due_date=expected_completion_date,
                status=StaffDailyTask.STATUS_NOT_COMPLETED,
            )
    except Exception:
        pass

    # Mark project installation stage context
    try:
        if hasattr(project, 'installation_status') and project.installation_status == 'Not Done':
            pass  # leave Not Done until fully complete
        update_fields = []
        if hasattr(project, 'updated_at'):
            update_fields.append('updated_at')
        if update_fields:
            project.save(update_fields=update_fields)
    except Exception:
        pass

    recalculate_party_balance(vendor.id)
    recalculate_assignment_amounts(assignment)
    return assignment


def recalculate_assignment_amounts(assignment: VendorInstallationAssignment):
    approved_pct = sum(
        (_d(s.allocated_percent) for s in assignment.stages.filter(status=VendorInstallationStage.STATUS_APPROVED)),
        Decimal('0'),
    )
    if approved_pct > Decimal('100'):
        approved_pct = Decimal('100')
    earned = (_d(assignment.contract_amount) * approved_pct / Decimal('100')).quantize(Decimal('0.01'))
    paid = _d(
        assignment.payments.aggregate(t=Sum('amount'))['t']
    )
    assignment.approved_percent = approved_pct
    assignment.earned_amount = earned
    assignment.total_paid = paid
    if assignment.is_cancelled:
        assignment.status = VendorInstallationAssignment.STATUS_CANCELLED
    elif approved_pct >= Decimal('100'):
        assignment.status = VendorInstallationAssignment.STATUS_COMPLETED
    elif approved_pct > 0:
        assignment.status = VendorInstallationAssignment.STATUS_PARTIAL
    elif assignment.status not in (
        VendorInstallationAssignment.STATUS_ON_HOLD,
        VendorInstallationAssignment.STATUS_CANCELLED,
    ):
        assignment.status = (
            VendorInstallationAssignment.STATUS_IN_PROGRESS
            if assignment.stages.exclude(status=VendorInstallationStage.STATUS_NOT_STARTED).exists()
            else VendorInstallationAssignment.STATUS_ASSIGNED
        )
    assignment.save(update_fields=[
        'approved_percent', 'earned_amount', 'total_paid', 'status', 'updated_at',
    ])
    return assignment


@transaction.atomic
def approve_stage(stage: VendorInstallationStage, user=None, remarks='') -> VendorInstallationStage:
    if stage.status == VendorInstallationStage.STATUS_APPROVED:
        return stage
    stage.status = VendorInstallationStage.STATUS_APPROVED
    stage.approved_by = user if getattr(user, 'pk', None) else None
    stage.approval_date = timezone.now()
    if not stage.completion_date:
        stage.completion_date = timezone.localdate()
    if remarks:
        stage.work_remarks = (stage.work_remarks + '\n' if stage.work_remarks else '') + remarks
    stage.save()
    recalculate_assignment_amounts(stage.assignment)
    return stage


@transaction.atomic
def reopen_stage(stage: VendorInstallationStage, user=None, remarks='') -> VendorInstallationStage:
    """Remove approval from a stage and recalculate earned / payable amounts."""
    if stage.status != VendorInstallationStage.STATUS_APPROVED:
        return stage
    note = remarks or 'Reopened / approval removed'
    stage.status = VendorInstallationStage.STATUS_IN_PROGRESS
    stage.approved_by = None
    stage.approval_date = None
    stage.completion_date = None
    stage.work_remarks = (stage.work_remarks + '\n' if stage.work_remarks else '') + note
    stage.save()
    recalculate_assignment_amounts(stage.assignment)
    return stage


@transaction.atomic
def approve_all_stages(assignment: VendorInstallationAssignment, user=None) -> VendorInstallationAssignment:
    """Approve every pending stage and mark assignment overall complete when 100%."""
    for stage in assignment.stages.exclude(status=VendorInstallationStage.STATUS_APPROVED):
        approve_stage(stage, user=user, remarks='Bulk approve / mark overall complete')
    assignment.refresh_from_db()
    recalculate_assignment_amounts(assignment)
    return assignment


@transaction.atomic
def record_installation_payment(
    *,
    assignment: VendorInstallationAssignment,
    amount,
    payment_date,
    payment_mode='Cash',
    reference_no='',
    remarks='',
    proof_url='',
    is_advance=False,
    user=None,
) -> VendorInstallationPayment:
    amount = _d(amount)
    if amount <= 0:
        raise ValueError('Payment amount must be greater than zero.')
    if assignment.is_cancelled:
        raise ValueError('Cannot pay a cancelled assignment.')

    # Map UI modes onto Payment.MODE_CHOICES (avoid invalid choice / double ledger debit).
    mode_map = {
        'Cash': 'Cash',
        'UPI': 'UPI',
        'Bank Transfer': 'Transfer',
        'Transfer': 'Transfer',
        'Cheque': 'Cheque',
        'NEFT': 'NEFT',
        'RTGS': 'RTGS',
        'IMPS': 'IMPS',
        'Other': 'Other',
    }
    mode = mode_map.get(str(payment_mode or 'Cash').strip(), 'Other')
    pay_desc = remarks or (
        f'{"Advance" if is_advance else "Installation payment"} — {assignment.project.project_name}'
    )

    accounts_payment = Payment.objects.create(
        party=assignment.vendor,
        party_name=assignment.vendor.name,
        direction='Made',
        payment_date=payment_date,
        amount=amount,
        payment_mode=mode,
        reference_no=reference_no or '',
        description=pay_desc,
        particulars=pay_desc,
        project=assignment.project,
        project_ref=getattr(assignment.project, 'project_id', '') or '',
        status='Completed',
        created_by=user if getattr(user, 'pk', None) else None,
    )

    vip = VendorInstallationPayment.objects.create(
        assignment=assignment,
        vendor=assignment.vendor,
        project=assignment.project,
        payment_date=payment_date,
        amount=amount,
        payment_mode=mode,
        reference_no=reference_no or '',
        remarks=remarks or '',
        proof_url=proof_url or '',
        is_advance=bool(is_advance),
        accounts_payment=accounts_payment,
        created_by=user if getattr(user, 'pk', None) else None,
    )

    # Do NOT also write VendorLedgerManualEntry debit — Payment(Made) already hits vendor_totals / balance.

    recalculate_party_balance(assignment.vendor_id)
    recalculate_assignment_amounts(assignment)
    return vip


def vendor_installation_summary(vendor: Account) -> dict:
    # Keep Vendor Details / party.balance aligned with Contract − Payments.
    recalculate_party_balance(vendor.id)
    vendor.refresh_from_db(fields=['balance', 'opening_balance'])
    qs = VendorInstallationAssignment.objects.filter(vendor=vendor, is_cancelled=False)
    contract = _d(qs.aggregate(t=Sum('contract_amount'))['t'])
    earned = _d(qs.aggregate(t=Sum('earned_amount'))['t'])
    paid = _d(qs.aggregate(t=Sum('total_paid'))['t'])
    capacity = _d(qs.aggregate(t=Sum('capacity_kw'))['t'])
    advance = _d(
        VendorInstallationPayment.objects.filter(vendor=vendor, is_advance=True).aggregate(t=Sum('amount'))['t']
    )
    remaining = max(earned - paid, Decimal('0'))
    return {
        'previous_balance': float(_d(vendor.opening_balance)),
        'total_projects_assigned': qs.count(),
        'total_capacity_kw': float(capacity),
        'total_contract_amount': float(contract),
        'total_approved_work_amount': float(earned),
        'total_earned_amount': float(earned),
        'total_advance_paid': float(advance),
        'total_payments_made': float(paid),
        'remaining_earned_payable': float(remaining),
        'net_balance': float(remaining),
        'pending_work_amount': float(max(contract - earned, Decimal('0'))),
        'party_balance': float(_d(vendor.balance)),
    }


def vendor_credit_ledger_rows():
    """Overall Credit Ledger rows for all Vendor parties."""
    from .vendor_ledger import vendor_totals

    rows = []
    for party in Account.objects.filter(account_type='Vendor').order_by('name'):
        totals = vendor_totals(party)
        install = vendor_installation_summary(party)
        rows.append({
            'id': party.id,
            'name': party.name,
            'company': party.company or '',
            'phone': party.phone or '',
            'vendor_type': party.vendor_type or '',
            'opening': float(totals['opening']),
            'debit': float(totals['debit']),
            'credit': float(totals['credit']),
            'net': float(totals['net']),
            'last_date': totals['last_date'].isoformat() if totals['last_date'] else None,
            'payable_label': 'Payable' if totals['net'] > 0 else ('Receivable' if totals['net'] < 0 else 'Clear'),
            'install_projects': install['total_projects_assigned'],
            'install_contract': install['total_contract_amount'],
            'install_earned': install['total_earned_amount'],
            'install_paid': install['total_payments_made'],
            'install_payable': install['remaining_earned_payable'],
        })
    return rows
