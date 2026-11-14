"""Manual Sync between Quotation and Material Planning modules.

Independence rules:
- No automatic cross-module updates.
- Every exchange requires explicit source, destination, report, and confirmation.
- Dispatched/packed MaterialPlan rows are protected.
- Plans owned by another quotation are never overwritten.
"""
from __future__ import annotations

import hashlib
import uuid
from typing import Optional

from django.db import transaction
from django.utils import timezone

from apps.leads.models import ModuleSyncMapping, ModuleSyncRun, Quotation
from apps.leads.quotation_sync import sync_quotation_to_material_plans
from apps.projects.bom_services import seed_material_plans_from_bom
from apps.projects.models import MaterialPlan, Project


REPORT_META = {
    ModuleSyncRun.REPORT_BOM: {
        'label': 'BOM Report',
        'description': 'Push Active/selected BOM lines into Material Planning for the project.',
        'directions': [
            (ModuleSyncRun.MODULE_QUOTATION, ModuleSyncRun.MODULE_MATERIAL_PLANNING),
            (ModuleSyncRun.MODULE_MATERIAL_PLANNING, ModuleSyncRun.MODULE_MATERIAL_PLANNING),
        ],
    },
    ModuleSyncRun.REPORT_QUOTATION_MATERIAL: {
        'label': 'Quotation Material Report',
        'description': 'Push quotation line items into Material Planning for the project.',
        'directions': [
            (ModuleSyncRun.MODULE_QUOTATION, ModuleSyncRun.MODULE_MATERIAL_PLANNING),
        ],
    },
    ModuleSyncRun.REPORT_MATERIAL_PLANNING: {
        'label': 'Material Planning Report',
        'description': 'Push Material Planning planned qty/rates into a Draft quotation.',
        'directions': [
            (ModuleSyncRun.MODULE_MATERIAL_PLANNING, ModuleSyncRun.MODULE_QUOTATION),
        ],
    },
    ModuleSyncRun.REPORT_PROJECT_WISE: {
        'label': 'Project-wise Material Report',
        'description': 'Sync quotation materials ↔ Material Planning for one project.',
        'directions': [
            (ModuleSyncRun.MODULE_QUOTATION, ModuleSyncRun.MODULE_MATERIAL_PLANNING),
            (ModuleSyncRun.MODULE_MATERIAL_PLANNING, ModuleSyncRun.MODULE_QUOTATION),
        ],
    },
}


def report_types_for_module(module: str) -> list[dict]:
    rows = []
    for key, meta in REPORT_META.items():
        dirs = [
            {'source': src, 'destination': dst}
            for src, dst in meta['directions']
            if src == module or dst == module
        ]
        if not dirs:
            continue
        rows.append({
            'id': key,
            'label': meta['label'],
            'description': meta['description'],
            'directions': dirs,
        })
    return rows


def _require_project(project_id) -> Project:
    if not project_id:
        raise ValueError('project_id is required for Manual Sync.')
    project = Project.objects.filter(pk=project_id, is_deleted=False).select_related('lead').first()
    if not project:
        raise ValueError('Project not found.')
    return project


def _resolve_quotation(quotation_id, project: Project) -> Optional[Quotation]:
    qs = Quotation.objects.filter(is_deleted=False)
    if quotation_id:
        q = qs.filter(pk=quotation_id).first()
        if not q:
            raise ValueError('Quotation not found.')
        return q
    # Prefer active Final, else latest Draft for this project/lead.
    q = qs.filter(project=project, status='Approved').order_by('-updated_at').first()
    if q:
        return q
    if project.lead_id:
        q = qs.filter(lead_id=project.lead_id, status='Approved').order_by('-updated_at').first()
        if q:
            return q
        return qs.filter(lead_id=project.lead_id).exclude(status='Rejected').order_by('-updated_at').first()
    return qs.filter(project=project).exclude(status='Rejected').order_by('-updated_at').first()


def _content_hash(*parts) -> str:
    raw = '|'.join(str(p) for p in parts)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:40]


