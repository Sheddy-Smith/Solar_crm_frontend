import hashlib
import json
import logging
import os as _os

from django.core.cache import cache

from apps.accounts_module.services import accounts_dashboard_summary
from apps.amc.services import amc_dashboard_summary
from apps.inventory.services import inventory_summary
from apps.leads.analytics_service import lead_analytics
from apps.projects.kpi_service import project_kpi_analytics
from apps.projects.models import Project
from apps.reports.services import reports_dashboard

# 45s default; staging Locust sets DASHBOARD_CACHE_TTL higher via env if needed.
CACHE_TTL_SECONDS = int(_os.environ.get('DASHBOARD_CACHE_TTL', '45') or 45)
# Shared generation counter — bumped on CRM writes that affect aggregates.
CACHE_GEN_KEY = 'unified_dashboard:gen'
# Explicit scope marker: payload is org-wide aggregates (not per-user PII).
# If the builder ever becomes user-scoped, bump this and include viewer id.
CACHE_SCOPE = 'crm_global_v1'
logger = logging.getLogger(__name__)


def _cache_generation():
    try:
        value = cache.get(CACHE_GEN_KEY)
        return int(value or 0)
    except Exception:
        return 0


def invalidate_unified_dashboard_cache(reason: str = '') -> None:
    """Bump generation so all filter variants miss on next read (TTL cleans orphans)."""
    try:
        try:
            cache.incr(CACHE_GEN_KEY)
        except ValueError:
            # Key missing on some backends until first set.
            cache.add(CACHE_GEN_KEY, 0, timeout=None)
            try:
                cache.incr(CACHE_GEN_KEY)
            except Exception:
                cache.set(CACHE_GEN_KEY, 1, timeout=None)
        logger.info('unified_dashboard cache invalidated reason=%s gen=%s', reason or 'unspecified', _cache_generation())
    except Exception:
        logger.warning('unified_dashboard cache invalidation failed reason=%s', reason or 'unspecified', exc_info=True)


def _cache_key(params, viewer_fingerprint: str = ''):
    """Key includes generation + global scope (+ optional viewer fingerprint).

    Viewer fingerprint is only for future scoped payloads. Today the dashboard
    body is identical for all Dashboard:can_view users; fingerprint stays empty
    so the cache remains shared. Never store another user's private rows here.
    """
    normalized = json.dumps(
        sorted((k, str(v)) for k, v in params.items() if v not in (None, '')),
        sort_keys=True,
    )
    digest = hashlib.md5(normalized.encode()).hexdigest()
    gen = _cache_generation()
    fp = (viewer_fingerprint or 'shared').strip() or 'shared'
    return f'unified_dashboard:{CACHE_SCOPE}:g{gen}:{fp}:{digest}'


_OM_ALERT_KEYS = (
    'om_service_overdue',
    'om_service_due',
    'om_critical_complaints',
    'om_open_tickets',
    'om_insurance_expiring',
    'om_insurance_expired',
    'om_free_expiring',
    'om_free_expired',
)


def _om_alerts():
    """Return O&M alert fields. On failure keep keys present + om_unavailable flag."""
    try:
        from apps.om.dashboard import dashboard_summary
        data = dashboard_summary()
    except Exception:
        logger.exception('O&M alerts for the unified dashboard failed')
        # DASH-06: do not silently omit keys — frontend can show unavailable state.
        payload = {key: None for key in _OM_ALERT_KEYS}
        payload['om_unavailable'] = True
        payload['om_error'] = 'O&M dashboard summary unavailable'
        return payload
    summary = data['summary']
    upcoming = {row['key']: row['count'] for row in data['alerts']['upcoming']}
    return {
        'om_service_overdue': summary['service_overdue'],
        'om_service_due': summary['service_due'],
        'om_critical_complaints': summary['critical_complaints'],
        'om_open_tickets': summary['open_tickets'],
        'om_insurance_expiring': summary['insurance_expiring'],
        'om_insurance_expired': summary['insurance_expired'],
        'om_free_expiring': upcoming.get('free_expiring', 0),
        'om_free_expired': summary['expired_service_plants'],
        'om_unavailable': False,
        'om_error': '',
    }


