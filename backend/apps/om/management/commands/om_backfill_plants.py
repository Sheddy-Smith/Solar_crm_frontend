from django.core.management.base import BaseCommand

from apps.liaisoning.models import LiaisonCommissioning, LiaisonProjectStage
from apps.projects.models import Project
from apps.om.services import activate_plant


class Command(BaseCommand):
    help = (
        'Activate O&M plants for projects whose Liaisoning commissioning is already Completed, '
        'and create the Liaisoning pipeline record for every Won project that lacks one.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Only report what would change.')

    def handle(self, *args, **options):
        dry = options['dry_run']

        won_projects = Project.objects.filter(lead__status='Won', is_deleted=False).exclude(liaison_stage__isnull=False)
        stage_count = won_projects.count()
        if not dry:
            for project in won_projects:
                LiaisonProjectStage.objects.get_or_create(project=project)
        self.stdout.write(f'Liaisoning stages {"to create" if dry else "created"}: {stage_count}')

        activated = updated = 0
        done = (
            LiaisonCommissioning.objects.filter(status='Completed', project__is_deleted=False)
            .select_related('project').order_by('project_id', '-date', '-updated_at')
        )
        seen = set()
        for commissioning in done:
            if commissioning.project_id in seen:
                continue
            seen.add(commissioning.project_id)
            if dry:
                self.stdout.write(f'  would activate {commissioning.project.project_id} ({commissioning.date})')
                continue
            plant, created = activate_plant(commissioning.project, commissioning.date, user=commissioning.created_by)
            if created:
                activated += 1
            else:
                updated += 1
            self.stdout.write(f'  {plant.plant_code} {commissioning.project.project_id} {"created" if created else "refreshed"}')
        self.stdout.write(self.style.SUCCESS(f'Plants created: {activated}, refreshed: {updated}'))
