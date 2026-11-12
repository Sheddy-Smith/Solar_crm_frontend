"""Orphan Project → Customer reconciliation (evidence-based, no name-only auto-link)."""
from __future__ import annotations

from django.db import transaction
from django.db.models import Count, Q


def orphan_project_queryset():
    from apps.projects.models import Project
    return (
        Project.objects.filter(is_deleted=False, customer__isnull=True)
        .select_related('lead')
        .annotate(
            invoice_party_count=Count('sell_invoices__party', distinct=True, filter=Q(sell_invoices__party__isnull=False)),
            payment_party_count=Count('account_payments__party', distinct=True, filter=Q(account_payments__party__isnull=False)),
        )
        .order_by('-id')
    )


def _party_suggestions_for_project(project) -> list:
    """Suggestions from verified FKs (high) plus exact customer_name match (medium).

    Never suggests fuzzy/similar names. Exact name match is opt-in for bulk apply.
    """
    from .models import Account
    from .services import find_party_by_phone, normalize_phone

    suggestions = []
    seen = set()

    def _add(party, reason, confidence):
        if not party or party.id in seen or party.status == 'Merged':
            return
        seen.add(party.id)
        suggestions.append({
            'customer_id': party.id,
            'name': party.name,
            'phone': party.phone,
            'reason': reason,
            'confidence': confidence,
        })

    lead = getattr(project, 'lead', None)
    if lead and lead.customer_id:
        _add(lead.customer, 'Lead.customer FK', 'high')
    if lead and lead.mobile_number:
        party = find_party_by_phone(lead.mobile_number)
        _add(party, f'Lead mobile {normalize_phone(lead.mobile_number)}', 'high')

    from .models import Payment, SellInvoice
    for party_id in (
        SellInvoice.objects.filter(project_id=project.id, party__isnull=False)
        .values_list('party_id', flat=True).distinct()
    ):
        party = Account.objects.filter(pk=party_id, account_type='Customer').first()
        _add(party, 'SellInvoice.party FK', 'high')
    for party_id in (
        Payment.objects.filter(project_id=project.id, party__isnull=False)
        .values_list('party_id', flat=True).distinct()
    ):
        party = Account.objects.filter(pk=party_id, account_type='Customer').first()
        _add(party, 'Payment.party FK', 'high')

    # Exact customer_name ↔ Account.name (case-insensitive). Medium confidence only.
    name_key = (project.customer_name or '').strip()
    if name_key:
        matches = list(
            Account.objects.filter(account_type='Customer', name__iexact=name_key)
            .exclude(status='Merged')[:3]
        )
        if len(matches) == 1:
            _add(matches[0], 'Exact customer_name match', 'medium')

    # Prefer high over medium in ordering
    suggestions.sort(key=lambda s: 0 if s['confidence'] == 'high' else 1)
    return suggestions


def serialize_orphan_row(project) -> dict:
    suggestions = _party_suggestions_for_project(project)
    lead = project.lead if project.lead_id else None
    return {
        'project_id': project.id,
        'project_code': project.project_id,
        'project_name': project.project_name,
        'customer_name': project.customer_name,
        'status': project.status,
        'capacity_kwp': float(project.capacity_kwp or 0),
        'lead_id': lead.id if lead else None,
        'lead_ivrs': getattr(lead, 'ivrs_number', None) if lead else None,
        'lead_mobile': getattr(lead, 'mobile_number', None) if lead else None,
        'invoice_party_count': getattr(project, 'invoice_party_count', 0) or 0,
        'payment_party_count': getattr(project, 'payment_party_count', 0) or 0,
        'suggestions': suggestions,
        'best_suggestion': suggestions[0] if suggestions else None,
        'needs_manual_review': not bool(suggestions),
        'review_note': (
            'No Lead/Invoice/Payment/exact-name Customer match.'
            if not suggestions
            else (
                'Exact name match available (medium confidence).'
                if suggestions[0]['confidence'] == 'medium'
                else ''
            )
        ),
    }


