import hashlib
import json

from django.core.cache import cache

from apps.accounts_module.services import accounts_dashboard_summary
from apps.amc.services import amc_dashboard_summary
from apps.inventory.services import inventory_summary
from apps.leads.analytics_service import lead_analytics
from apps.projects.kpi_service import project_kpi_analytics
from apps.projects.models import Project
from apps.reports.services import reports_dashboard

CACHE_TTL_SECONDS = 45


def _cache_key(params):
    normalized = json.dumps(sorted((k, str(v)) for k, v in params.items() if v not in (None, '')), sort_keys=True)
    digest = hashlib.md5(normalized.encode()).hexdigest()
    return f'unified_dashboard:{digest}'


def _build_alerts(reports, sales, inventory, amc, accounts):
    ops = reports.get('operations') or {}
    return {
        'overdue_followups': sales.get('overdue', 0),
        'low_stock_items': (inventory or {}).get('low_stock', 0),
        'out_of_stock_items': (inventory or {}).get('out_of_stock', 0),
        'expiring_amc': (amc or {}).get('expiring_contracts', 0),
        'pending_tasks': ops.get('pending_tasks', 0),
        'open_om_tickets': ops.get('open_tickets', 0),
        'open_amc_requests': ops.get('open_amc_requests', 0),
        'pending_cheques': (accounts or {}).get('pending_cheques', 0),
        'stale_stock_items': (inventory or {}).get('stale_stock_items', 0),
    }


def build_unified_dashboard(params=None):
    params = params or {}
    date_from = params.get('date_from')
    date_to = params.get('date_to')
    project_type = params.get('project_type')
    status_filter = params.get('status')
    assigned_to = params.get('assigned_to')

    reports = reports_dashboard(date_from=date_from, date_to=date_to)
    sales = lead_analytics(
        date_from=date_from,
        date_to=date_to,
        project_type=project_type,
        status_filter=status_filter,
        assigned_to=assigned_to,
    )
    projects_kpi = project_kpi_analytics()
    accounts = accounts_dashboard_summary()
    inventory = inventory_summary()
    amc = amc_dashboard_summary()

    project_summary = {
        'total': Project.objects.count(),
        'planning': Project.objects.filter(status='Planning').count(),
        'active': Project.objects.filter(status='Active').count(),
        'on_hold': Project.objects.filter(status='On Hold').count(),
        'completed': Project.objects.filter(status='Completed').count(),
        'cancelled': Project.objects.filter(status='Cancelled').count(),
    }

    overview = {
        'hero': {
            'total_leads': sales.get('total', 0),
            'active_projects': project_summary.get('active', 0),
            'total_projects': project_summary.get('total', 0),
            'cash_received': accounts.get('total_received', 0),
            'bank_balance': accounts.get('bank_balance', 0),
            'bank_count': accounts.get('bank_count', 0),
            'stock_value': inventory.get('total_value', 0),
            'stock_items': inventory.get('total_items', 0),
            'active_amc': amc.get('active_contracts', 0),
            'open_amc_requests': amc.get('open_service_requests', 0),
        },
        'operations': reports.get('operations') or {},
        'inventory': inventory,
        'amc': amc,
        'reports_kpis': reports.get('kpis') or [],
    }

    finance = {
        'total_received': accounts.get('total_received', 0),
        'total_made': accounts.get('total_made', 0),
        'net_balance': accounts.get('net_balance', 0),
        'inventory_value': inventory.get('total_value', 0),
        'amc_contract_value': float(amc.get('contract_value') or 0),
        'pending_cheques': accounts.get('pending_cheques', 0),
        'bank_balance': accounts.get('bank_balance', 0),
        'revenue_period': reports.get('revenue', 0),
        'accounts': accounts,
    }

    alerts = _build_alerts(reports, sales, inventory, amc, accounts)

    return {
        'overview': overview,
        'sales': sales,
        'projects': {
            'summary': project_summary,
            'kpi': projects_kpi,
        },
        'finance': finance,
        'alerts': alerts,
        'reports': reports,
        'filters': {
            'date_from': date_from,
            'date_to': date_to,
            'project_type': project_type,
            'status': status_filter,
            'assigned_to': assigned_to,
        },
    }


def get_unified_dashboard(params=None):
    params = {k: v for k, v in (params or {}).items() if v not in (None, '')}
    key = _cache_key(params)
    cached = cache.get(key)
    if cached is not None:
        return cached
    payload = build_unified_dashboard(params)
    cache.set(key, payload, CACHE_TTL_SECONDS)
    return payload
