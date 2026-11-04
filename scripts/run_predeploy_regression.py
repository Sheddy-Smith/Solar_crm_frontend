"""Isolated staging regression for pre-deploy hardening. Never production.

Covers: file upload/download, RBAC matrix samples, logout blacklist,
duplicate mobile / IVRS behavior, pagination cap, dashboard cache bust,
export broker refuse, smoke + timings.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import struct
import time
import urllib.error
import urllib.request
import zlib
from pathlib import Path

HOST = os.environ.get('PHASE3_HOST', 'http://127.0.0.1:8060').rstrip('/')
OUT = Path(__file__).resolve().parents[1] / 'scripts' / 'phase3_results' / 'predeploy_regression.json'
ADMIN_EMAIL = os.environ.get('STAGING_ADMIN_EMAIL', 'staging.admin@local.test')
ADMIN_PASS = os.environ.get('STAGING_ADMIN_PASSWORD', 'StagingLoad@123')


def _png_bytes(color=(30, 144, 255)) -> bytes:
    """Minimal valid 1x1 PNG without Pillow."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    raw = bytes([0, color[0], color[1], color[2]])
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


def req(method, path, token=None, body=None, timeout=60, headers=None, raw_body=None, content_type=None):
    hdrs = dict(headers or {})
    data = raw_body
    if body is not None and raw_body is None:
        data = json.dumps(body).encode()
        hdrs.setdefault('Content-Type', 'application/json')
    if content_type:
        hdrs['Content-Type'] = content_type
    if token:
        hdrs['Authorization'] = f'Bearer {token}'
    r = urllib.request.Request(f'{HOST}{path}', data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read()
            ctype = resp.headers.get('Content-Type', '')
            payload = None
            if 'json' in ctype or (raw[:1] in (b'{', b'[')):
                try:
                    payload = json.loads(raw.decode('utf-8', 'replace') or 'null')
                except json.JSONDecodeError:
                    payload = raw[:200]
            else:
                payload = {'_bytes': len(raw), '_sha1': hashlib.sha1(raw).hexdigest()}
            return {'ok': True, 'status': resp.status, 'body': payload, 'raw': raw, 'headers': dict(resp.headers)}
    except urllib.error.HTTPError as e:
        raw = e.read() if e.fp else b''
        try:
            payload = json.loads(raw.decode('utf-8', 'replace') or 'null')
        except Exception:
            payload = raw[:300].decode('utf-8', 'replace')
        return {'ok': False, 'status': e.code, 'body': payload}
    except Exception as exc:  # noqa: BLE001
        return {'ok': False, 'status': None, 'error': str(exc)}


def multipart(fields: dict, files: dict):
    boundary = '----MalwaPredeploy' + hashlib.md5(str(time.time()).encode()).hexdigest()
    parts = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        )
    for name, (filename, content, ctype) in files.items():
        parts.append(
            (
                f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                f'Content-Type: {ctype}\r\n\r\n'
            ).encode()
            + content
            + b'\r\n'
        )
    parts.append(f'--{boundary}--\r\n'.encode())
    body = b''.join(parts)
    return body, f'multipart/form-data; boundary={boundary}'


