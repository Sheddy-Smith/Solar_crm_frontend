"""Staging-only API regression smoke for scale changes. Never production."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

HOST = os.environ.get('PHASE3_HOST', 'http://127.0.0.1:8060').rstrip('/')
TOKENS = Path(__file__).resolve().parents[1] / 'scripts' / 'phase3_results' / 'minted_tokens.json'
OUT = Path(__file__).resolve().parents[1] / 'scripts' / 'phase3_results' / 'code_quality_api_checks.json'


def req(method, path, token=None, body=None, timeout=30):
    data = None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    if body is not None:
        data = json.dumps(body).encode()
    r = urllib.request.Request(f'{HOST}{path}', data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8', 'replace')
            try:
                payload = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                payload = raw[:200]
            return {'ok': True, 'status': resp.status, 'body': payload}
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'replace') if e.fp else ''
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw[:300]
        return {'ok': False, 'status': e.code, 'body': payload}
    except Exception as exc:  # noqa: BLE001
        return {'ok': False, 'status': None, 'error': str(exc)}


def main():
    results = {'host': HOST, 'cases': {}}
    results['cases']['health'] = req('GET', '/api/v1/health/', token=None)
    results['cases']['ready'] = req('GET', '/api/v1/ready/', token=None)

    tokens = json.loads(TOKENS.read_text(encoding='utf-8')) if TOKENS.exists() else []
    admin = next((t for t in tokens if 'admin' in t.get('email', '')), tokens[0] if tokens else None)
    if not admin:
        results['cases']['auth'] = {'ok': False, 'error': 'no minted tokens'}
        OUT.write_text(json.dumps(results, indent=2), encoding='utf-8')
        print(json.dumps(results, indent=2))
        return 1

    tok = admin['access']
    results['token_email'] = admin['email']

    # Login with password (fresh JWT path)
    login = req('POST', '/api/v1/auth/login/', body={
        'email': 'staging.admin@local.test',
        'password': 'StagingLoad@123',
    })
    results['cases']['login'] = {
        'ok': login.get('status') == 200 and isinstance(login.get('body'), dict) and 'access' in (login.get('body') or {}),
        'status': login.get('status'),
        'has_access': isinstance(login.get('body'), dict) and 'access' in (login.get('body') or {}),
        'has_refresh': isinstance(login.get('body'), dict) and 'refresh' in (login.get('body') or {}),
    }
    if results['cases']['login']['ok']:
        tok = login['body']['access']
        refresh = login['body'].get('refresh')
        if refresh:
            ref = req('POST', '/api/v1/auth/token/refresh/', body={'refresh': refresh})
            # endpoint path may vary
            if ref.get('status') == 404:
                ref = req('POST', '/api/v1/auth/refresh/', body={'refresh': refresh})
            results['cases']['jwt_refresh'] = {
                'ok': ref.get('status') == 200 and isinstance(ref.get('body'), dict) and 'access' in (ref.get('body') or {}),
                'status': ref.get('status'),
                'body_keys': list((ref.get('body') or {}).keys())[:10] if isinstance(ref.get('body'), dict) else None,
            }

    me = req('GET', '/api/v1/users/me/', token=tok)
    results['cases']['users_me'] = {
        'ok': me.get('status') == 200,
        'status': me.get('status'),
        'email': (me.get('body') or {}).get('email') if isinstance(me.get('body'), dict) else None,
    }

    def list_ok(name, path):
        r = req('GET', path, token=tok)
        body = r.get('body')
        results['cases'][name] = {
            'ok': r.get('status') == 200,
            'status': r.get('status'),
            'is_list_or_page': isinstance(body, list) or (isinstance(body, dict) and ('results' in body or 'count' in body)),
            'count_hint': (
                len(body) if isinstance(body, list)
                else (body.get('count') if isinstance(body, dict) else None)
            ),
        }
        return r

    list_ok('leads_list', '/api/v1/leads/?page=1&page_size=20')
    list_ok('leads_search', '/api/v1/leads/?search=Customer&page_size=20')
    list_ok('followups', '/api/v1/follow-ups/?page=1&page_size=20')
    list_ok('projects', '/api/v1/projects/?page=1&page_size=20')
    list_ok('site_surveys', '/api/v1/site-surveys/?page=1&page_size=20')
    list_ok('quotations', '/api/v1/quotations/?page=1&page_size=20')

    stats = req('GET', '/api/v1/leads/stats/?period=month', token=tok)
    body = stats.get('body') if isinstance(stats.get('body'), dict) else {}
    results['cases']['leads_stats'] = {
        'ok': stats.get('status') == 200 and 'total' in body and 'won' in body,
        'status': stats.get('status'),
        'keys': sorted(body.keys()) if body else [],
        'total': body.get('total'),
        'won': body.get('won'),
    }

    # page_size cap
    big = req('GET', '/api/v1/leads/?page_size=1000', token=tok)
    b = big.get('body') if isinstance(big.get('body'), dict) else {}
    results_len = len(b.get('results') or []) if isinstance(b, dict) else (len(big.get('body')) if isinstance(big.get('body'), list) else None)
    results['cases']['page_size_cap'] = {
        'ok': big.get('status') == 200 and (results_len is None or results_len <= 200),
        'status': big.get('status'),
        'returned_rows': results_len,
        'max_allowed': 200,
    }

    dash = req('GET', '/api/v1/dashboard/unified/', token=tok, timeout=120)
    results['cases']['dashboard_unified'] = {
        'ok': dash.get('status') == 200 and isinstance(dash.get('body'), dict),
        'status': dash.get('status'),
        'top_keys': list((dash.get('body') or {}).keys())[:12] if isinstance(dash.get('body'), dict) else None,
    }

    reports = req('GET', '/api/v1/reports/dashboard/', token=tok, timeout=60)
    results['cases']['reports_dashboard'] = {
        'ok': reports.get('status') == 200,
        'status': reports.get('status'),
    }

    # Export under staging (ALLOW_EAGER likely true on staging_mysql inherit?)
    exp = req('POST', '/api/v1/reports/export-leads/', token=tok, body={})
    results['cases']['export_leads'] = {
        'status': exp.get('status'),
        'ok': exp.get('status') in (202, 503),
        'body': exp.get('body'),
        'note': '202 queued or 503 if eager refused',
    }

    # Unauth export must not succeed
    unauth = req('POST', '/api/v1/reports/export-leads/', token=None, body={})
    results['cases']['export_unauth'] = {
        'ok': unauth.get('status') in (401, 403),
        'status': unauth.get('status'),
    }

    # Lead write (safe remark patch)
    leads = req('GET', '/api/v1/leads/?page_size=1', token=tok)
    lead_id = None
    if isinstance(leads.get('body'), dict) and leads['body'].get('results'):
        lead_id = leads['body']['results'][0].get('id')
    elif isinstance(leads.get('body'), list) and leads['body']:
        lead_id = leads['body'][0].get('id')
    if lead_id:
        patch = req('PATCH', f'/api/v1/leads/{lead_id}/', token=tok, body={'remarks': 'quality-audit-ping'})
        results['cases']['lead_patch'] = {
            'ok': patch.get('status') in (200, 202),
            'status': patch.get('status'),
            'lead_id': lead_id,
        }
        # verify persisted
        get_one = req('GET', f'/api/v1/leads/{lead_id}/', token=tok)
        remarks = (get_one.get('body') or {}).get('remarks') if isinstance(get_one.get('body'), dict) else None
        results['cases']['lead_patch_persisted'] = {
            'ok': remarks == 'quality-audit-ping',
            'remarks': remarks,
            'status': get_one.get('status'),
        }
    else:
        results['cases']['lead_patch'] = {'ok': False, 'error': 'no lead id'}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps(results, indent=2))
    print('WROTE', OUT)
    fails = [k for k, v in results['cases'].items() if isinstance(v, dict) and v.get('ok') is False]
    return 1 if fails else 0


if __name__ == '__main__':
    raise SystemExit(main())