def preview_sync(
    *,
    source_module: str,
    destination_module: str,
    report_type: str,
    project_id,
    quotation_id=None,
    bom_version_id=None,
    user=None,
) -> dict:
    if source_module == destination_module and report_type != ModuleSyncRun.REPORT_BOM:
        raise ValueError('Source and destination modules must differ unless using BOM Report.')
    meta = REPORT_META.get(report_type)
    if not meta:
        raise ValueError('Unsupported report type.')
    if (source_module, destination_module) not in meta['directions']:
        raise ValueError('Selected report does not support this sync direction.')

    project = _require_project(project_id)
    quotation = _resolve_quotation(quotation_id, project)
    bom_version = None
    if bom_version_id:
        from apps.projects.bom_models import BomVersion
        bom_version = BomVersion.objects.filter(pk=bom_version_id).first()
        if not bom_version:
            raise ValueError('BOM version not found.')

    counts = {
        'total': 0,
        'created': 0,
        'updated': 0,
        'skipped': 0,
        'protected': 0,
        'failed': 0,
        'conflicts': [],
    }

    if destination_module == ModuleSyncRun.MODULE_MATERIAL_PLANNING:
        if report_type in (
            ModuleSyncRun.REPORT_QUOTATION_MATERIAL,
            ModuleSyncRun.REPORT_PROJECT_WISE,
        ):
            if not quotation:
                raise ValueError('No quotation found for this project to sync from.')
            counts = sync_quotation_to_material_plans(quotation, project=project, dry_run=True)
        elif report_type == ModuleSyncRun.REPORT_BOM:
            if bom_version is None:
                from apps.projects.bom_3kw_template import resolve_lead_capacity_kw
                from apps.projects.bom_services import get_active_bom_version
                kw = resolve_lead_capacity_kw(project.lead) if project.lead_id else None
                bom_version = get_active_bom_version(kw) if kw is not None else None
            if bom_version is None:
                raise ValueError('No active/selected BOM version available for this project.')
            # Preview: count BOM lines vs existing version-scoped plans.
            from apps.projects.bom_models import BomLine
            lines = list(BomLine.objects.filter(version=bom_version))
            counts['total'] = len(lines)
            for line in lines:
                existing = MaterialPlan.objects.filter(
                    project=project,
                    bom_version=bom_version,
                    category=(line.category or '')[:100],
                    items=(line.material_name or '')[:50],
                ).first()
                if existing:
                    from apps.leads.quotation_sync import _plan_is_protected
                    if _plan_is_protected(existing):
                        counts['protected'] += 1
                        counts['skipped'] += 1
                    else:
                        counts['updated'] += 1
                else:
                    counts['created'] += 1
    elif destination_module == ModuleSyncRun.MODULE_QUOTATION:
        if not quotation:
            raise ValueError('Target quotation is required (or create a Draft first).')
        if quotation.pricing_frozen or quotation.status in ('Approved', 'Superseded'):
            raise ValueError('Cannot sync into a frozen Final/Superseded quotation. Create a Revision first.')
        plans = list(MaterialPlan.objects.filter(project=project))
        counts['total'] = len(plans)
        existing_items = {
            (it.item_name or '').strip().lower(): it
            for it in quotation.items.all()
        }
        for plan in plans:
            name = (plan.items or plan.category or '').strip()
            if not name:
                counts['skipped'] += 1
                continue
            key = name.lower()
            if key in existing_items:
                counts['updated'] += 1
            else:
                counts['created'] += 1
    else:
        raise ValueError('Unsupported destination module.')

    token = uuid.uuid4().hex
    run = ModuleSyncRun.objects.create(
        source_module=source_module,
        destination_module=destination_module,
        report_type=report_type,
        project=project,
        bom_version=bom_version,
        quotation=quotation,
        preview_token=token,
        status=ModuleSyncRun.STATUS_PENDING,
        total_records=counts.get('total') or 0,
        created_records=counts.get('created') or 0,
        updated_records=counts.get('updated') or 0,
        skipped_records=counts.get('skipped') or 0,
        failed_records=counts.get('failed') or 0,
        protected_records=counts.get('protected') or 0,
        conflict_details=counts.get('conflicts') or [],
        started_by=user if getattr(user, 'pk', None) else None,
    )
    return {
        'preview_token': token,
        'run_id': run.id,
        'source_module': source_module,
        'destination_module': destination_module,
        'report_type': report_type,
        'project_id': project.id,
        'project_name': project.project_name or project.project_id or f'Project #{project.id}',
        'quotation_id': getattr(quotation, 'id', None),
        'quotation_number': getattr(quotation, 'quotation_number', None),
        'bom_version_id': getattr(bom_version, 'id', None),
        'counts': {
            'total': run.total_records,
            'create': run.created_records,
            'update': run.updated_records,
            'skip': run.skipped_records,
            'protected': run.protected_records,
            'failed': run.failed_records,
            'conflicts': run.conflict_details,
        },
    }


