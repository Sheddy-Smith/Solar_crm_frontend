import csv
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = str(ROOT / '.venv' / 'Scripts' / 'python.exe')
LOCUST = str(ROOT / 'scripts' / 'locustfile_staging.py')
OUT = ROOT / 'scripts' / 'staging_locust_results'
HOST = 'http://127.0.0.1:8050'
LEVELS = [60, 100, 200, 300, 500]
rows = []
for u in LEVELS:
    prefix = OUT / f'retest_{u}'
    for p in OUT.glob(f'retest_{u}_*'):
        p.unlink()
    cmd = [
        PY, '-m', 'locust', '-f', LOCUST, '--headless',
        '-u', str(u), '-r', str(max(10, u // 3)), '-t', '30s',
        '--host', HOST, '--csv', str(prefix), '--only-summary',
    ]
    print('RUN', u, flush=True)
    proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
    stats = Path(str(prefix) + '_stats.csv')
    row = {'users': u, 'exit': proc.returncode}
    if stats.exists():
        with stats.open(newline='', encoding='utf-8') as fh:
            agg = None
            for r in csv.DictReader(fh):
                if r.get('Name') == 'Aggregated':
                    agg = r
        if agg:
            req = int(float(agg.get('Request Count') or 0))
            fail = int(float(agg.get('Failure Count') or 0))
            row.update(
                requests=req,
                failures=fail,
                error_rate_pct=round(100 * fail / req, 2) if req else 100,
                avg_ms=float(agg.get('Average Response Time') or 0),
                p95_ms=float(agg.get('95%') or 0),
                rps=float(agg.get('Requests/s') or 0),
            )
            row['broken'] = row['error_rate_pct'] >= 5 or row['p95_ms'] >= 3000
    print(json.dumps(row), flush=True)
    rows.append(row)
    time.sleep(1)
(OUT / 'retest_summary.json').write_text(json.dumps({'levels': rows}, indent=2), encoding='utf-8')
print('DONE', flush=True)
