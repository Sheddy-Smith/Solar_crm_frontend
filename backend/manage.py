#!/usr/bin/env python
import os
import sys


def _quiet_runserver_reloader():
    """Ignore migration file churn so StatReloader does not bounce :8000 on every migration edit.

    Normal app code changes still hot-reload. This only skips `*/migrations/*.py`.
    """
    if 'runserver' not in sys.argv:
        return
    try:
        from django.utils.autoreload import StatReloader
    except Exception:
        return

    original = StatReloader.snapshot_files

    def snapshot_files(self):
        for path, mtime in original(self):
            path_str = str(path).replace('\\', '/')
            if '/migrations/' in path_str and path_str.endswith('.py'):
                continue
            yield path, mtime

    StatReloader.snapshot_files = snapshot_files


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.development')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Couldn't import Django. Are you sure it's installed?") from exc
    _quiet_runserver_reloader()
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