def run_sync(*, preview_token: str, confirm: bool = False, user=None) -> ModuleSyncRun:
    if not confirm:
        raise ValueError('confirm=true is required to execute Manual Sync.')
    if not preview_token:
        raise ValueError('preview_token is required.')

    with transaction.atomic():
        run = (
            ModuleSyncRun.objects.select_for_update()
            .filter(preview_token=preview_token)
            .first()
        )
        if not run:
            raise ValueError('Invalid or expired preview token.')
        if run.status in (
            ModuleSyncRun.STATUS_SUCCESS,
            ModuleSyncRun.STATUS_PARTIAL,
            ModuleSyncRun.STATUS_IN_PROGRESS,
        ):
            return run

        run.status = ModuleSyncRun.STATUS_IN_PROGRESS
        run.started_at = timezone.now()
        if user and getattr(user, 'pk', None):
            run.started_by = user
        run.save(update_fields=['status', 'started_at', 'started_by', 'updated_at'])

        project = run.project
        quotation = run.quotation
        bom_version = run.bom_version
        counts = {
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'protected': 0,
            'failed': 0,
            'conflicts': [],
            'total': 0,
            'material_plans': 0,
        }
        error = ''

        try:
            if run.destination_module == ModuleSyncRun.MODULE_MATERIAL_PLANNING:
                if run.report_type in (
                    ModuleSyncRun.REPORT_QUOTATION_MATERIAL,
                    ModuleSyncRun.REPORT_PROJECT_WISE,
                ) and run.source_module == ModuleSyncRun.MODULE_QUOTATION:
                    if not quotation:
                        raise ValueError('Quotation missing for sync run.')
                    counts = sync_quotation_to_material_plans(quotation, project=project, dry_run=False)
                    # Persist mappings for created/updated owned plans.
                    for plan in MaterialPlan.objects.filter(project=project, source_quotation=quotation):
                        ModuleSyncMapping.objects.create(
                            run=run,
                            source_type='quotation_item_or_spec',
                            source_id=str(quotation.id),
                            destination_type='material_plan',
                            destination_id=str(plan.id),
                            content_hash=_content_hash(plan.category, plan.items, plan.planned_qty),
                            status='success',
                        )
                elif run.report_type == ModuleSyncRun.REPORT_BOM:
                    if bom_version is None:
                        raise ValueError('BOM version missing for BOM Report sync.')
                    created = seed_material_plans_from_bom(
                        project, bom_version, quotation=quotation, replace_undispatched=False,
                    )
                    counts['created'] = created
                    counts['total'] = bom_version.lines.count()
                    counts['updated'] = max(0, counts['total'] - created)
                    for plan in MaterialPlan.objects.filter(project=project, bom_version=bom_version):
                        ModuleSyncMapping.objects.create(
                            run=run,
                            source_type='bom_line',
                            source_id=str(bom_version.id),
                            destination_type='material_plan',
                            destination_id=str(plan.id),
                            content_hash=_content_hash(plan.category, plan.items, plan.planned_qty),
                            status='success',
                        )
                else:
                    raise ValueError('Unsupported sync combination.')
            elif run.destination_module == ModuleSyncRun.MODULE_QUOTATION:
                if not quotation:
                    raise ValueError('Quotation missing for reverse sync.')
                if quotation.pricing_frozen or quotation.status in ('Approved', 'Superseded'):
                    raise ValueError('Cannot sync into frozen quotation.')
                counts = _sync_material_plans_to_quotation(quotation, project, run)
            else:
                raise ValueError('Unsupported destination module.')
        except Exception as exc:
            error = str(exc)[:1000]
            counts['failed'] = max(counts.get('failed') or 0, 1)

        run.total_records = counts.get('total') or (
            (counts.get('created') or 0)
            + (counts.get('updated') or 0)
            + (counts.get('skipped') or 0)
            + (counts.get('failed') or 0)
        )
        run.created_records = counts.get('created') or 0
        run.updated_records = counts.get('updated') or 0
        run.skipped_records = counts.get('skipped') or 0
        run.failed_records = counts.get('failed') or 0
        run.protected_records = counts.get('protected') or 0
        run.conflict_details = counts.get('conflicts') or []
        run.error_details = error
        run.completed_at = timezone.now()
        if error and (run.created_records or run.updated_records):
            run.status = ModuleSyncRun.STATUS_PARTIAL
        elif error:
            run.status = ModuleSyncRun.STATUS_FAILED
        elif run.conflict_details and not (run.created_records or run.updated_records):
            run.status = ModuleSyncRun.STATUS_PARTIAL
        elif run.failed_records and (run.created_records or run.updated_records):
            run.status = ModuleSyncRun.STATUS_PARTIAL
        else:
            run.status = ModuleSyncRun.STATUS_SUCCESS
        run.save()
        return run


