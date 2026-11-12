"""Authenticated API smoke across CRM modules (no browser required)."""
from __future__ import annotations

import json
import os
import sys

import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.development')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

BASE = os.environ.get('E2E_API_BASE', 'http://127.0.0.1:8000/api/v1')
EMAIL = os.environ.get('E2E_EMAIL', 'loadtest@local.test')
PASSWORD = os.environ.get('E2E_PASSWORD', 'LoadTest@12345')

CHECKS = [
    ('auth/me', 'GET', '/users/me/'),
    ('dashboard', 'GET', '/reports/dashboard/'),
    ('leads', 'GET', '/leads/?page_size=5'),
    ('customers', 'GET', '/accounts/parties/?account_type=Customer&page_size=5'),
    ('customer_profile', 'GET', None),  # filled after customers
    ('orphan_projects', 'GET', '/accounts/parties/orphan-projects/'),
    ('detect_duplicates', 'GET', '/accounts/parties/detect-duplicates/'),
    ('quotations', 'GET', '/quotations/?page_size=5'),
    ('projects', 'GET', '/projects/?page_size=5'),
    ('projects_with_customer', 'GET', '/projects/?customer=&page_size=5'),
    ('payments', 'GET', '/accounts/payments/?page_size=5'),
    ('sell_invoices', 'GET', '/accounts/sell-invoices/?page_size=5'),
    ('inventory', 'GET', '/inventory/items/?page_size=5'),
    ('om_plants', 'GET', '/om/plants/?page_size=5'),
    ('daily_tasks', 'GET', '/daily-tasks/?page_size=5'),
    ('employees', 'GET', '/workforce/employees/?page_size=5'),
    ('vendors', 'GET', '/accounts/parties/?account_type=Vendor&page_size=5'),
    ('suppliers', 'GET', '/accounts/parties/?account_type=Supplier&page_size=5'),
    ('liaisoning', 'GET', '/liaison/projects/?page_size=5'),
]


def main() -> int:
    login = requests.post(f'{BASE}/auth/login/', json={'email': EMAIL, 'password': PASSWORD}, timeout=30)
    if login.status_code >= 400:
        print({'ok': False, 'login': login.status_code, 'body': login.text[:300]})
        return 1
    token = login.json().get('access')
    headers = {'Authorization': f'Bearer {token}'}
    results = []

    # Resolve a customer id for profile check
    parties = requests.get(f'{BASE}/accounts/parties/', params={'account_type': 'Customer', 'page_size': 1}, headers=headers, timeout=30)
    customer_id = None
    if parties.ok:
        rows = parties.json().get('results') or parties.json()
        if isinstance(rows, list) and rows:
            customer_id = rows[0].get('id')

    for name, method, path in CHECKS:
        if name == 'customer_profile':
            if not customer_id:
                results.append({'name': name, 'ok': False, 'detail': 'no customer'})
                continue
            path = f'/accounts/parties/{customer_id}/profile/'
        if name == 'projects_with_customer' and customer_id:
            path = f'/projects/?customer={customer_id}&page_size=5'
        url = f'{BASE}{path}'
        try:
            res = requests.request(method, url, headers=headers, timeout=45)
            ok = res.status_code < 500
            # 404 on optional modules is acceptable; 401/403 is permission issue
            detail = f'status={res.status_code}'
            if res.status_code >= 400:
                detail += f' body={res.text[:160]}'
            results.append({'name': name, 'ok': ok and res.status_code < 400, 'detail': detail, 'status': res.status_code})
        except Exception as exc:  # noqa: BLE001
            results.append({'name': name, 'ok': False, 'detail': str(exc)})

    # Orphan count after reconcile
    orphans = next((r for r in results if r['name'] == 'orphan_projects'), None)
    orphan_total = None
    if orphans and orphans.get('status') == 200:
        orphan_total = requests.get(f'{BASE}/accounts/parties/orphan-projects/', headers=headers, timeout=30).json().get('total_orphans')

    failed = [r for r in results if not r['ok']]
    report = {
        'ok': not failed,
        'failed_count': len(failed),
        'orphan_total': orphan_total,
        'results': results,
    }
    print(json.dumps(report, indent=2))
    return 0 if not failed else 1


if __name__ == '__main__':
    raise SystemExit(main())
