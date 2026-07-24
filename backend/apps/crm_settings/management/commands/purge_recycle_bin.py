from django.core.management.base import BaseCommand

from apps.leads.recycle import purge_expired_recycle_items


class Command(BaseCommand):
    help = 'Permanently delete recycle-bin items older than the retention period (30 days).'

    def handle(self, *args, **options):
        result = purge_expired_recycle_items()
        self.stdout.write(self.style.SUCCESS(
            f"Purged {result['leads']} lead(s) and {result['follow_ups']} follow-up(s)."
        ))