def orphan_reconciliation_report(limit: int = 500) -> dict:
    qs = orphan_project_queryset()
    total = qs.count()
    rows = [serialize_orphan_row(p) for p in qs[:limit]]
    auto_linkable = sum(1 for r in rows if r['best_suggestion'] and r['best_suggestion']['confidence'] == 'high')
    exact_name = sum(1 for r in rows if r['best_suggestion'] and r['best_suggestion']['confidence'] == 'medium')
    return {
        'total_orphans': total,
        'returned': len(rows),
        'auto_linkable_high_confidence': auto_linkable,
        'exact_name_linkable': exact_name,
        'needs_manual_review': sum(1 for r in rows if r['needs_manual_review']),
        'results': rows,
    }


def _next_provisional_phone() -> str:
    """Allocate a unique provisional 10-digit mobile in the 7800xxxxxx band."""
    from .models import Account
    from .services import normalize_phone

    used = set(
        Account.objects.filter(account_type='Customer', normalized_phone__startswith='7800')
        .values_list('normalized_phone', flat=True)
    )
    n = 7800000000
    while True:
        candidate = str(n)
        if candidate not in used and not Account.objects.filter(
            account_type='Customer', normalized_phone=normalize_phone(candidate)
        ).exists():
            return candidate
        n += 1
        if n > 7899999999:
            raise ValueError('Provisional phone pool exhausted.')


@transaction.atomic
def apply_orphan_reconciliation(*, user=None, create_missing: bool = True, dry_run: bool = False) -> dict:
    """Reconcile orphans using exact customer_name matches, optionally create missing Customers.

    Rules:
    - High-confidence FK suggestions are linked first.
    - Exact unique Account.name match (medium) is linked next.
    - Remaining unique names can create a Customer with provisional phone (7800xxxxxx)
      and link all Projects sharing that name (One Customer → Many Projects).
    - Never fuzzy-matches similar names.
    """
    from apps.projects.models import Project
    from .models import Account, ProjectCustomerLinkAudit

    report = {
        'dry_run': dry_run,
        'linked_high': 0,
        'linked_exact_name': 0,
        'customers_created': 0,
        'linked_created': 0,
        'remaining_orphans': 0,
        'actions': [],
    }

    orphans = list(orphan_project_queryset().select_related('lead', 'lead__customer'))
    # Phase 1: high + medium suggestions already present
    still = []
    for project in orphans:
        suggestions = _party_suggestions_for_project(project)
        best = suggestions[0] if suggestions else None
        if not best:
            still.append(project)
            continue
        conf = best['confidence']
        if conf not in ('high', 'medium'):
            still.append(project)
            continue
        action = {
            'project_id': project.id,
            'project_code': project.project_id,
            'customer_id': best['customer_id'],
            'reason': best['reason'],
            'confidence': conf,
        }
        report['actions'].append(action)
        if dry_run:
            if conf == 'high':
                report['linked_high'] += 1
            else:
                report['linked_exact_name'] += 1
            continue
        link_project_to_customer(
            project_id=project.id,
            customer_id=best['customer_id'],
            user=user,
            notes='Bulk orphan reconciliation',
            match_reason=best['reason'],
        )
        if conf == 'high':
            report['linked_high'] += 1
        else:
            report['linked_exact_name'] += 1

    if not create_missing:
        report['remaining_orphans'] = (
            len(still) if dry_run
            else Project.objects.filter(is_deleted=False, customer__isnull=True).count()
        )
        return report

    # Phase 2: create Customer per unique remaining name, then link all sharing that name
    from collections import defaultdict
    by_name = defaultdict(list)
    unnamed = 0
    for project in still:
        key = (project.customer_name or '').strip()
        if not key:
            unnamed += 1
            continue
        by_name[key].append(project)

    provisional_used = set()
    ambiguous_names = 0
    for name, projects in by_name.items():
        existing = list(
            Account.objects.filter(account_type='Customer', name__iexact=name)
            .exclude(status='Merged')[:2]
        )
        if len(existing) == 1:
            customer = existing[0]
            created = False
        elif len(existing) > 1:
            ambiguous_names += 1
            continue
        else:
            created = True
            phone = _next_provisional_phone()
            while phone in provisional_used:
                phone = str(int(phone) + 1)
            provisional_used.add(phone)
            if dry_run:
                report['customers_created'] += 1
                report['linked_created'] += len(projects)
                report['actions'].append({
                    'create_customer': name,
                    'provisional_phone': phone,
                    'project_ids': [p.id for p in projects],
                })
                continue
            customer = Account.objects.create(
                name=name,
                account_type='Customer',
                phone=phone,
                status='Active',
                remarks='Created by orphan reconciliation (provisional mobile — verify with customer).',
                created_by=user if getattr(user, 'is_authenticated', False) else None,
            )
            report['customers_created'] += 1

        if dry_run and not created:
            report['linked_created'] += len(projects)
            report['actions'].append({
                'link_existing_after_scan': name,
                'customer_id': customer.id,
                'project_ids': [p.id for p in projects],
            })
            continue

        for project in projects:
            project.customer = customer
            project.save(update_fields=['customer', 'updated_at'])
            ProjectCustomerLinkAudit.objects.create(
                project=project,
                customer=customer,
                action='create_and_link' if created else 'link_existing',
                match_reason=(
                    'create_from_project_customer_name'
                    if created else 'exact_customer_name_after_create_pass'
                ),
                evidence={'customer_name': name, 'provisional_phone': bool(created)},
                notes='Bulk orphan reconciliation create-from-name',
                performed_by=user if getattr(user, 'is_authenticated', False) else None,
            )
            report['linked_created'] += 1
            report['actions'].append({
                'project_id': project.id,
                'customer_id': customer.id,
                'reason': 'create_from_project_customer_name' if created else 'exact_name',
            })

    if dry_run:
        linked = report['linked_high'] + report['linked_exact_name'] + report['linked_created']
        report['remaining_orphans'] = max(0, len(orphans) - linked) + unnamed
        report['ambiguous_names'] = ambiguous_names
    else:
        report['remaining_orphans'] = Project.objects.filter(is_deleted=False, customer__isnull=True).count()
        report['ambiguous_names'] = ambiguous_names
    return report


