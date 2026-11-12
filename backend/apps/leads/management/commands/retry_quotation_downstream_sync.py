from django.core.management.base import BaseCommand

from apps.leads.models import QuotationDownstreamSync
from apps.leads.quotation_sync import run_quotation_downstream_sync


class Command(BaseCommand):
    help = 'Retry failed / pending quotation → ledger / material-plan downstream syncs.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)
        parser.add_argument('--quotation-id', type=int, default=None)

    def handle(self, *args, **options):
        qs = QuotationDownstreamSync.objects.filter(
            status__in=[
                QuotationDownstreamSync.STATUS_FAILED,
                QuotationDownstreamSync.STATUS_PENDING,
            ],
        ).select_related('quotation')
        if options['quotation_id']:
            qs = qs.filter(quotation_id=options['quotation_id'])
        qs = qs.order_by('updated_at')[: options['limit']]

        ok = fail = 0
        for row in qs:
            result = run_quotation_downstream_sync(
                row.quotation_id,
                user_id=row.requested_by_id,
            )
            if result.get('ok'):
                ok += 1
            else:
                fail += 1
        self.stdout.write(self.style.SUCCESS(f'retried ok={ok} fail={fail}'))
