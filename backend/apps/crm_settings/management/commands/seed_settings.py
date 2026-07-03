from django.core.management.base import BaseCommand

from apps.crm_settings.services import seed_setting_defaults


class Command(BaseCommand):
    help = 'Seed CRM settings defaults (categories, masters, financial years, IP rules)'

    def handle(self, *args, **options):
        seed_setting_defaults()
        self.stdout.write(self.style.SUCCESS('CRM settings seeded successfully.'))
