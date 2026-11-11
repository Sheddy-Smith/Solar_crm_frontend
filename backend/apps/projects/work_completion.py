"""Weighted work-completion for Customer / Won Client Ledger KPIs.

Installation (90%): Structure 15, Electrical 5, Earthing 5, Panel 50, Inverter 15.
Liaisoning Commissioning complete → +10%.
"""
from decimal import Decimal, InvalidOperation

INSTALLATION_TASK_WEIGHTS = (
    ('Structure', 15),
    ('Electrical', 5),
    ('Earthing', 5),
    ('Panel', 50),
    ('Inverter', 15),
)
INSTALLATION_TOTAL_WEIGHT = sum(w for _, w in INSTALLATION_TASK_WEIGHTS)  # 90
COMMISSIONING_WEIGHT = 10


def _d(value):
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')


def ensure_installation_checklist(project, user=None):
    """Create the fixed 5 Installation checklist rows if missing (idempotent)."""
    from .models import ProjectChecklistItem

    existing = {
        (item.label or '').strip().lower(): item
        for item in ProjectChecklistItem.objects.filter(project=project, phase='Installation')
    }
    created = []
    for label, weight in INSTALLATION_TASK_WEIGHTS:
        key = label.lower()
        if key in existing:
            continue
        item = ProjectChecklistItem.objects.create(
            project=project,
            phase='Installation',
            category='Installation',
            label=label,
            notes=f'Weightage {weight}%',
            is_checked=False,
        )
        existing[key] = item
        created.append(item)
    return created


def commissioning_complete(project):
    """True when Liaison Commissioning is Completed, or stage moved past it."""
    from apps.liaisoning.models import LIAISON_STAGE_COMPLETED, LIAISON_STAGES, LiaisonCommissioning

    if LiaisonCommissioning.objects.filter(project_id=project.id, status='Completed').exists():
        return True
    stage = getattr(getattr(project, 'liaison_stage', None), 'stage', None) or ''
    if stage == LIAISON_STAGE_COMPLETED:
        return True
    # Inspection / Subsidy come after Commissioning in the 8-stage flow.
    if stage in ('Inspection', 'Subsidy', 'Inspection Placed'):
        return True
    if stage in LIAISON_STAGES:
        try:
            return LIAISON_STAGES.index(stage) > LIAISON_STAGES.index('Commissioning')
        except ValueError:
            return False
    return False


def installation_weight_done(project, ensure=True):
    """Sum of weightages for checked Installation tasks (max 90)."""
    from .models import ProjectChecklistItem

    if ensure:
        ensure_installation_checklist(project)
        items = ProjectChecklistItem.objects.filter(project_id=project.id, phase='Installation')
    else:
        items = [
            item for item in project.checklist_items.all()
            if (item.phase or '') == 'Installation'
        ]
    checked = {
        (item.label or '').strip().lower()
        for item in items
        if item.is_checked
    }
    total = 0
    for label, weight in INSTALLATION_TASK_WEIGHTS:
        if label.lower() in checked:
            total += weight
    # Backward compatible: whole Installation marked Done and no weighted ticks yet.
    if total == 0 and getattr(project, 'installation_status', None) == 'Done':
        return INSTALLATION_TOTAL_WEIGHT
    return total


def work_completion_percent(project, ensure=True):
    """0–100: install weights + commissioning 10."""
    pct = installation_weight_done(project, ensure=ensure)
    if commissioning_complete(project):
        pct += COMMISSIONING_WEIGHT
    return min(100, max(0, int(pct)))


def projects_for_party(party):
    """Won-lead projects linked to this Customer party by normalized mobile."""
    from apps.accounts_module.services import normalize_phone
    from apps.leads.models import Lead
    from .models import Project

    key = normalize_phone(party.phone)
    if not key:
        return Project.objects.none()

    lead_ids = []
    for lead in Lead.objects.filter(is_deleted=False, status='Won').exclude(mobile_number='').only('id', 'mobile_number'):
        if normalize_phone(lead.mobile_number) == key:
            lead_ids.append(lead.id)
    if not lead_ids:
        return Project.objects.none()
    return (
        Project.objects.filter(is_deleted=False, lead_id__in=lead_ids)
        .select_related('liaison_stage', 'lead')
        .prefetch_related('checklist_items', 'lc_commissionings', 'payments')
    )


def party_work_profile(party, received_payment=None):
    """Aggregate project cost / completion KPIs for a Customer party."""
    from django.db.models import Sum

    from apps.accounts_module.models import CustomerLedgerManualEntry
    from apps.accounts_module.services import normalize_phone
    from apps.leads.models import Lead

    projects = list(projects_for_party(party))
    project_cost = sum((_d(p.total_value) for p in projects), Decimal('0'))

    # Fallback 1: optional Lead.project_cost on matching Won leads (when Project.total_value empty).
    if project_cost <= 0:
        key = normalize_phone(party.phone)
        if key:
            for lead in Lead.objects.filter(is_deleted=False, status='Won').exclude(mobile_number='').only(
                'id', 'mobile_number', 'project_cost',
            ):
                if normalize_phone(lead.mobile_number) == key:
                    project_cost += _d(lead.project_cost)

    # Fallback 2: manual Customer Ledger "Sale (Debit)" rows (Add New Ledger amount).
    if project_cost <= 0:
        project_cost = _d(
            CustomerLedgerManualEntry.objects.filter(party_id=party.id, entry_type='sale')
            .aggregate(t=Sum('amount'))['t']
        )

    if not projects:
        completion = 0
    elif project_cost > 0 and any(_d(p.total_value) > 0 for p in projects):
        weighted = Decimal('0')
        weight_base = sum((_d(p.total_value) for p in projects), Decimal('0')) or project_cost
        for p in projects:
            cost = _d(p.total_value) or (project_cost / Decimal(len(projects)))
            weighted += Decimal(work_completion_percent(p)) * cost
        completion = float(weighted / weight_base) if weight_base else 0
    else:
        completion = sum(work_completion_percent(p) for p in projects) / len(projects)

    completion = round(float(completion), 1)
    work_done = float(project_cost * Decimal(str(completion)) / Decimal('100'))
    if received_payment is None:
        received = float(sum((_d(pay.amount) for p in projects for pay in p.payments.all()), Decimal('0')))
    else:
        received = float(_d(received_payment))
    outstanding = max(0.0, float(project_cost) - received) if completion <= 0 else max(0.0, work_done - received)
    # When completion is 0 but project cost exists (sale entered, work not started),
    # outstanding should still reflect unpaid contract value.
    if completion <= 0 and project_cost > 0:
        outstanding = max(0.0, float(project_cost) - received)
        remaining = float(project_cost)
        work_done = 0.0
    else:
        remaining = max(0.0, float(project_cost) - work_done)

    return {
        'project_cost': float(project_cost),
        'work_completion_pct': completion,
        'work_done_value': round(work_done, 2),
        'received_payment': round(received, 2),
        'outstanding_amount': round(outstanding, 2),
        'remaining_work_value': round(remaining, 2),
        'projects_count': len(projects),
        'installation_tasks': [
            {'label': label, 'weight': weight} for label, weight in INSTALLATION_TASK_WEIGHTS
        ],
        'commissioning_weight': COMMISSIONING_WEIGHT,
    }
