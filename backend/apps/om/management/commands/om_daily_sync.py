from datetime import date

from django.core.management.base import BaseCommand

from apps.om.alerts import run_daily_sync


class Command(BaseCommand):
    help = 'O&M alert engine: service due/overdue, free-service expiry, insurance expiry, ticket and task alerts.'

    def add_arguments(self, parser):
        parser.add_argument('--date', help='Run as if today were YYYY-MM-DD (testing).')

    def handle(self, *args, **options):
        today = date.fromisoformat(options['date']) if options.get('date') else None
        counts = run_daily_sync(today)
        self.stdout.write(self.style.SUCCESS(
            f"O&M sync done — plants updated: {counts['plants_updated']}, "
            f"services activated: {counts['tasks_activated']}, new alerts: {counts['alerts']}"
        ))