def _build_alerts(reports, sales, inventory, amc, accounts):
    ops = reports.get('operations') or {}
    flow = ops.get('pending_flow') or {}
    return {
        **_om_alerts(),
        'overdue_followups': sales.get('overdue', 0),
        'low_stock_items': (inventory or {}).get('low_stock', 0),
        'out_of_stock_items': (inventory or {}).get('out_of_stock', 0),
        'expiring_amc': (amc or {}).get('expiring_contracts', 0),
        'pending_work_orders': flow.get('work_orders', 0),
        'pending_quotations': flow.get('quotations', 0),
        'pending_dispatch': flow.get('dispatch', 0),
        'delayed_dispatch': flow.get('dispatch_delayed', 0),
        'pending_installation': flow.get('installation', 0),
        'pending_invoices': flow.get('invoices', 0),
        'short_materials': flow.get('materials', 0),
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
    # DASH-03: pass the same date window into project / accounts / inventory / AMC.
    projects_kpi = project_kpi_analytics(date_from=date_from, date_to=date_to)
    accounts = accounts_dashboard_summary(date_from=date_from, date_to=date_to)
    inventory = inventory_summary(date_from=date_from, date_to=date_to)
    amc = amc_dashboard_summary(date_from=date_from, date_to=date_to)

    # One grouped query instead of 6 COUNT(*) round-trips (staging Locust hotspot).
    # DASH-02: exclude soft-deleted projects so summary matches project_kpi_analytics.
    from django.db.models import Count, Q
    project_qs = Project.objects.filter(is_deleted=False)
    if date_from:
        project_qs = project_qs.filter(created_at__date__gte=date_from)
    if date_to:
        project_qs = project_qs.filter(created_at__date__lte=date_to)
    project_counts = project_qs.aggregate(
        total=Count('id'),
        planning=Count('id', filter=Q(status='Planning')),
        active=Count('id', filter=Q(status='Active')),
        on_hold=Count('id', filter=Q(status='On Hold')),
        completed=Count('id', filter=Q(status='Completed')),
        cancelled=Count('id', filter=Q(status='Cancelled')),
    )
    project_summary = {
        'total': project_counts['total'] or 0,
        'planning': project_counts['planning'] or 0,
        'active': project_counts['active'] or 0,
        'on_hold': project_counts['on_hold'] or 0,
        'completed': project_counts['completed'] or 0,
        'cancelled': project_counts['cancelled'] or 0,
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
            # Snapshot metrics (bank, stock on-hand, active AMC) stay live;
            # payment / lead / project-created / movement counts respect the range.
            'date_scope': 'period_activity_plus_live_snapshots',
        },
    }


def get_unified_dashboard(params=None, viewer_fingerprint: str = ''):
    params = {k: v for k, v in (params or {}).items() if v not in (None, '')}
    key = _cache_key(params, viewer_fingerprint=viewer_fingerprint)
    lock_key = f'{key}:lock'
    # The Redis cache is an optimization only — any failure (including ones
    # django-redis doesn't classify as ignorable connection errors, e.g.
    # stale-entry deserialization after a library upgrade) must degrade to a
    # cache miss, never a 500 on the dashboard.
    try:
        cached = cache.get(key)
    except Exception:
        cached = None
    if cached is not None:
        return cached

    # Stampede lock: only one builder runs; others briefly wait then re-read cache
    # or build if lock holder failed. cache.add is atomic on Redis/LocMem.
    got_lock = False
    try:
        got_lock = bool(cache.add(lock_key, '1', timeout=min(30, CACHE_TTL_SECONDS)))
    except Exception:
        got_lock = True  # if lock store fails, build anyway

    if not got_lock:
        import time
        for _ in range(15):
            time.sleep(0.2)
            try:
                cached = cache.get(key)
            except Exception:
                cached = None
            if cached is not None:
                return cached
        # Timed out waiting — fall through and build (better than empty 504).

    try:
        payload = build_unified_dashboard(params)
        try:
            cache.set(key, payload, CACHE_TTL_SECONDS)
        except Exception:
            pass
        return payload
    finally:
        if got_lock:
            try:
                cache.delete(lock_key)
            except Exception:
                pass
