"""O&M → pending-work flow.

Each list is derived live from the records the Project Management, Lead,
Accounts and Inventory modules already own, so an item leaves its list the
moment the underlying step is done (work order generated, quotation created,
material dispatched, installation marked Done, invoice raised, stock refilled).
"""
from collections import defaultdict
from decimal import Decimal

from django.db.models import Count
from django.utils import timezone

from apps.accounts.permissions import lead_owner_filter
from apps.accounts_module.models import SellChallan, SellInvoice
from apps.inventory.models import InventoryItem
from apps.leads.models import Lead
from apps.projects.models import MaterialPlan, Project

# A line that stays Packed this many days without being dispatched is Delayed.
DISPATCH_DELAY_DAYS = 2


def _num(value):
    return float(value or 0)


def _local_date(value):
    return timezone.localtime(value).date() if value else None


def _days_since(value, today):
    if not value:
        return None
    date = value if not hasattr(value, 'hour') else _local_date(value)
    return max((today - date).days, 0)


def won_projects(user):
    """Won-lead projects still in play — the same set every Project Management
    hub (Dispatch, Installation, Sales Challan, Invoice) works on."""
    qs = Project.objects.filter(
        is_deleted=False, lead__isnull=False, lead__is_deleted=False, lead__status='Won',
    ).exclude(status='Cancelled')
    filt = lead_owner_filter(user, prefix='lead__')
    if filt:
        qs = qs.filter(**filt)
    return qs


def _project_row(project, today):
    lead = project.lead if project.lead_id else None
    manager = project.manager if project.manager_id else None
    return {
        'id': project.id,
        'project_id': project.project_id,
        'project_name': project.project_name,
        'customer_name': project.customer_name,
        'mobile_number': lead.mobile_number if lead else '',
        'site': project.site or project.city or '',
        'city': project.city,
        'capacity_kwp': _num(project.capacity_kwp),
        'project_type': project.project_type,
        'status': project.status,
        'lead': project.lead_id,
        'manager_name': (manager.name if manager else '') or '',
        'target_date': project.target_date,
        'created_at': project.created_at,
        'days_pending': _days_since(project.created_at, today),
    }


def _line_status(plan):
    return MaterialPlan.compute_dispatch_status(plan.planned_qty, plan.dispatched_qty, plan.dispatch_status)


# ── 1. Pending Work Orders ──────────────────────────────────────────────────

def pending_work_orders(user):
    today = timezone.localdate()
    qs = (
        won_projects(user)
        .annotate(wo_count=Count('work_orders'))
        .filter(wo_count=0)
        .select_related('lead', 'manager', 'job_sheet')
        .order_by('created_at')
    )
    rows = []
    for project in qs:
        row = _project_row(project, today)
        sheet = getattr(project, 'job_sheet', None)
        assigned = 0
        if sheet:
            assigned = sum(
                1 for r in list(sheet.items or []) + list(sheet.extra_items or [])
                if isinstance(r, dict) and r.get('work_order_type') and r.get('assignee_name')
            )
        if not sheet:
            stage = 'No Job Sheet'
        elif assigned:
            stage = 'Ready to Generate'
        else:
            stage = 'Job Sheet Draft'
        row.update({
            'job_sheet_id': sheet.id if sheet else None,
            'job_sheet_no': sheet.job_sheet_no if sheet else '',
            'job_sheet_assigned_rows': assigned,
            'stage': stage,
        })
        rows.append(row)
    return rows


# ── 2. Pending Quotations ───────────────────────────────────────────────────

def pending_quotations(user):
    today = timezone.localdate()
    qs = (
        Lead.objects.filter(status='Won', is_deleted=False)
        .exclude(quotations__is_deleted=False)
        .select_related('assigned_to')
        .prefetch_related('projects')
        .order_by('updated_at')
    )
    filt = lead_owner_filter(user)
    if filt:
        qs = qs.filter(**filt)
    rows = []
    for lead in qs:
        project = next((p for p in lead.projects.all() if not p.is_deleted), None)
        rows.append({
            'id': lead.id,
            'ivrs_number': lead.ivrs_number,
            'customer_name': lead.customer_name,
            'mobile_number': lead.mobile_number,
            'alternate_number': lead.alternate_number,
            'email': lead.email,
            'address': lead.address,
            'city': lead.city,
            'project_name': lead.project_name,
            'project_type': lead.project_type,
            'estimated_capacity': lead.estimated_capacity,
            'source': lead.source,
            'status': lead.status,
            'assigned_to_name': (lead.assigned_to.name if lead.assigned_to_id else '') or '',
            'won_on': _local_date(lead.updated_at),
            'days_pending': _days_since(lead.updated_at, today),
            'project': project.id if project else None,
            'project_code': project.project_id if project else '',
        })
    return rows