@transaction.atomic
def link_project_to_customer(*, project_id: int, customer_id: int, user=None, notes: str = '', match_reason: str = '') -> dict:
    from apps.projects.models import Project
    from .models import Account, ProjectCustomerLinkAudit

    project = Project.objects.select_for_update().get(pk=project_id, is_deleted=False)
    customer = Account.objects.get(pk=customer_id, account_type='Customer')
    if customer.status == 'Merged':
        raise ValueError('Cannot link Project to a merged Customer.')
    old = project.customer_id
    project.customer = customer
    if not (project.customer_name or '').strip():
        project.customer_name = customer.name
    project.save(update_fields=['customer', 'customer_name', 'updated_at'])
    audit = ProjectCustomerLinkAudit.objects.create(
        project=project,
        customer=customer,
        action='link_existing' if not old else 'reassign',
        match_reason=match_reason or 'manual_link',
        evidence={'previous_customer_id': old},
        notes=notes or '',
        performed_by=user if getattr(user, 'is_authenticated', False) else None,
    )
    return {'ok': True, 'project_id': project.id, 'customer_id': customer.id, 'audit_id': audit.id}


@transaction.atomic
def create_customer_and_link_project(
    *, project_id: int, name: str, phone: str, user=None, alternate_phone: str = '', notes: str = '',
) -> dict:
    """Create a verified Customer (requires mobile) then link the Project.

    Phone is mandatory so we never invent identity from name alone.
    """
    from apps.projects.models import Project
    from .models import Account, ProjectCustomerLinkAudit
    from .services import find_party_by_phone, normalize_phone

    project = Project.objects.select_for_update().get(pk=project_id, is_deleted=False)
    key = normalize_phone(phone)
    if not key:
        raise ValueError('Primary mobile is required to create a Customer for reconciliation.')
    existing = find_party_by_phone(key)
    if existing:
        raise ValueError(
            f'Customer already exists for mobile {key} (ACC-{existing.id:04d}). '
            'Link the existing Customer instead of creating a duplicate.'
        )
    customer = Account.objects.create(
        name=(name or project.customer_name or f'Customer {key}').strip(),
        account_type='Customer',
        phone=key,
        alternate_phone=normalize_phone(alternate_phone) or '',
        status='Active',
        created_by=user if getattr(user, 'is_authenticated', False) else None,
    )
    project.customer = customer
    project.customer_name = customer.name
    project.save(update_fields=['customer', 'customer_name', 'updated_at'])
    audit = ProjectCustomerLinkAudit.objects.create(
        project=project,
        customer=customer,
        action='create_and_link',
        match_reason='manual_create_with_verified_mobile',
        evidence={'phone': key},
        notes=notes or '',
        performed_by=user if getattr(user, 'is_authenticated', False) else None,
    )
    return {'ok': True, 'project_id': project.id, 'customer_id': customer.id, 'audit_id': audit.id}