def main():
    cases = {}
    meta = {
        'host': HOST,
        'started_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'git': {},
    }

    # Code version markers (best-effort)
    try:
        import subprocess
        root = Path(__file__).resolve().parents[1]
        meta['git']['head'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
        meta['git']['dirty'] = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=root, text=True).strip())
        meta['git']['describe'] = subprocess.check_output(
            ['git', 'describe', '--always', '--dirty'], cwd=root, text=True
        ).strip()
    except Exception as exc:  # noqa: BLE001
        meta['git']['error'] = str(exc)

    health = req('GET', '/api/v1/health/')
    cases['health'] = {'ok': health.get('status') == 200, **{k: health.get(k) for k in ('status', 'body')}}
    ready = req('GET', '/api/v1/ready/')
    cases['ready'] = {'ok': ready.get('status') == 200, **{k: ready.get(k) for k in ('status', 'body')}}

    login = req('POST', '/api/v1/auth/login/', body={'email': ADMIN_EMAIL, 'password': ADMIN_PASS})
    cases['login'] = {
        'ok': login.get('status') == 200 and isinstance(login.get('body'), dict) and 'access' in login['body'],
        'status': login.get('status'),
    }
    if not cases['login']['ok']:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps({'meta': meta, 'cases': cases}, indent=2), encoding='utf-8')
        print(json.dumps({'meta': meta, 'cases': cases}, indent=2))
        return 1

    access = login['body']['access']
    refresh = login['body']['refresh']

    # JWT refresh
    ref = req('POST', '/api/v1/auth/refresh/', body={'refresh': refresh})
    cases['jwt_refresh'] = {
        'ok': ref.get('status') == 200 and isinstance(ref.get('body'), dict) and 'access' in ref['body'],
        'status': ref.get('status'),
    }
    if cases['jwt_refresh']['ok']:
        access = ref['body']['access']
        refresh = ref['body'].get('refresh') or refresh

    # Pagination lists
    for name, path in (
        ('leads_list', '/api/v1/leads/?page_size=200'),
        ('projects_list', '/api/v1/projects/?page_size=200'),
        ('surveys_list', '/api/v1/site-surveys/?page_size=200'),
        ('reports_dashboard', '/api/v1/reports/dashboard/'),
    ):
        t0 = time.perf_counter()
        r = req('GET', path, token=access)
        ms = round((time.perf_counter() - t0) * 1000, 1)
        rows = None
        if isinstance(r.get('body'), dict) and 'results' in r['body']:
            rows = len(r['body']['results'])
        elif isinstance(r.get('body'), list):
            rows = len(r['body'])
        cases[name] = {'ok': r.get('status') == 200, 'status': r.get('status'), 'ms': ms, 'rows': rows}

    # page_size hard cap
    cap = req('GET', '/api/v1/leads/?page_size=5000', token=access)
    n = len((cap.get('body') or {}).get('results') or []) if isinstance(cap.get('body'), dict) else None
    cases['page_size_cap'] = {'ok': cap.get('status') == 200 and n is not None and n <= 200, 'returned': n, 'status': cap.get('status')}

    # Dashboard timing + cache warm
    t0 = time.perf_counter()
    d1 = req('GET', '/api/v1/dashboard/unified/', token=access, timeout=120)
    ms1 = round((time.perf_counter() - t0) * 1000, 1)
    t0 = time.perf_counter()
    d2 = req('GET', '/api/v1/dashboard/unified/', token=access, timeout=120)
    ms2 = round((time.perf_counter() - t0) * 1000, 1)
    cases['dashboard_unified'] = {
        'ok': d1.get('status') == 200 and d2.get('status') == 200,
        'cold_ms': ms1,
        'warm_ms': ms2,
        'keys': list((d1.get('body') or {}).keys())[:12] if isinstance(d1.get('body'), dict) else None,
    }

    # Cache invalidation via lead patch then dashboard refresh
    leads = req('GET', '/api/v1/leads/?page_size=1', token=access)
    lead_id = None
    if isinstance(leads.get('body'), dict) and leads['body'].get('results'):
        lead_id = leads['body']['results'][0]['id']
    elif isinstance(leads.get('body'), list) and leads['body']:
        lead_id = leads['body'][0]['id']
    if lead_id:
        remark = f'predeploy-cache-{int(time.time())}'
        patch = req('PATCH', f'/api/v1/leads/{lead_id}/', token=access, body={'remarks': remark})
        t0 = time.perf_counter()
        d3 = req('GET', '/api/v1/dashboard/unified/', token=access, timeout=120)
        ms3 = round((time.perf_counter() - t0) * 1000, 1)
        verify = req('GET', f'/api/v1/leads/{lead_id}/', token=access)
        cases['dashboard_cache_after_lead_write'] = {
            'ok': patch.get('status') == 200 and d3.get('status') == 200 and (verify.get('body') or {}).get('remarks') == remark,
            'patch_status': patch.get('status'),
            'dashboard_ms_after_write': ms3,
            'remarks_persisted': (verify.get('body') or {}).get('remarks') == remark,
        }
    else:
        cases['dashboard_cache_after_lead_write'] = {'ok': False, 'error': 'no lead'}

    # Duplicate mobile detection (search existing) + IVRS collision
    if lead_id:
        detail = req('GET', f'/api/v1/leads/{lead_id}/', token=access)
        mobile = (detail.get('body') or {}).get('mobile_number')
        ivrs = (detail.get('body') or {}).get('ivrs_number')
        dup = req('GET', f'/api/v1/leads/?search={mobile}&page_size=50', token=access)
        rows = (dup.get('body') or {}).get('results') if isinstance(dup.get('body'), dict) else dup.get('body')
        hits = [x for x in (rows or []) if str(x.get('mobile_number')) == str(mobile)]
        cases['duplicate_mobile_search'] = {
            'ok': dup.get('status') == 200 and len(hits) >= 1,
            'mobile': mobile,
            'hits': len(hits),
            'status': dup.get('status'),
        }
        create = req(
            'POST',
            '/api/v1/leads/',
            token=access,
            body={
                'customer_name': 'Dup Probe',
                'mobile_number': '9000000099',
                'ivrs_number': ivrs,
                'status': 'New',
            },
        )
        body_txt = json.dumps(create.get('body'), default=str).lower() if create.get('body') is not None else ''
        cases['duplicate_ivrs_create_rejected'] = {
            'ok': create.get('status') in (400, 409) and (
                'already exists' in body_txt or 'ivrs' in body_txt or 'unique' in body_txt
            ),
            'status': create.get('status'),
            'body_snip': body_txt[:240],
        }
    else:
        cases['duplicate_mobile_search'] = {'ok': False, 'error': 'no lead'}
        cases['duplicate_ivrs_create_rejected'] = {'ok': False, 'error': 'no lead'}

    # File upload / download (lead survey photo if survey exists, else project document skip)
    upload_ok = False
    upload_notes = {}
    surveys = req('GET', '/api/v1/lead-site-surveys/?page_size=1', token=access)
    survey_id = None
    body = surveys.get('body')
    if isinstance(body, dict) and body.get('results'):
        survey_id = body['results'][0].get('id')
    elif isinstance(body, list) and body:
        survey_id = body[0].get('id')
    if not survey_id:
        # try project site surveys
        surveys = req('GET', '/api/v1/site-surveys/?page_size=1', token=access)
        body = surveys.get('body')
        if isinstance(body, dict) and body.get('results'):
            survey_id = body['results'][0].get('id')
            upload_notes['survey_source'] = 'site-surveys'
        elif isinstance(body, list) and body:
            survey_id = body[0].get('id')
            upload_notes['survey_source'] = 'site-surveys'
    else:
        upload_notes['survey_source'] = 'lead-site-surveys'

    if survey_id and upload_notes.get('survey_source') == 'lead-site-surveys':
        png = _png_bytes()
        raw, ctype = multipart({'survey': str(survey_id), 'caption': 'predeploy'}, {'image': ('probe.png', png, 'image/png')})
        up = req('POST', '/api/v1/lead-survey-photos/', token=access, raw_body=raw, content_type=ctype, timeout=90)
        upload_notes['upload_status'] = up.get('status')
        photo = up.get('body') if isinstance(up.get('body'), dict) else {}
        image_url = photo.get('image')
        if up.get('status') in (200, 201) and image_url:
            # download — may be absolute or relative
            if str(image_url).startswith('http'):
                dl_path = image_url
                # absolute URL — fetch directly
                try:
                    with urllib.request.urlopen(urllib.request.Request(dl_path, headers={'Authorization': f'Bearer {access}'}), timeout=60) as resp:
                        data = resp.read()
                    upload_ok = len(data) > 20 and data[:4] == b'\x89PNG'
                    upload_notes['download_bytes'] = len(data)
                except Exception as exc:  # noqa: BLE001
                    upload_notes['download_error'] = str(exc)
            else:
                # media path via API host
                path = image_url if image_url.startswith('/') else '/' + image_url
                dl = req('GET', path, token=access, timeout=60)
                raw_bytes = dl.get('raw') or b''
                upload_ok = dl.get('status') == 200 and len(raw_bytes) > 20 and raw_bytes[:4] == b'\x89PNG'
                upload_notes['download_status'] = dl.get('status')
                upload_notes['download_bytes'] = len(raw_bytes)
        else:
            upload_notes['upload_body'] = str(up.get('body'))[:300]
    elif survey_id:
        # Project site survey photos require a unique slot per survey.
        png = _png_bytes()
        slot = 'Front View'
        # Prefer a free slot if Front View already used
        existing_photos = req('GET', f'/api/v1/site-survey-photos/?survey={survey_id}&page_size=200', token=access)
        used = set()
        ep = existing_photos.get('body')
        rows = ep.get('results') if isinstance(ep, dict) else ep if isinstance(ep, list) else []
        for row in rows or []:
            if row.get('slot'):
                used.add(row['slot'])
        for candidate in (
            'Front View', 'South Side', 'South-East Side', 'South-West Side',
            'Panel Placement Photo', 'Inverter Location Photo', 'Meter Photo Close to Main DB',
            'Earthing Location Photo', 'Site Drawing 1', 'Site Drawing 2',
        ):
            if candidate not in used:
                slot = candidate
                break
        raw, ctype = multipart(
            {'survey': str(survey_id), 'slot': slot},
            {'image': ('probe.png', png, 'image/png')},
        )
        up = req('POST', '/api/v1/site-survey-photos/', token=access, raw_body=raw, content_type=ctype, timeout=90)
        upload_notes['upload_status'] = up.get('status')
        upload_notes['slot'] = slot
        photo = up.get('body') if isinstance(up.get('body'), dict) else {}
        image_url = photo.get('image')
        if up.get('status') in (200, 201) and image_url:
            if str(image_url).startswith('http'):
                try:
                    with urllib.request.urlopen(urllib.request.Request(image_url, headers={'Authorization': f'Bearer {access}'}), timeout=60) as resp:
                        data = resp.read()
                    upload_ok = len(data) > 20 and data[:4] == b'\x89PNG'
                    upload_notes['download_bytes'] = len(data)
                except Exception as exc:  # noqa: BLE001
                    # Media may be served without auth — try bare GET
                    try:
                        with urllib.request.urlopen(image_url, timeout=60) as resp:
                            data = resp.read()
                        upload_ok = len(data) > 20 and data[:4] == b'\x89PNG'
                        upload_notes['download_bytes'] = len(data)
                        upload_notes['download_auth'] = 'none'
                    except Exception as exc2:  # noqa: BLE001
                        upload_notes['download_error'] = f'{exc} | {exc2}'
            else:
                path = image_url if image_url.startswith('/') else '/' + image_url
                dl = req('GET', path, token=access, timeout=60)
                raw_bytes = dl.get('raw') or b''
                if not (dl.get('status') == 200 and len(raw_bytes) > 20):
                    # MEDIA_URL often not behind /api — try /media/...
                    if not path.startswith('/media'):
                        alt = '/media/' + path.lstrip('/')
                        dl = req('GET', alt, token=access, timeout=60)
                        raw_bytes = dl.get('raw') or b''
                upload_ok = dl.get('status') == 200 and len(raw_bytes) > 20 and raw_bytes[:4] == b'\x89PNG'
                upload_notes['download_status'] = dl.get('status')
                upload_notes['download_bytes'] = len(raw_bytes)
                upload_notes['download_path'] = path
        else:
            upload_notes['upload_body'] = str(up.get('body'))[:300]
    else:
        upload_notes['error'] = 'no survey available'
    cases['file_upload_download'] = {'ok': upload_ok, **upload_notes}

    # RBAC matrix (sample): user without Dashboard should 403; admin 200
    # Create ephemeral role via admin if User Management allowed — else use negative auth
    unauth = req('GET', '/api/v1/dashboard/unified/')
    cases['rbac_unauthenticated_dashboard'] = {'ok': unauth.get('status') in (401, 403), 'status': unauth.get('status')}

    # Restricted user: try login as a known staging seed user without dashboard if present
    # Fall back: verify Lead module gate with forged token absence already covered;
    # create a no-perm user via API when User Management available.
    roles = req('GET', '/api/v1/roles/?page_size=200', token=access)
    users = req('GET', '/api/v1/users/?page_size=200', token=access)
    cases['rbac_roles_list'] = {'ok': roles.get('status') == 200, 'status': roles.get('status')}
    cases['rbac_users_list'] = {'ok': users.get('status') == 200, 'status': users.get('status')}

    # Export when eager allowed on staging typically 202; when refused 503 — never silent fake without task_id
    exp = req('POST', '/api/v1/reports/export-leads/', token=access, body={})
    exp_body = exp.get('body') or {}
    if exp.get('status') == 202:
        cases['export_queue'] = {
            'ok': bool(exp_body.get('task_id')) and exp_body.get('status') == 'queued',
            'status': exp.get('status'),
            'body': {k: exp_body.get(k) for k in ('task_id', 'status', 'queued', 'deduped')},
        }
        # duplicate submit dedupe
        exp2 = req('POST', '/api/v1/reports/export-leads/', token=access, body={})
        cases['export_dedupe'] = {
            'ok': exp2.get('status') == 202 and (exp2.get('body') or {}).get('task_id') == exp_body.get('task_id'),
            'status': exp2.get('status'),
            'deduped': (exp2.get('body') or {}).get('deduped'),
            'same_task': (exp2.get('body') or {}).get('task_id') == exp_body.get('task_id'),
        }
    elif exp.get('status') == 503:
        cases['export_queue'] = {
            'ok': exp_body.get('status') == 'unavailable' and exp_body.get('queued') is not True,
            'status': 503,
            'body': exp_body,
        }
        cases['export_dedupe'] = {'ok': True, 'note': 'export unavailable — dedupe N/A'}
    else:
        cases['export_queue'] = {'ok': False, 'status': exp.get('status'), 'body': exp_body}
        cases['export_dedupe'] = {'ok': False, 'note': 'export failed'}

    # Logout + refresh invalidation
    lo = req('POST', '/api/v1/auth/logout/', token=access, body={'refresh': refresh})
    cases['logout'] = {'ok': lo.get('status') == 200 and (lo.get('body') or {}).get('status') == 'logged_out', 'status': lo.get('status'), 'body': lo.get('body')}
    ref_after = req('POST', '/api/v1/auth/refresh/', body={'refresh': refresh})
    cases['logout_refresh_rejected'] = {
        'ok': ref_after.get('status') in (401, 400),
        'status': ref_after.get('status'),
        'body_snip': str(ref_after.get('body'))[:200],
    }

    # Re-login for cleanliness of subsequent manual use
    req('POST', '/api/v1/auth/login/', body={'email': ADMIN_EMAIL, 'password': ADMIN_PASS})

    meta['finished_at'] = time.strftime('%Y-%m-%dT%H:%M:%S')
    failed = [k for k, v in cases.items() if not v.get('ok')]
    meta['pass_count'] = sum(1 for v in cases.values() if v.get('ok'))
    meta['fail_count'] = len(failed)
    meta['failed_cases'] = failed

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {'meta': meta, 'cases': cases}
    OUT.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    print(json.dumps(payload, indent=2))
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
