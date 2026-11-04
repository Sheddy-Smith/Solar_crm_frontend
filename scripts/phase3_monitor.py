"""Sample CPU/RAM/Redis/MySQL while Phase 3 Locust runs. Local staging only."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'scripts' / 'phase3_results' / 'resource_timeseries.jsonl'
INTERVAL = float(os.environ.get('PHASE3_MONITOR_INTERVAL', '2'))
DURATION = float(os.environ.get('PHASE3_MONITOR_SECONDS', '600'))
MYSQL_PORT = int(os.environ.get('PHASE3_MYSQL_PORT', '3307'))
REDIS_DB = int(os.environ.get('PHASE3_REDIS_DB', '5'))
API_PID = os.environ.get('PHASE3_API_PID')


def sample():
    import psutil
    row = {
        'ts': time.time(),
        'cpu_pct': psutil.cpu_percent(interval=None),
        'ram_pct': psutil.virtual_memory().percent,
        'ram_used_mb': round(psutil.virtual_memory().used / (1024 * 1024), 1),
    }
    if API_PID:
        try:
            p = psutil.Process(int(API_PID))
            row['api_cpu_pct'] = p.cpu_percent(interval=None)
            row['api_rss_mb'] = round(p.memory_info().rss / (1024 * 1024), 1)
            row['api_threads'] = p.num_threads()
        except Exception as exc:  # noqa: BLE001
            row['api_err'] = str(exc)
    try:
        import redis
        r = redis.Redis(host='127.0.0.1', port=6379, db=REDIS_DB, socket_connect_timeout=1)
        info = r.info('memory')
        row['redis_used_mb'] = round(info.get('used_memory', 0) / (1024 * 1024), 2)
        row['redis_clients'] = r.info('clients').get('connected_clients')
        row['redis_ops'] = r.info('stats').get('instantaneous_ops_per_sec')
    except Exception as exc:  # noqa: BLE001
        row['redis_err'] = str(exc)
    try:
        import pymysql
        conn = pymysql.connect(
            host='127.0.0.1', port=MYSQL_PORT, user='malwa_staging',
            password='StagingLocal_Only_123', database='malwa_crm_staging',
            connect_timeout=2, read_timeout=3,
        )
        with conn.cursor() as cur:
            cur.execute("SHOW STATUS LIKE 'Threads_connected'")
            row['mysql_threads_connected'] = int(cur.fetchone()[1])
            cur.execute("SHOW STATUS LIKE 'Threads_running'")
            row['mysql_threads_running'] = int(cur.fetchone()[1])
            cur.execute("SHOW STATUS LIKE 'Slow_queries'")
            row['mysql_slow_queries'] = int(cur.fetchone()[1])
            cur.execute('SHOW PROCESSLIST')
            row['mysql_processlist_len'] = len(cur.fetchall())
        conn.close()
    except Exception as exc:  # noqa: BLE001
        row['mysql_err'] = str(exc)
    return row


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Prime cpu_percent
    try:
        import psutil
        psutil.cpu_percent(interval=0.1)
    except ImportError:
        print('psutil missing — pip install psutil')
        return 1
    end = time.time() + DURATION
    with OUT.open('a', encoding='utf-8') as fh:
        while time.time() < end:
            row = sample()
            fh.write(json.dumps(row) + '\n')
            fh.flush()
            time.sleep(INTERVAL)
    print('WROTE', OUT)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