@transaction.atomic
def skip_orphan_for_review(*, project_id: int, user=None, notes: str = '') -> dict:
    from apps.projects.models import Project
    from .models import ProjectCustomerLinkAudit

    project = Project.objects.get(pk=project_id, is_deleted=False)
    if project.customer_id:
        raise ValueError('Project already has a Customer.')
    audit = ProjectCustomerLinkAudit.objects.create(
        project=project,
        customer=None,
        action='skip_review',
        match_reason='insufficient_evidence',
        evidence=serialize_orphan_row(project),
        notes=notes or 'Marked for manual business review',
        performed_by=user if getattr(user, 'is_authenticated', False) else None,
    )
    return {'ok': True, 'project_id': project.id, 'audit_id': audit.id, 'status': 'pending_manual_review'}


def build_customer_profile(party) -> dict:
    """Aggregate payload for Customer Profile tabs."""
    from apps.leads.models import Lead, Quotation
    from apps.om.models import OmPlant
    from apps.projects.models import Project, ProjectDocument
    from .customer_ledger import project_ledger_breakdown, party_totals
    from .models import Payment, SellInvoice
    from .serializers import AccountSerializer

    projects = list(
        Project.objects.filter(customer_id=party.id, is_deleted=False)
        .order_by('-created_at')
        .values('id', 'project_id', 'project_name', 'status', 'capacity_kwp', 'site_address', 'city', 'lead_id')
    )
    leads = list(
        Lead.objects.filter(customer_id=party.id, is_deleted=False)
        .order_by('-created_at')
        .values('id', 'ivrs_number', 'customer_name', 'mobile_number', 'status', 'project_name')
    )
    quotations = list(
        Quotation.objects.filter(customer_id=party.id, is_deleted=False)
        .order_by('-created_at')
        .values('id', 'quotation_number', 'status', 'grand_total', 'lead_id', 'project_id', 'created_at')
    )
    invoices = list(
        SellInvoice.objects.filter(party_id=party.id).exclude(status='Cancelled')
        .order_by('-invoice_date')
        .values('id', 'invoice_no', 'invoice_date', 'total_amount', 'balance_due', 'status', 'project_id')[:100]
    )
    payments = list(
        Payment.objects.filter(party_id=party.id, status='Completed')
        .order_by('-payment_date')
        .values(
            'id', 'direction', 'payment_date', 'amount', 'payment_mode', 'reference_no',
            'project_id', 'receipt_source',
        )[:100]
    )
    docs = list(
        ProjectDocument.objects.filter(project__customer_id=party.id)
        .order_by('-uploaded_at')
        .values('id', 'name', 'category', 'project_id', 'uploaded_at')[:100]
    )
    plants = []
    for plant in (
        OmPlant.objects.filter(Q(customer_id=party.id) | Q(project__customer_id=party.id))
        .distinct()
        .order_by('-id')[:50]
    ):
        plants.append({
            'id': plant.id,
            'plant_code': plant.plant_code,
            'customer_name': plant.customer_name,
            'om_status': plant.om_status,
            'project_id': plant.project_id,
        })
    breakdown = project_ledger_breakdown(party)
    totals = party_totals(party)
    return {
        'party': AccountSerializer(party).data,
        'overview': {
            'leads_count': len(leads),
            'projects_count': len(projects),
            'quotations_count': len(quotations),
            'invoiced': float(totals.get('invoiced') or 0),
            'received': float(totals.get('received') or 0),
            'outstanding': float(totals.get('outstanding') or 0),
        },
        'projects': projects,
        'leads': leads,
        'quotations': [
            {
                **q,
                'created_at': q['created_at'].isoformat() if q.get('created_at') else None,
                'grand_total': float(q['grand_total'] or 0),
            }
            for q in quotations
        ],
        'accounts': breakdown,
        'invoices': [
            {
                **inv,
                'invoice_date': inv['invoice_date'].isoformat() if inv.get('invoice_date') else None,
                'total_amount': float(inv['total_amount'] or 0),
                'balance_due': float(inv['balance_due'] or 0),
            }
            for inv in invoices
        ],
        'payments': [
            {
                **pay,
                'payment_date': pay['payment_date'].isoformat() if pay.get('payment_date') else None,
                'amount': float(pay['amount'] or 0),
                'allocation_status': 'unallocated' if not pay.get('project_id') else 'project',
            }
            for pay in payments
        ],
        'documents': [
            {**d, 'uploaded_at': d['uploaded_at'].isoformat() if d.get('uploaded_at') else None}
            for d in docs
        ],
        'om': plants,
        'activity': _recent_activity(party.id),
    }