# ── 3. Pending Dispatch ─────────────────────────────────────────────────────

def pending_dispatch(user):
    today = timezone.localdate()
    plans = (
        MaterialPlan.objects.filter(project__in=won_projects(user))
        .select_related('project', 'project__lead', 'project__manager')
        .order_by('project_id', 'id')
    )
    grouped = defaultdict(list)
    projects = {}
    for plan in plans:
        grouped[plan.project_id].append(plan)
        projects[plan.project_id] = plan.project

    rows = []
    for project_id, lines in grouped.items():
        counts = {'Pending': 0, 'Packed': 0, 'Partial': 0, 'Dispatched': 0}
        line_rows = []
        oldest_packed = None
        for plan in lines:
            status = _line_status(plan)
            counts[status] += 1
            if status == 'Packed' and plan.packed_at and (oldest_packed is None or plan.packed_at < oldest_packed):
                oldest_packed = plan.packed_at
            line_rows.append({
                'id': plan.id,
                'category': plan.category,
                'items': plan.items,
                'uom': plan.uom,
                'planned_qty': plan.planned_qty,
                'dispatched_qty': plan.dispatched_qty or '0',
                'left_qty': float(plan.left_qty),
                'status': status,
                'packed_at': plan.packed_at,
                'packed_days': _days_since(plan.packed_at, today) if status == 'Packed' else None,
            })
        if counts['Dispatched'] == len(lines):
            continue
        delay_days = _days_since(oldest_packed, today)
        is_delayed = delay_days is not None and delay_days >= DISPATCH_DELAY_DAYS
        if is_delayed:
            stage = 'Delayed'
        elif counts['Packed']:
            stage = 'Packed'
        elif counts['Partial'] or counts['Dispatched']:
            stage = 'Partial'
        else:
            stage = 'Pending'
        row = _project_row(projects[project_id], today)
        row.update({
            'total_lines': len(lines),
            'pending_lines': counts['Pending'],
            'packed_lines': counts['Packed'],
            'partial_lines': counts['Partial'],
            'dispatched_lines': counts['Dispatched'],
            'packed_since': oldest_packed,
            'delay_days': delay_days,
            'is_delayed': is_delayed,
            'stage': stage,
            'lines': line_rows,
        })
        rows.append(row)
    order = {'Delayed': 0, 'Packed': 1, 'Partial': 2, 'Pending': 3}
    rows.sort(key=lambda r: (order[r['stage']], -(r['delay_days'] or 0), r['created_at']))
    return rows


def set_packed(user, project_id, packed=True, line_ids=None):
    """Mark a project's not-yet-sent BOM lines Packed (or back to Pending)."""
    project = won_projects(user).get(pk=project_id)
    plans = MaterialPlan.objects.filter(project=project)
    if line_ids:
        plans = plans.filter(pk__in=line_ids)
    now = timezone.now()
    changed = 0
    for plan in plans:
        if MaterialPlan.parse_qty(plan.dispatched_qty) > 0:
            continue
        if packed and plan.dispatch_status != 'Packed':
            plan.dispatch_status, plan.packed_at = 'Packed', plan.packed_at or now
        elif not packed and plan.dispatch_status != 'Pending':
            plan.dispatch_status, plan.packed_at = 'Pending', None
        else:
            continue
        plan.save(update_fields=['dispatch_status', 'packed_at', 'updated_at'])
        changed += 1
    return changed


# ── 4. Pending Installation ─────────────────────────────────────────────────

def pending_installation(user):
    today = timezone.localdate()
    qs = (
        won_projects(user)
        .exclude(installation_status='Done')
        .select_related('lead', 'manager')
        .prefetch_related('material_plans', 'milestones', 'checklist_items')
        .order_by('target_date', 'created_at')
    )
    rows = []
    for project in qs:
        plans = list(project.material_plans.all())
        dispatched = sum(1 for p in plans if _line_status(p) == 'Dispatched')
        tasks = list(project.milestones.all())
        qa = [c for c in project.checklist_items.all() if c.phase == 'Installation']
        row = _project_row(project, today)
        row.update({
            'installation_status': project.installation_status,
            'material_lines': len(plans),
            'dispatched_lines': dispatched,
            'material_ready': bool(plans) and dispatched == len(plans),
            'tasks_total': len(tasks),
            'tasks_done': sum(1 for t in tasks if t.status == 'Completed'),
            'qa_total': len(qa),
            'qa_done': sum(1 for c in qa if c.is_checked),
            'is_overdue': bool(project.target_date and project.target_date < today),
        })
        rows.append(row)
    return rows


