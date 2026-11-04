"""Boot isolated staging API (Waitress) — local only, SQLite + Redis."""
from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'backend'
VENV_PY = ROOT / '.venv' / 'Scripts' / 'python.exe'
HOST = '127.0.0.1'
PORT = 8050
REDIS_URL = os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/1')


def env() -> dict:
    e = os.environ.copy()
    e.update({
        'DJANGO_SETTINGS_MODULE': 'malwa_solar.settings.staging_local',
        'REDIS_URL': REDIS_URL,
        'SECRET_KEY': 'staging-local-only-not-for-production-use-32b',
        'ALLOWED_HOSTS': '*',
        'PYTHONPATH': str(BACKEND),
    })
    # Ensure no accidental production DATABASE_URL leaks into staging.
    e.pop('DATABASE_URL', None)
    return e


def wait_http(url: str, timeout_s: float = 60) -> None:
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
    py = str(VENV_PY if VENV_PY.exists() else sys.executable)
    e = env()

    print('== migrate staging_local ==', flush=True)
    subprocess.check_call([py, 'manage.py', 'migrate', '--run-syncdb'], cwd=str(BACKEND), env=e)

    print('== seed anonymized data ==', flush=True)
    subprocess.check_call(
        [py, 'manage.py', 'seed_staging_anonymized', '--users', '80', '--leads', '500'],
        cwd=str(BACKEND),
        env=e,
    )

    print(f'== waitress {HOST}:{PORT} ==', flush=True)
    proc = subprocess.Popen(
        [
            py, '-m', 'waitress',
            f'--listen={HOST}:{PORT}',
            '--threads=16',
            '--channel-timeout=60',
            'malwa_solar.wsgi:application',
        ],
        cwd=str(BACKEND),
        env=e,
    )
    try:
        wait_http(f'http://{HOST}:{PORT}/api/v1/health/')
        print(f'STAGING API READY http://{HOST}:{PORT}/api/v1/  pid={proc.pid}', flush=True)
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
    return proc.returncode or 0


if __name__ == '__main__':
    raise SystemExit(main())
