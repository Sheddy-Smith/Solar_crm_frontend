from django.core.management.base import BaseCommand

from apps.projects.bom_services import ensure_default_capacity_shells


class Command(BaseCommand):
    help = 'Ensure 3/4/5/6 kW BOM capacity shells exist (Draft, pending_configuration).'

    def handle(self, *args, **options):
        created = ensure_default_capacity_shells()
        self.stdout.write(self.style.SUCCESS(f'BOM shells ready; new version ids={created}'))
