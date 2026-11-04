"""Seed isolated staging DB with fake users/leads/surveys — no production data."""
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Populate staging_local SQLite with anonymized dummy CRM data for Locust.'

    def add_arguments(self, parser):
        parser.add_argument('--users', type=int, default=80)
        parser.add_argument('--leads', type=int, default=500)
        parser.add_argument('--password', default='StagingLoad@123')
        parser.add_argument('--reset', action='store_true', help='Wipe seeded staging rows first')

    def handle(self, *args, **options):
        from apps.accounts.models import Role, RolePermission, User, Branch
        from apps.leads.models import Lead, FollowUp
        from apps.projects.models import Project, SiteSurvey

        n_users = options['users']
        n_leads = options['leads']
        password = options['password']

        if options['reset']:
            FollowUp.objects.all().delete()
            SiteSurvey.objects.all().delete()
            Project.objects.all().delete()
            Lead.objects.all().delete()
            User.objects.exclude(email='staging.admin@local.test').delete()
            self.stdout.write('Reset staging rows')

        role, _ = Role.objects.get_or_create(
            name='Super Admin',
            defaults={'role_type': 'system', 'description': 'staging'},
        )
        # Full module access for load-test accounts.
        for module, _label in RolePermission.MODULE_CHOICES:
            RolePermission.objects.update_or_create(
                role=role,
                module=module,
                defaults={
                    'can_view': True,
                    'can_add': True,
                    'can_edit': True,
                    'can_delete': True,
                    'can_export': True,
                    'full_access': True,
                },
            )

        branch, _ = Branch.objects.get_or_create(
            name='Staging Branch',
            defaults={'city': 'Indore', 'address': 'Local staging only'},
        )

        admin, created = User.objects.get_or_create(
            email='staging.admin@local.test',
            defaults={'name': 'Staging Admin', 'role': role, 'branch': branch, 'is_active': True},
        )
        admin.set_password(password)
        admin.role = role
        admin.is_superuser = True
        admin.is_staff = True
        admin.is_active = True
        admin.save()

        users = [admin]
        for i in range(1, n_users + 1):
            email = f'staging.user{i:03d}@local.test'
            u, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'name': f'Staging User {i:03d}',
                    'role': role,
                    'branch': branch,
                    'is_active': True,
                    'mobile': f'9{i:09d}'[:15],
                },
            )
            u.set_password(password)
            u.role = role
            u.is_active = True
            u.save()
            users.append(u)

        statuses = ['New', 'Follow-up', 'Quotation', 'Won', 'Lost']
        categories = ['Hot', 'Warm', 'Cool']
        now = timezone.now()
        created_leads = 0
        for i in range(1, n_leads + 1):
            owner = users[i % len(users)]
            ivrs = f'STG{i:06d}'
            lead, was_created = Lead.objects.get_or_create(
                ivrs_number=ivrs,
                defaults={
                    'customer_name': f'Customer {i:04d}',
                    'mobile_number': f'8{(1000000000 + i) % 10000000000:010d}'[:15],
                    'email': f'customer{i}@example.test',
                    'project_name': f'Staging Project {i}',
                    'project_type': 'On-Grid',
                    'city': 'Indore',
                    'state': 'MP',
                    'address': f'{i} Staging Street',
                    'status': statuses[i % len(statuses)],
                    'category': categories[i % len(categories)],
                    'priority': 'Medium',
                    'source': 'Staging Seed',
                    'assigned_to': owner,
                    'created_by': owner,
                    'next_follow_up': now + timedelta(days=(i % 7) - 2),
                },
            )
            if was_created:
                created_leads += 1
                FollowUp.objects.create(
                    lead=lead,
                    follow_up_type='Call',
                    scheduled_at=now + timedelta(hours=i % 48),
                    status='Scheduled',
                    notes='Staging anonymized follow-up',
                    created_by=owner,
                )
                if i % 3 == 0:
                    project, _ = Project.objects.get_or_create(
                        lead=lead,
                        defaults={
                            'project_name': lead.project_name or f'Staging Project {i}',
                            'customer_name': lead.customer_name,
                            'capacity_kwp': Decimal('5.00'),
                            'status': 'Active',
                            'city': lead.city or 'Indore',
                            'state': lead.state or 'MP',
                            'manager': owner,
                            'sales_executive': owner,
                        },
                    )
                    SiteSurvey.objects.get_or_create(
                        project=project,
                        defaults={
                            'status': 'Pending',
                            'surveyed_by': owner,
                            'survey_date': timezone.localdate(),
                        },
                    )

        self.stdout.write(self.style.SUCCESS(
            f'Staging ready: admin={admin.email} users={User.objects.count()} '
            f'leads={Lead.objects.count()} (+{created_leads} new) password={password}'
        ))
