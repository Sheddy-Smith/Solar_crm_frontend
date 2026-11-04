"""Phase 3 failure drills against local MySQL:3307 + Memurai + staging API :8060.

Never production. Prefer non-destructive Redis drill via dead-port process check
plus controlled Memurai stop if permitted; MySQL drill stops only the *staging*
mysqld (port 3307), never MySQL80 service.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

HOST = os.environ.get('PHASE3_HOST', 'http://127.0.0.1:8060').rstrip('/')
OUT = Path(__file__).resolve().parents[1] / 'scripts' / 'phase3_results' / 'failure_drills.json'
MYSQLD = r'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe'
MYSQL_INI = str(Path(__file__).resolve().parents[1] / '.staging-mysql' / 'my.ini')
RESULTS: dict = {'host': HOST, 'cases': {}}


def http(path: str, timeout: float = 8):
    url = f'{HOST}{path}'
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return {'ok': True, 'status': resp.status, 'body': resp.read().decode('utf-8', 'replace')[:500]}
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace') if e.fp else ''
        return {'ok': False, 'status': e.code, 'body': body[:500]}
    except Exception as exc:  # noqa: BLE001
        return {'ok': False, 'status': None, 'error': str(exc)}


def find_staging_mysqld_pid() -> int | None:
    try:
        import psutil
    except ImportError:
        return None
    for p in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if (p.info.get('name') or '').lower() != 'mysqld.exe':
                continue
            cmd = ' '.join(p.info.get('cmdline') or [])
            if '3307' in cmd or '.staging-mysql' in cmd.replace('\\', '/'):
                return p.info['pid']
        except Exception:
            continue
    return None


def main() -> int:
    RESULTS['cases']['baseline_health'] = http('/api/v1/health/')
    RESULTS['cases']['baseline_ready'] = http('/api/v1/ready/')

    # --- Redis soft-fail (isolated settings already proven); live Memurai stop ---
    redis_case = {'attempted_service_stop': False}
    try:
        # Prefer sc stop; may fail without elevation
        stop = subprocess.run(['powershell', '-Command', 'Stop-Service Memurai -Force'], capture_output=True, text=True)
        redis_case['attempted_service_stop'] = True
        redis_case['stop_rc'] = stop.returncode
        redis_case['stop_err'] = (stop.stderr or stop.stdout or '')[:300]
        time.sleep(2)
        redis_case['during_health'] = http('/api/v1/health/')
        redis_case['during_ready'] = http('/api/v1/ready/')
        subprocess.run(['powershell', '-Command', 'Start-Service Memurai'], capture_output=True, text=True)
        time.sleep(2)
        redis_case['after_ready'] = http('/api/v1/ready/')
    except Exception as exc:  # noqa: BLE001
        redis_case['error'] = str(exc)
        subprocess.run(['powershell', '-Command', 'Start-Service Memurai'], capture_output=True)
    RESULTS['cases']['redis_stop_start'] = redis_case

    # --- Staging MySQL interrupt (port 3307 only) ---
    mysql_case = {}
    pid = find_staging_mysqld_pid()
    mysql_case['staging_pid_before'] = pid
    if pid:
        subprocess.run(['taskkill', '/PID', str(pid), '/F'], capture_output=True, text=True)
        time.sleep(2)
        mysql_case['during_health'] = http('/api/v1/health/')
        mysql_case['during_ready'] = http('/api/v1/ready/')
        # Restart staging mysqld
        subprocess.Popen([MYSQLD, f'--defaults-file={MYSQL_INI}'], cwd=str(Path(MYSQL_INI).parent))
        recovered = False
        for _ in range(40):
            time.sleep(1)
            r = http('/api/v1/ready/')
            if r.get('ok') and 'database": "ok"' in (r.get('body') or '').replace(' ', ''):
                # body has spaces: "database": "ok"
                pass
            if r.get('ok') and '"database": "ok"' in (r.get('body') or ''):
                recovered = True
                mysql_case['after_ready'] = r
                break
            mysql_case['after_ready'] = r
        mysql_case['recovered'] = recovered
        # Integrity: trivial SELECT via ready already; also hit health
        mysql_case['after_health'] = http('/api/v1/health/')
    else:
        mysql_case['skipped'] = 'staging mysqld pid not found'
    RESULTS['cases']['mysql_interrupt_recovery'] = mysql_case

    # --- SMTP circuit (in-process) ---
    from malwa_solar.circuit_breaker import CircuitBreaker
    br = CircuitBreaker('smtp-phase3', failure_threshold=3, recovery_timeout=0.05)
    for _ in range(3):
        try:
            br.call(lambda: (_ for _ in ()).throw(TimeoutError('smtp-blackhole')))
        except TimeoutError:
            pass
    opened = not br.allow()
    time.sleep(0.06)
    recovered = br.call(lambda: 'ok') == 'ok'
    RESULTS['cases']['smtp_circuit'] = {'opened': opened, 'recovered': recovered}

    # --- Worker termination note (single Waitress process) ---
    RESULTS['cases']['gunicorn_worker_kill'] = {
        'status': 'deferred_to_manual_or_linux',
        'note': 'Native Windows cannot run Gunicorn (fcntl). Waitress is single-process multi-thread; '
                'killing it ends the API. Linux staging should kill one gunicorn worker PID and confirm siblings serve.',
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(RESULTS, indent=2), encoding='utf-8')
    print(json.dumps(RESULTS, indent=2))
    print('WROTE', OUT)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
