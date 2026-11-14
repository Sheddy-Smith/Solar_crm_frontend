"""Seed / activate the reusable 3 kW Structure & Electrical BOM template.

Idempotent:
- Inventory products matched by normalized name (create missing names+category only, stock 0).
- Never creates duplicate InventoryItem for the same name.
- Creates a new Draft BomVersion only when Active lines differ OR --force-new.
- Activates the version (demotes previous Active for 3.00 kW).

Usage:
  python manage.py seed_3kw_structure_electrical_bom
  python manage.py seed_3kw_structure_electrical_bom --dry-run
  python manage.py seed_3kw_structure_electrical_bom --force-new
"""
from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.inventory.models import InventoryCategory, InventoryItem
from apps.inventory.services import next_item_code, seed_inventory_categories
from apps.projects.bom_3kw_template import (
    BOM_3KW_LINES,
    TEMPLATE_CAPACITY_KW,
    TEMPLATE_LABEL,
    TEMPLATE_NOTES,
    inventory_unit_price,
    norm_name,
)
from apps.projects.bom_models import BomCapacityConfig, BomLine, BomVersion
from apps.projects.bom_services import activate_bom_version, ensure_default_capacity_shells


class Command(BaseCommand):
    help = 'Seed and activate 3 KW – Structure & Electrical BOM from the physical Outward form.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Report only; no DB writes.')
        parser.add_argument(
            '--force-new',
            action='store_true',
            help='Always create a new Draft version even if Active already matches.',
        )
        parser.add_argument(
            '--skip-activate',
            action='store_true',
            help='Leave the new version as Draft (do not activate).',
        )

    def handle(self, *args, **options):
        dry = options['dry_run']
        force_new = options['force_new']
        skip_activate = options['skip_activate']

        if not dry:
            seed_inventory_categories()
            ensure_default_capacity_shells()

        report = self._match_inventory(dry=dry)
        self.stdout.write(self.style.NOTICE(
            f'BOM rows={len(BOM_3KW_LINES)} mapped={report["mapped"]} '
            f'created_products={report["created"]} reused={report["reused"]} '
            f'verify={len(report["needs_verification"])}'
        ))
        for note in report['needs_verification']:
            self.stdout.write(self.style.WARNING(f'  VERIFY: {note}'))
        for miss in report['missing_after']:
            self.stdout.write(self.style.ERROR(f'  UNMAPPED: {miss}'))

        if dry:
            self.stdout.write(self.style.SUCCESS('Dry-run complete — no BOM version written.'))
            return

        with transaction.atomic():
            cfg, _ = BomCapacityConfig.objects.get_or_create(
                capacity_kw=TEMPLATE_CAPACITY_KW,
                defaults={'label': '3 kW', 'is_active': True, 'sort_order': 0},
            )
            if cfg.label != '3 kW':
                cfg.label = '3 kW'
                cfg.save(update_fields=['label', 'updated_at'])

            active = (
                BomVersion.objects.filter(capacity_config=cfg, status=BomVersion.STATUS_ACTIVE)
                .prefetch_related('lines')
                .first()
            )
            if active and not force_new and self._lines_match(active, report['resolved_lines']):
                self.stdout.write(self.style.SUCCESS(
                    f'Active BOM already matches template (version_id={active.id}, lines={active.lines.count()}).'
                ))
                return

            next_no = (BomVersion.objects.filter(capacity_config=cfg).count() or 0) + 1
            version = BomVersion.objects.create(
                capacity_config=cfg,
                version_number=next_no,
                status=BomVersion.STATUS_DRAFT,
                effective_date=timezone.localdate(),
                labour_cost=Decimal('0'),
                other_charges=Decimal('0'),
                tax_percent=Decimal('0'),
                final_project_price=None,  # Project Quoted Amount comes from Lead.project_cost when set
                pending_configuration=False,
                notes=f'{TEMPLATE_LABEL}. {TEMPLATE_NOTES}',
            )
            for idx, row in enumerate(report['resolved_lines']):
                BomLine.objects.create(
                    version=version,
                    category=row['category'],
                    material_name=row['material_name'][:200],
                    sku=(row.get('sku') or '')[:64],
                    unit=row['unit'],
                    quantity=row['qty'],
                    unit_price=row['unit_price'],
                    sort_order=idx,
                    inventory_item=row['inventory_item'],
                )

            if skip_activate:
                self.stdout.write(self.style.WARNING(
                    f'Created Draft BOM version_id={version.id} lines={version.lines.count()} (not activated).'
                ))
                return

            activated = activate_bom_version(version)
            self.stdout.write(self.style.SUCCESS(
                f'Activated {TEMPLATE_LABEL} version_id={activated.id} '
                f'v{activated.version_number} lines={activated.lines.count()}'
            ))

    def _match_inventory(self, *, dry: bool) -> dict:
        existing = list(InventoryItem.objects.all())
        by_norm = {}
        for item in existing:
            by_norm.setdefault(norm_name(item.name), []).append(item)

        cats = set(InventoryCategory.objects.filter(is_active=True).values_list('name', flat=True))
        resolved = []
        created = 0
        reused = 0
        needs_verification = []
        missing_after = []

        for row in BOM_3KW_LINES:
            inv_name = row['inventory_name']
            category = row['category']
            unit = row['unit']
            key = norm_name(inv_name)
            matches = by_norm.get(key, [])
            item = None
            if matches:
                same = [m for m in matches if (m.category or '') == category]
                item = same[0] if same else matches[0]
                reused += 1
            elif not dry:
                if category not in cats:
                    InventoryCategory.objects.get_or_create(
                        name=category,
                        defaults={'description': f'Auto for {TEMPLATE_LABEL}', 'is_active': True},
                    )
                    cats.add(category)
                item = InventoryItem.objects.create(
                    name=inv_name,
                    category=category,
                    unit=unit,
                    rate=Decimal('0'),
                    selling_price=Decimal('0'),
                    current_stock=Decimal('0'),
                    minimum_stock=Decimal('0'),
                    is_active=True,
                    item_code=next_item_code(),
                )
                by_norm.setdefault(key, []).append(item)
                created += 1
            else:
                missing_after.append(inv_name)

            if row.get('needs_verification'):
                needs_verification.append(
                    f"{row['material_name']}: {row.get('verification_note') or 'manual check'}"
                )

            price = inventory_unit_price(item)
            resolved.append({
                **row,
                'inventory_item': item,
                'unit_price': price,
            })

        mapped = sum(1 for r in resolved if r['inventory_item'] is not None)
        return {
            'resolved_lines': resolved,
            'mapped': mapped,
            'created': created,
            'reused': reused,
            'needs_verification': needs_verification,
            'missing_after': missing_after,
        }

    def _lines_match(self, version: BomVersion, resolved_lines: list) -> bool:
        current = list(version.lines.order_by('sort_order', 'id').values_list(
            'material_name', 'quantity', 'unit', 'inventory_item_id',
        ))
        expected = [
            (
                r['material_name'][:200],
                r['qty'],
                r['unit'],
                getattr(r['inventory_item'], 'id', None),
            )
            for r in resolved_lines
        ]
        if len(current) != len(expected):
            return False
        for left, right in zip(current, expected):
            # Decimal compare for qty
            if left[0] != right[0] or left[2] != right[2] or left[3] != right[3]:
                return False
            if Decimal(left[1]) != Decimal(right[1]):
                return False
        return True