def _sync_material_plans_to_quotation(quotation: Quotation, project: Project, run: ModuleSyncRun) -> dict:
    from apps.leads.models import QuotationItem

    result = {
        'created': 0,
        'updated': 0,
        'skipped': 0,
        'protected': 0,
        'failed': 0,
        'conflicts': [],
        'total': 0,
    }
    plans = list(MaterialPlan.objects.filter(project=project).order_by('id'))
    result['total'] = len(plans)
    existing = {
        (it.item_name or '').strip().lower(): it
        for it in quotation.items.all()
    }
    for plan in plans:
        name = (plan.items or plan.category or '').strip()
        if not name:
            result['skipped'] += 1
            continue
        key = name.lower()
        qty = MaterialPlan.parse_qty(plan.planned_qty)
        rate = plan.planning_unit_price
        try:
            amount = None
            if plan.planned_value not in (None, ''):
                from decimal import Decimal
                amount = Decimal(str(plan.planned_value))
            elif rate is not None:
                from decimal import Decimal
                amount = (Decimal(str(rate)) * Decimal(str(qty or 0))).quantize(Decimal('0.01'))
        except Exception:
            amount = None

        if key in existing:
            item = existing[key]
            item.quantity = qty
            item.unit = (plan.uom or item.unit or 'Nos')[:20]
            if rate is not None:
                item.rate = rate
            if amount is not None:
                item.amount = amount
            item.save()
            result['updated'] += 1
            dest_id = item.id
            action = 'updated'
        else:
            item = QuotationItem.objects.create(
                quotation=quotation,
                item_name=name[:200],
                brand='',
                specification=(plan.category or '')[:200],
                quantity=qty,
                unit=(plan.uom or 'Nos')[:20],
                rate=rate or 0,
                amount=amount or 0,
            )
            existing[key] = item
            result['created'] += 1
            dest_id = item.id
            action = 'created'

        ModuleSyncMapping.objects.create(
            run=run,
            source_type='material_plan',
            source_id=str(plan.id),
            destination_type='quotation_item',
            destination_id=str(dest_id),
            content_hash=_content_hash(name, qty, rate),
            status=action,
        )

    quotation.recalculate_totals()
    quotation.save()
    return result


def retry_failed(run_id, user=None) -> ModuleSyncRun:
    run = ModuleSyncRun.objects.filter(pk=run_id).first()
    if not run:
        raise ValueError('Sync run not found.')
    if run.status not in (ModuleSyncRun.STATUS_FAILED, ModuleSyncRun.STATUS_PARTIAL):
        raise ValueError('Only failed/partial sync runs can be retried.')
    # Re-issue a fresh preview token and re-run with same parameters.
    preview = preview_sync(
        source_module=run.source_module,
        destination_module=run.destination_module,
        report_type=run.report_type,
        project_id=run.project_id,
        quotation_id=run.quotation_id,
        bom_version_id=run.bom_version_id,
        user=user,
    )
    return run_sync(preview_token=preview['preview_token'], confirm=True, user=user)


def serialize_run(run: ModuleSyncRun) -> dict:
    return {
        'id': run.id,
        'source_module': run.source_module,
        'destination_module': run.destination_module,
        'report_type': run.report_type,
        'report_label': dict(ModuleSyncRun.REPORT_CHOICES).get(run.report_type, run.report_type),
        'project_id': run.project_id,
        'project_name': (
            (run.project.project_name or run.project.project_id)
            if run.project_id else None
        ),
        'bom_version_id': run.bom_version_id,
        'quotation_id': run.quotation_id,
        'quotation_number': getattr(run.quotation, 'quotation_number', None) if run.quotation_id else None,
        'status': run.status,
        'total_records': run.total_records,
        'created_records': run.created_records,
        'updated_records': run.updated_records,
        'skipped_records': run.skipped_records,
        'failed_records': run.failed_records,
        'protected_records': run.protected_records,
        'conflict_details': run.conflict_details,
        'error_details': run.error_details,
        'started_by': run.started_by_id,
        'started_by_name': (
            (getattr(run.started_by, 'name', None) or getattr(run.started_by, 'email', None))
            if run.started_by_id else None
        ),
        'started_at': run.started_at,
        'completed_at': run.completed_at,
        'created_at': run.created_at,
        'preview_token': run.preview_token if run.status == ModuleSyncRun.STATUS_PENDING else '',
    }
