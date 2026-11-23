#!/usr/bin/env python
"""Run one Malwa CRM microservice slice.

Usage (from repo root):
  python services/run_service.py auth
  python services/run_service.py leads --port 8004
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'backend'))
sys.path.insert(0, str(ROOT / 'services' / 'shared'))


def main() -> None:
    from malwa_shared.service_registry import SERVICES
    from services.service_factory import write_slice_urlmodules

    parser = argparse.ArgumentParser(description='Run a Malwa CRM microservice slice')
    parser.add_argument('service', choices=sorted(SERVICES.keys()))
    parser.add_argument('--port', type=int, default=None)
    parser.add_argument('--addr', default='127.0.0.1')
    args = parser.parse_args()

    write_slice_urlmodules()
    port = args.port or SERVICES[args.service]['port']
    os.environ['MALWA_SERVICE_NAME'] = args.service
    os.environ['MALWA_SERVICE_PORT'] = str(port)
    os.environ['DJANGO_SETTINGS_MODULE'] = 'services.django_settings'
    os.environ.setdefault('SECRET_KEY', 'dev-microservices-scaffold-key')

    from django.core.management import execute_from_command_line
    execute_from_command_line(['manage.py', 'runserver', f'{args.addr}:{port}', '--noreload'])


if __name__ == '__main__':
    main()
