"""Staging failure/recovery probes — LOCAL only. Never production."""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

HOST = os.environ.get('STAGING_HOST', 'http://127.0.0.1:8050').rstrip('/')
OUT = Path(__file__).resolve().parents[1] / 'scripts' / 'staging_locust_results' / 'phase2_failure_tests.json'


def get(path: str, timeout: float = 5):
    url = f'{HOST}{path}'
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            body = resp.read().decode('utf-8', errors='replace')
            return {'ok': True, 'status': resp.status, 'body': body[:500]}
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace') if e.fp else ''
        return {'ok': False, 'status': e.code, 'body': body[:500]}
    except Exception as exc:  # noqa: BLE001
        return {'ok': False, 'status': None, 'error': str(exc)}


def main() -> int:
    results = {
        'host': HOST,
        'note': 'Observational probes against local staging. Redis/MySQL kill tests require operator action.',
        'cases': {},
    }

    results['cases']['health_liveness'] = get('/api/v1/health/')
    results['cases']['ready_with_redis'] = get('/api/v1/ready/')

    # Burst — high volume short window
    burst_ok = 0
    burst_fail = 0
    t0 = time.time()
    for _ in range(100):
        r = get('/api/v1/health/', timeout=2)
        if r.get('ok'):
            burst_ok += 1
        else:
            burst_fail += 1
    results['cases']['high_request_burst_health'] = {
        'ok': burst_fail == 0,
        'success': burst_ok,
        'fail': burst_fail,
        'elapsed_s': round(time.time() - t0, 3),
    }

    # Large report export (unauthenticated should 401/403 — proves endpoint exists)
    try:
        req = urllib.request.Request(
            f'{HOST}/api/v1/reports/export-leads/',
            data=b'{}',
            method='POST',
            headers={'Content-Type': 'application/json'},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            results['cases']['export_leads_unauth'] = {'status': resp.status, 'unexpected': True}
    except urllib.error.HTTPError as e:
        results['cases']['export_leads_unauth'] = {
            'ok': e.code in (401, 403),
            'status': e.code,
            'note': 'Expected auth gate before queueing Celery export',
        }
    except Exception as exc:  # noqa: BLE001
        results['cases']['export_leads_unauth'] = {'ok': False, 'error': str(exc)}

    results['manual_scenarios'] = [
        {
            'name': 'Redis temporarily unavailable',
            'how': 'Stop Memurai service briefly; hit /api/v1/ready/ and authenticated list endpoints',
            'expect': 'ready redis=error (200 unless READY_REQUIRE_REDIS=1); API degrades with LocMem/fail-open throttle; no crash loop',
        },
        {
            'name': 'MySQL temporarily unavailable',
            'how': 'Stop MySQL80 briefly on MySQL staging; hit /api/v1/ready/',
            'expect': 'ready returns 503 database=error; health still 200; recover after MySQL start',
        },
        {
            'name': 'Worker crash',
            'how': 'Kill one Waitress/Gunicorn worker process under load',
            'expect': 'Remaining workers serve; no DB corruption; clients retry succeed',
        },
        {
            'name': 'External API timeout',
            'how': 'Point EMAIL_HOST at blackhole IP; trigger send_mail_safe',
            'expect': 'smtp circuit opens after threshold; subsequent sends fail fast',
        },
    ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps(results, indent=2))
    print('WROTE', OUT)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