def set_installation_status(user, project_id, done=True):
    project = won_projects(user).get(pk=project_id)
    if done:
        project.installation_status = 'Done'
        project.installation_done_on = project.installation_done_on or timezone.localdate()
    else:
        project.installation_status = 'Not Done'
        project.installation_done_on = None
    project.save(update_fields=['installation_status', 'installation_done_on', 'updated_at'])
    return project


# ── 5. Pending Invoice (Sales Challan → Invoice) ────────────────────────────

def pending_invoices(user):
    today = timezone.localdate()
    projects = won_projects(user)
    invoiced = set(
        SellInvoice.objects.filter(project__in=projects).exclude(status='Cancelled')
        .values_list('project_id', flat=True)
    )
    challans = {}
    for challan in (
        SellChallan.objects.filter(project__in=projects).exclude(status='Cancelled')
        .order_by('project_id', '-challan_date', '-id')
    ):
        challans.setdefault(challan.project_id, challan)

    rows = []
    for project in projects.exclude(pk__in=invoiced).select_related('lead', 'manager').order_by('created_at'):
        challan = challans.get(project.id)
        row = _project_row(project, today)
        row.update({
            'pending_document': 'Invoice' if challan else 'Sales Challan',
            'challan_id': challan.id if challan else None,
            'challan_no': challan.challan_no if challan else '',
            'challan_date': challan.challan_date if challan else None,
            'challan_total': _num(challan.total_amount) if challan else 0,
            'installation_status': project.installation_status,
            'total_value': _num(project.total_value),
        })
        rows.append(row)
    return rows


# ── 6. Short-Listed Material ────────────────────────────────────────────────

def short_materials(user):
    items = list(InventoryItem.objects.filter(is_active=True).select_related('warehouse'))
    by_id = {item.id: item for item in items}
    by_name = {}
    for item in items:
        by_name.setdefault((item.name or '').strip().lower(), item)

    demand = defaultdict(Decimal)
    demand_projects = defaultdict(set)
    plans = MaterialPlan.objects.filter(project__in=won_projects(user)).select_related('project')
    for plan in plans:
        left = plan.left_qty
        if left <= 0:
            continue
        item = by_id.get(plan.inventory_item_id) if plan.inventory_item_id else by_name.get((plan.items or '').strip().lower())
        if not item:
            continue
        demand[item.id] += left
        demand_projects[item.id].add(plan.project.project_id)

    rows = []
    for item in items:
        current, minimum, need = item.current_stock, item.minimum_stock, demand.get(item.id, Decimal('0'))
        out_of_stock = current <= 0
        low_stock = minimum > 0 and current <= minimum
        demand_short = need > current
        if not (out_of_stock or low_stock or demand_short):
            continue
        shortage = max(max(minimum, need) - current, Decimal('0'))
        if out_of_stock:
            status = 'Out of Stock'
        elif low_stock:
            status = 'Low Stock'
        else:
            status = 'Project Shortage'
        rows.append({
            'id': item.id,
            'item_code': item.item_code or '',
            'name': item.name,
            'category': item.category,
            'unit': item.unit,
            'current_stock': _num(current),
            'minimum_stock': _num(minimum),
            'project_demand': _num(need),
            'shortage': _num(shortage),
            'rate': _num(item.rate),
            'reorder_value': _num(shortage * (item.rate or 0)),
            'warehouse': item.warehouse.name if item.warehouse_id else '',
            'status': status,
            'demand_short': demand_short,
            'projects': sorted(demand_projects.get(item.id, [])),
        })
    order = {'Out of Stock': 0, 'Project Shortage': 1, 'Low Stock': 2}
    rows.sort(key=lambda r: (order[r['status']], -r['shortage'], r['name'].lower()))
    return rows


LISTS = {
    'work_orders': pending_work_orders,
    'quotations': pending_quotations,
    'dispatch': pending_dispatch,
    'installation': pending_installation,
    'invoices': pending_invoices,
    'materials': short_materials,
}


def pending_summary(user):
    results = {key: fn(user) for key, fn in LISTS.items()}
    counts = {key: len(rows) for key, rows in results.items()}
    counts.update({
        'dispatch_delayed': sum(1 for r in results['dispatch'] if r['is_delayed']),
        'invoices_challan': sum(1 for r in results['invoices'] if r['pending_document'] == 'Sales Challan'),
        'invoices_invoice': sum(1 for r in results['invoices'] if r['pending_document'] == 'Invoice'),
        'dispatch_delay_days': DISPATCH_DELAY_DAYS,
    })
    return counts


def pending_counts_global():
    """Unscoped counts for the dashboard (which is not lead-scoped either)."""
    return pending_summary(None)
