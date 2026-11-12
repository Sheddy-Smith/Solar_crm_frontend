"""Probe concurrent BOM activation against the live configured MySQL database.

Does not require CREATE DATABASE privilege (unlike Django's test runner).
Creates throwaway BOM versions under capacity 5.00, activates concurrently,
asserts exactly one Active, then restores prior Active state.
"""
from __future__ import annotations

import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.development')
django.setup()

from django.db import connection  # noqa: E402
from apps.projects.bom_models import BomCapacityConfig, BomLine, BomVersion  # noqa: E402
from apps.projects.bom_services import activate_bom_version, ensure_default_capacity_shells  # noqa: E402


def main() -> int:
    if connection.vendor != 'mysql':
        print({'ok': False, 'detail': f'Expected mysql, got {connection.vendor}'})
        return 2

    ensure_default_capacity_shells()
    cfg = BomCapacityConfig.objects.get(capacity_kw=Decimal('5.00'))
    prior_active_ids = list(
        BomVersion.objects.filter(capacity_config=cfg, status=BomVersion.STATUS_ACTIVE)
        .values_list('id', flat=True)
    )
    BomVersion.objects.filter(capacity_config=cfg, status=BomVersion.STATUS_ACTIVE).update(
        status=BomVersion.STATUS_INACTIVE,
    )

    probe_ids = []
    try:
        base = (BomVersion.objects.filter(capacity_config=cfg).order_by('-version_number').first())
        start = (base.version_number if base else 0) + 9000
        for i in range(2):
            ver = BomVersion.objects.create(
                capacity_config=cfg,
                version_number=start + i,
                status=BomVersion.STATUS_DRAFT,
                pending_configuration=False,
                final_project_price=Decimal('100000'),
            )
            BomLine.objects.create(
                version=ver, category='Panel', material_name=f'MySQLProbe{i}',
                unit='Nos', quantity=Decimal('1'), unit_price=Decimal('10'), sort_order=0,
            )
            probe_ids.append(ver.id)

        errors = []

        def _activate(version_id):
            connection.close()
            try:
                activate_bom_version(BomVersion.objects.get(pk=version_id))
            except Exception as exc:  # noqa: BLE001
                errors.append(str(exc))
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futs = [pool.submit(_activate, vid) for vid in probe_ids]
            for fut in as_completed(futs):
                fut.result()

        active = list(
            BomVersion.objects.filter(capacity_config=cfg, status=BomVersion.STATUS_ACTIVE)
            .values_list('id', flat=True)
        )
        ok = len(errors) == 0 and len(active) == 1
        print({
            'ok': ok,
            'vendor': connection.vendor,
            'errors': errors,
            'active': active,
            'probe_ids': probe_ids,
        })
        return 0 if ok else 1
    finally:
        BomLine.objects.filter(version_id__in=probe_ids).delete()
        BomVersion.objects.filter(id__in=probe_ids).delete()
        if prior_active_ids:
            BomVersion.objects.filter(id__in=prior_active_ids).update(status=BomVersion.STATUS_ACTIVE)


if __name__ == '__main__':
    sys.exit(main())
