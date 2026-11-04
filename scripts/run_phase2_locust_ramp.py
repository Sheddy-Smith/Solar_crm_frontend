"""Phase-2 Locust ramp against LOCAL staging only. Never production."""
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
OUT = ROOT / 'scripts' / 'staging_locust_results'
HOST = os.environ.get('STAGING_HOST', 'http://127.0.0.1:8050')
SECONDS = os.environ.get('LOCUST_RUN_SECONDS', '40')
LEVELS = [20, 40, 60, 100, 200, 300, 500, 750, 1000]


def parse_stats(prefix: Path) -> dict:
    stats = Path(str(prefix) + '_stats.csv')
    row = {'users': None}
    if not stats.exists():
        return row
    with stats.open(newline='', encoding='utf-8') as fh:
        agg = None
        for r in csv.DictReader(fh):
            if r.get('Name') == 'Aggregated':
                agg = r
    if not agg:
        return row
    req = int(float(agg.get('Request Count') or 0))
    fail = int(float(agg.get('Failure Count') or 0))
    p95 = float(agg.get('95%') or 0)
    # Locust CSV may lack p50/p99; approximate from available percentiles when present.
    p50 = float(agg.get('50%') or agg.get('Median Response Time') or 0)
    p99 = float(agg.get('99%') or 0)
    row.update(
        requests=req,
        failures=fail,
        error_rate_pct=round(100 * fail / req, 2) if req else 100.0,
        avg_ms=float(agg.get('Average Response Time') or 0),
        p50_ms=p50,
        p95_ms=p95,
        p99_ms=p99,
        rps=float(agg.get('Requests/s') or 0),
    )
    row['broken'] = row['error_rate_pct'] >= 5 or row['p95_ms'] >= 3000
    return row


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    first_break = None
    for u in LEVELS:
        prefix = OUT / f'phase2_{u}'
        for p in OUT.glob(f'phase2_{u}_*'):
            p.unlink()
        ramp = max(5, u // 4)
        cmd = [
            PY, '-m', 'locust', '-f', LOCUST,
            '--headless', '-u', str(u), '-r', str(ramp),
            '-t', f'{SECONDS}s', '--host', HOST,
            '--csv', str(prefix), '--only-summary',
        ]
        print(f'RUN users={u} ramp={ramp}/s duration={SECONDS}s', flush=True)
        proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
        row = parse_stats(prefix)
        row['users'] = u
        row['exit'] = proc.returncode
        if row.get('broken') and first_break is None:
            first_break = u
        print(json.dumps(row), flush=True)
        rows.append(row)
        # Stop escalating once connection collapse (>50% errors) — still record remaining as skipped.
        if row.get('error_rate_pct', 0) >= 50:
            for rest in LEVELS[LEVELS.index(u) + 1:]:
                rows.append({
                    'users': rest,
                    'exit': None,
                    'skipped': True,
                    'reason': f'skipped after collapse at {u}',
                    'broken': True,
                })
            break
        time.sleep(2)

    summary = {
        'host': HOST,
        'run_seconds_per_level': int(SECONDS),
        'stack': 'local staging (SQLite or MySQL) + Memurai/Redis — NOT production',
        'first_break_users': first_break,
        'levels': rows,
        'capacity_claim_rule': 'Never claim 500+ without MySQL+Redis staging sustaining error_rate<5% and p95<3000ms',
    }
    out = OUT / 'phase2_ramp_summary.json'
    out.write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print('WROTE', out, flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
