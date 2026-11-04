"""Headless Locust ramp 20→500 against local staging. Never production."""
from __future__ import annotations

import csv
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = ROOT / '.venv' / 'Scripts' / 'python.exe'
LOCUSTFILE = ROOT / 'scripts' / 'locustfile_staging.py'
OUT_DIR = ROOT / 'scripts' / 'staging_locust_results'
HOST = 'http://127.0.0.1:8050'
LEVELS = [20, 40, 60, 80, 100, 200, 300, 500]
RUN_SECONDS = int(__import__('os').environ.get('LOCUST_RUN_SECONDS', '45'))


def run_level(users: int) -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    prefix = OUT_DIR / f'level_{users}'
    # Remove prior csv fragments
    for p in OUT_DIR.glob(f'level_{users}_*'):
        p.unlink()

    cmd = [
        str(PY), '-m', 'locust',
        '-f', str(LOCUSTFILE),
        '--headless',
        '-u', str(users),
        '-r', str(max(5, users // 4)),
        '-t', f'{RUN_SECONDS}s',
        '--host', HOST,
        '--csv', str(prefix),
        '--only-summary',
    ]
    print('RUN', ' '.join(cmd), flush=True)
    proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
    print(proc.stdout[-2000:] if proc.stdout else '', flush=True)
    if proc.stderr:
        print(proc.stderr[-1500:], flush=True)

    stats_path = Path(str(prefix) + '_stats.csv')
    row = {
        'users': users,
        'exit_code': proc.returncode,
        'requests': 0,
        'failures': 0,
        'error_rate_pct': 100.0,
        'avg_ms': None,
        'p95_ms': None,
        'rps': None,
        'broken': True,
    }
    if stats_path.exists():
        with stats_path.open(newline='', encoding='utf-8') as fh:
            reader = csv.DictReader(fh)
            aggregated = None
            for r in reader:
                if r.get('Name') == 'Aggregated':
                    aggregated = r
            if aggregated:
                req = int(float(aggregated.get('Request Count') or 0))
                fail = int(float(aggregated.get('Failure Count') or 0))
                row.update({
                    'requests': req,
                    'failures': fail,
                    'error_rate_pct': round(100.0 * fail / req, 2) if req else 100.0,
                    'avg_ms': float(aggregated.get('Average Response Time') or 0),
                    'p95_ms': float(aggregated.get('95%') or 0),
                    'rps': float(aggregated.get('Requests/s') or 0),
                })
                row['broken'] = row['error_rate_pct'] >= 5 or (row['p95_ms'] or 0) >= 3000
    return row


def main() -> int:
    results = []
    first_break = None
    for users in LEVELS:
        row = run_level(users)
        results.append(row)
        print('LEVEL', json.dumps(row), flush=True)
        if row['broken'] and first_break is None:
            first_break = users
        # Stop shortly after first hard break to save time, but always try one more.
        if first_break and users >= first_break and users != first_break:
            # continue through 500 if already past; if break early still run next one then stop
            if users >= min(first_break * 2, 500) or users == 500:
                if users >= 300:
                    break
        time.sleep(2)

    summary = {
        'host': HOST,
        'run_seconds_per_level': RUN_SECONDS,
        'first_break_users': first_break,
        'levels': results,
        'note': 'LOCAL staging Locust ramp only',
    }
    out = OUT_DIR / 'ramp_summary.json'
    out.write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print('WROTE', out, 'first_break', first_break, flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
