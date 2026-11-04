"""Phase 3 Locust ramp against MySQL staging. Sustained windows. Never production."""
from __future__ import annotations

import csv
import json
import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = str(ROOT / '.venv' / 'Scripts' / 'python.exe')
LOCUST = str(ROOT / 'scripts' / 'locustfile_staging.py')
OUT = ROOT / 'scripts' / 'phase3_results'
HOST = os.environ.get('PHASE3_HOST', 'http://127.0.0.1:8060')
# Sustained: default 90s per level (override via env)
SECONDS = os.environ.get('PHASE3_LOCUST_SECONDS', '90')
LEVELS = [20, 40, 60, 100, 200, 300, 500]
# Proceed to these only if prior levels meet SLO
EXTENDED = [750, 1000]
# Phase 3 SLOs for normal API
P95_SLO_MS = float(os.environ.get('PHASE3_P95_SLO_MS', '2000'))
P99_SLO_MS = float(os.environ.get('PHASE3_P99_SLO_MS', '5000'))
ERR_SLO_PCT = float(os.environ.get('PHASE3_ERR_SLO_PCT', '1.0'))  # 5xx-like / total fails


def parse_stats(prefix: Path) -> dict:
    stats = Path(str(prefix) + '_stats.csv')
    fails = Path(str(prefix) + '_failures.csv')
    row: dict = {}
    if stats.exists():
        with stats.open(newline='', encoding='utf-8') as fh:
            for r in csv.DictReader(fh):
                if r.get('Name') == 'Aggregated':
                    req = int(float(r.get('Request Count') or 0))
                    fail = int(float(r.get('Failure Count') or 0))
                    row.update(
                        requests=req,
                        failures=fail,
                        error_rate_pct=round(100 * fail / req, 2) if req else 100.0,
                        avg_ms=float(r.get('Average Response Time') or 0),
                        p50_ms=float(r.get('50%') or r.get('Median Response Time') or 0),
                        p95_ms=float(r.get('95%') or 0),
                        p99_ms=float(r.get('99%') or 0),
                        rps=float(r.get('Requests/s') or 0),
                    )
    # Classify failures
    classes = {'connection': 0, 'timeout': 0, '429': 0, '5xx': 0, 'other': 0}
    if fails.exists():
        with fails.open(newline='', encoding='utf-8') as fh:
            for r in csv.DictReader(fh):
                err = r.get('Error') or ''
                n = int(float(r.get('Occurrences') or 1))
                if '429' in err:
                    classes['429'] += n
                elif any(x in err for x in ('500', '502', '503', '504')):
                    classes['5xx'] += n
                elif 'timeout' in err.lower() or 'Timeout' in err:
                    classes['timeout'] += n
                elif 'ConnectionRefused' in err or '10061' in err:
                    classes['connection'] += n
                else:
                    classes['other'] += n
    row['failure_classes'] = classes
    # SLO: p95/p99 for successful-ish traffic; error rate includes connection fails
    row['slo_fail'] = (
        row.get('error_rate_pct', 100) >= ERR_SLO_PCT
        or row.get('p95_ms', 99999) > P95_SLO_MS
        or row.get('p99_ms', 99999) > P99_SLO_MS
    )
    return row


def run_level(u: int) -> dict:
    prefix = OUT / f'p3_{u}'
    for p in OUT.glob(f'p3_{u}_*'):
        p.unlink()
    ramp = max(5, u // 5)
    cmd = [
        PY, '-m', 'locust', '-f', LOCUST,
        '--headless', '-u', str(u), '-r', str(ramp),
        '-t', f'{SECONDS}s', '--host', HOST,
        '--csv', str(prefix), '--only-summary',
    ]
    print(f'RUN users={u} ramp={ramp}/s t={SECONDS}s', flush=True)
    env = os.environ.copy()
    env['STAGING_HOST'] = HOST
    env['STAGING_TOKENS_FILE'] = str(OUT / 'minted_tokens.json')
    proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, env=env)
    row = parse_stats(prefix)
    row['users'] = u
    row['exit'] = proc.returncode
    print(json.dumps({k: row[k] for k in row if k != 'failure_classes'}), flush=True)
    return row


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    all_pass = True
    for u in LEVELS:
        row = run_level(u)
        rows.append(row)
        if row.get('slo_fail'):
            all_pass = False
        # Stop ramp early on hard collapse
        if row.get('error_rate_pct', 0) >= 50:
            print('COLLAPSE — skipping remaining base levels', flush=True)
            for rest in LEVELS[LEVELS.index(u) + 1:]:
                rows.append({'users': rest, 'skipped': True, 'reason': f'collapse at {u}'})
            break
        time.sleep(3)

    extended_ran = False
    if all_pass and not any(r.get('skipped') for r in rows):
        extended_ran = True
        for u in EXTENDED:
            row = run_level(u)
            rows.append(row)
            if row.get('error_rate_pct', 0) >= 50:
                break
            time.sleep(3)
    else:
        for u in EXTENDED:
            rows.append({
                'users': u,
                'skipped': True,
                'reason': 'base levels did not meet Phase 3 SLO',
            })

    sustainable = None
    for r in rows:
        if r.get('skipped'):
            continue
        if not r.get('slo_fail'):
            sustainable = r['users']
        else:
            break

    summary = {
        'host': HOST,
        'seconds_per_level': int(SECONDS),
        'slo': {'p95_ms': P95_SLO_MS, 'p99_ms': P99_SLO_MS, 'error_pct_max': ERR_SLO_PCT},
        'stack': 'MySQL:3307 malwa_crm_staging + Memurai Redis db5 + Waitress (Gunicorn blocked on Windows fcntl)',
        'extended_ran': extended_ran,
        'max_sustainable_meeting_slo': sustainable,
        'levels': rows,
        'capacity_claim_rule': 'Never claim 500+ without Gunicorn+MySQL+Redis meeting SLO sustainably',
    }
    path = OUT / 'phase3_ramp_summary.json'
    path.write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print('WROTE', path, flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