def _recent_activity(party_id: int, limit: int = 40) -> list:
    from apps.leads.models import Lead, Quotation
    from apps.projects.models import Project
    from .models import CustomerMergeAudit, Payment, ProjectCustomerLinkAudit, SellInvoice

    events = []
    for lead in Lead.objects.filter(customer_id=party_id).order_by('-updated_at')[:10]:
        events.append({
            'at': lead.updated_at.isoformat() if lead.updated_at else None,
            'kind': 'lead',
            'label': f'Lead {lead.ivrs_number} · {lead.status}',
        })
    for project in Project.objects.filter(customer_id=party_id, is_deleted=False).order_by('-updated_at')[:10]:
        events.append({
            'at': project.updated_at.isoformat() if project.updated_at else None,
            'kind': 'project',
            'label': f'Project {project.project_id} · {project.status}',
        })
    for q in Quotation.objects.filter(customer_id=party_id, is_deleted=False).order_by('-updated_at')[:10]:
        events.append({
            'at': q.updated_at.isoformat() if q.updated_at else None,
            'kind': 'quotation',
            'label': f'Quotation {q.quotation_number or q.id} · {q.status}',
        })
    for inv in SellInvoice.objects.filter(party_id=party_id).order_by('-created_at')[:5]:
        events.append({
            'at': inv.created_at.isoformat() if inv.created_at else None,
            'kind': 'invoice',
            'label': f'Invoice {inv.invoice_no or inv.id}',
        })
    for pay in Payment.objects.filter(party_id=party_id).order_by('-created_at')[:5]:
        events.append({
            'at': pay.created_at.isoformat() if pay.created_at else None,
            'kind': 'payment',
            'label': f'Payment {pay.reference_no or pay.id} · ₹{pay.amount}',
        })
    for audit in CustomerMergeAudit.objects.filter(Q(source_id=party_id) | Q(target_id=party_id)).order_by('-created_at')[:5]:
        events.append({
            'at': audit.created_at.isoformat() if audit.created_at else None,
            'kind': 'merge',
            'label': f'Merge {audit.source_id} → {audit.target_id}',
        })
    for link in ProjectCustomerLinkAudit.objects.filter(customer_id=party_id).order_by('-created_at')[:5]:
        events.append({
            'at': link.created_at.isoformat() if link.created_at else None,
            'kind': 'reconciliation',
            'label': f'{link.action} project {link.project_id}',
        })
    events.sort(key=lambda e: e.get('at') or '', reverse=True)
    return events[:limit]
