"""Phase 3 staging API: MySQL (isolated :3307) + Memurai Redis + Waitress.

Gunicorn cannot import on native Windows (no fcntl). This process mirrors
production worker concurrency via Waitress threads and uses real MySQL/Redis.
Linux Gunicorn entrypoint: scripts/start_phase3_gunicorn.sh

Never points at Hostinger / production.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'backend'
PY = str(ROOT / '.venv' / 'Scripts' / 'python.exe')
HOST = '127.0.0.1'
PORT = int(os.environ.get('PHASE3_PORT', '8060'))

STAGING_DATABASE_URL = os.environ.get(
    'STAGING_DATABASE_URL',
    'mysql://malwa_staging:StagingLocal_Only_123@127.0.0.1:3307/malwa_crm_staging',
)
REDIS_URL = os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/5')
THREADS = os.environ.get('PHASE3_THREADS', '8')  # mirrors ~ WEB_CONCURRENCY*GUNICORN_THREADS for 1vCPU


def env() -> dict:
    e = os.environ.copy()
    e.update({
        'DJANGO_SETTINGS_MODULE': 'malwa_solar.settings.staging_mysql',
        'STAGING_DATABASE_URL': STAGING_DATABASE_URL,
        'REDIS_URL': REDIS_URL,
        'SECRET_KEY': 'phase3-staging-local-only-not-for-production-32b',
        'ALLOWED_HOSTS': '*',
        'PYTHONPATH': str(BACKEND),
        'DASHBOARD_CACHE_TTL': os.environ.get('DASHBOARD_CACHE_TTL', '60'),
        'DB_CONN_MAX_AGE': os.environ.get('DB_CONN_MAX_AGE', '60'),
        'CELERY_TASK_ALWAYS_EAGER': os.environ.get('CELERY_TASK_ALWAYS_EAGER', '1'),
        'READY_REQUIRE_REDIS': os.environ.get('READY_REQUIRE_REDIS', '0'),
    })
    # Never inherit production DATABASE_URL.
    e.pop('DATABASE_URL', None)
    return e


def wait_http(url: str, timeout_s: float = 90) -> None:
    deadline = time.time() + timeout_s
    last = ''
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                if resp.status == 200:
                    return
        except Exception as exc:  # noqa: BLE001
            last = str(exc)
            time.sleep(0.5)
    raise SystemExit(f'Timeout waiting for {url}: {last}')


def main() -> int:
    e = env()
    print('== migrate (staging MySQL only) ==', flush=True)
    subprocess.check_call([PY, 'manage.py', 'migrate', '--noinput'], cwd=str(BACKEND), env=e)

    print('== seed anonymized ==', flush=True)
    subprocess.check_call(
        [PY, 'manage.py', 'seed_staging_anonymized', '--users', '80', '--leads', '500'],
        cwd=str(BACKEND),
        env=e,
    )

    print(f'== waitress {HOST}:{PORT} threads={THREADS} ==', flush=True)
    proc = subprocess.Popen(
        [
            PY, '-m', 'waitress',
            f'--listen={HOST}:{PORT}',
            f'--threads={THREADS}',
            '--channel-timeout=60',
            '--backlog=2048',
            'malwa_solar.wsgi:application',
        ],
        cwd=str(BACKEND),
        env=e,
    )
    try:
        wait_http(f'http://{HOST}:{PORT}/api/v1/health/')
        print(f'PHASE3 API READY http://{HOST}:{PORT}/api/v1/ pid={proc.pid}', flush=True)
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
    return proc.returncode or 0


if __name__ == '__main__':
    raise SystemExit(main())
