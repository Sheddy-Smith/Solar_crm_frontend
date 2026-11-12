"""Reconcile orphan Projects → Customer Master (exact name + optional create-from-name)."""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        'Link orphan Projects using high-confidence FKs and exact customer_name matches. '
        'Optionally create Customers for remaining unique names (provisional 7800xxxxxx phones).'
    )

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Report only; no writes.')
        parser.add_argument(
            '--no-create',
            action='store_true',
            help='Only link existing Customers; do not create new ones.',
        )

    def handle(self, *args, **options):
        from apps.accounts_module.project_reconciliation import apply_orphan_reconciliation

        report = apply_orphan_reconciliation(
            user=None,
            create_missing=not options['no_create'],
            dry_run=options['dry_run'],
        )
        self.stdout.write(self.style.SUCCESS(str({
            k: v for k, v in report.items() if k != 'actions'
        })))
        if options['dry_run']:
            self.stdout.write(self.style.WARNING(f"actions preview: {len(report.get('actions') or [])}"))
