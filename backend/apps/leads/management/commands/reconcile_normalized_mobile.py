from django.core.management.base import BaseCommand
from django.db import transaction

from apps.leads.models import Lead


class Command(BaseCommand):
    help = 'Recompute Lead.normalized_mobile from mobile_number for all rows.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        updated = 0
        checked = 0
        qs = Lead.objects.all().only('id', 'mobile_number', 'normalized_mobile').iterator(chunk_size=500)
        for lead in qs:
            checked += 1
            digits = ''.join(ch for ch in str(lead.mobile_number or '') if ch.isdigit())
            normalized = digits[-10:] if len(digits) >= 10 else digits
            if lead.normalized_mobile == normalized:
                continue
            updated += 1
            if options['dry_run']:
                continue
            with transaction.atomic():
                Lead.objects.filter(pk=lead.pk).update(normalized_mobile=normalized)
        self.stdout.write(self.style.SUCCESS(f'checked={checked} updated={updated} dry_run={options["dry_run"]}'))
