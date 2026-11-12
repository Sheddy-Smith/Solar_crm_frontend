from django.core.management.base import BaseCommand, CommandError

from apps.leads.models import QuotationDownstreamSync
from apps.leads.quotation_sync import run_quotation_downstream_sync


class Command(BaseCommand):
    help = 'Retry failed / pending quotation → ledger / material-plan downstream syncs.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)
        parser.add_argument('--quotation-id', type=int, default=None)
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        limit = options['limit']
        if limit < 1 or limit > 500:
            raise CommandError('--limit must be between 1 and 500')

        qs = QuotationDownstreamSync.objects.filter(
            status__in=[
                QuotationDownstreamSync.STATUS_FAILED,
                QuotationDownstreamSync.STATUS_PENDING,
                QuotationDownstreamSync.STATUS_PROCESSING,
            ],
        ).select_related('quotation').order_by('updated_at')
        if options['quotation_id']:
            qs = qs.filter(quotation_id=options['quotation_id'])
        rows = list(qs[:limit])

        if options['dry_run']:
            self.stdout.write(f'dry-run candidates={len(rows)}')
            for row in rows:
                self.stdout.write(
                    f'  quotation_id={row.quotation_id} status={row.status} attempts={row.attempts}'
                )
            return

        ok = fail = skipped = 0
        for row in rows:
            result = run_quotation_downstream_sync(
                row.quotation_id,
                user_id=row.requested_by_id,
            )
            if result.get('ok'):
                if result.get('skipped'):
                    skipped += 1
                else:
                    ok += 1
            else:
                fail += 1
                self.stderr.write(
                    f'fail quotation_id={row.quotation_id} reason={result.get("reason") or result.get("error_code")}'
                )

        summary = f'retried ok={ok} fail={fail} skipped={skipped}'
        if fail:
            self.stderr.write(self.style.ERROR(summary))
            raise SystemExit(1)
        self.stdout.write(self.style.SUCCESS(summary))
