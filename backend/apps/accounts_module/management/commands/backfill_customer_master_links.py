"""Idempotent backfill: Account.normalized_phone, Lead.customer, Project.customer, Quotation.customer.

Safe for local/dev. Does not delete or overwrite financial amounts.
Does not assign project_id on historical payments without verified references.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Backfill Customer Master links (Lead/Project/Quotation) and normalized phones.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Report only; no writes.')

    def handle(self, *args, **options):
        dry = options['dry_run']
        from apps.accounts_module.models import Account
        from apps.accounts_module.services import (
            ensure_customers_from_all_leads, find_party_by_phone, normalize_phone,
        )
        from apps.leads.models import Lead, Quotation
        from apps.projects.models import Project

        report = {
            'phones_normalized': 0,
            'leads_linked': 0,
            'projects_linked': 0,
            'quotations_linked': 0,
            'orphan_projects': 0,
            'quotations_missing_customer': 0,
        }

        # 1) Normalize Account phones
        for party in Account.objects.filter(account_type='Customer').iterator():
            key = normalize_phone(party.phone)
            if key and (party.normalized_phone != key or party.phone != key):
                report['phones_normalized'] += 1
                if not dry:
                    party.phone = key
                    party.normalized_phone = key
                    party.save(update_fields=['phone', 'normalized_phone', 'updated_at'])

        # 2) Ensure parties from leads + Lead.customer FK
        if not dry:
            ensure_customers_from_all_leads()
        for lead in Lead.objects.filter(is_deleted=False, customer__isnull=True).exclude(mobile_number=''):
            party = find_party_by_phone(lead.mobile_number)
            if party:
                report['leads_linked'] += 1
                if not dry:
                    Lead.objects.filter(pk=lead.pk, customer__isnull=True).update(customer_id=party.id)

        # 3) Project.customer from lead.customer or phone
        for project in Project.objects.filter(is_deleted=False, customer__isnull=True).select_related('lead'):
            party = None
            if project.lead_id and project.lead.customer_id:
                party = project.lead.customer
            elif project.lead_id:
                party = find_party_by_phone(project.lead.mobile_number)
            if party is None:
                report['orphan_projects'] += 1
                continue
            report['projects_linked'] += 1
            if not dry:
                Project.objects.filter(pk=project.pk, customer__isnull=True).update(
                    customer_id=party.id,
                    customer_name=project.customer_name or party.name,
                )
                if project.lead_id and not project.lead.customer_id:
                    Lead.objects.filter(pk=project.lead_id, customer__isnull=True).update(customer_id=party.id)

        # 4) Quotation.customer from lead.customer / phone
        for quote in Quotation.objects.filter(is_deleted=False, customer__isnull=True).select_related('lead'):
            party = None
            if quote.lead_id and quote.lead.customer_id:
                party = quote.lead.customer
            elif quote.lead_id:
                party = find_party_by_phone(quote.lead.mobile_number)
            if party is None:
                report['quotations_missing_customer'] += 1
                continue
            report['quotations_linked'] += 1
            if not dry:
                Quotation.objects.filter(pk=quote.pk, customer__isnull=True).update(customer_id=party.id)

        prefix = 'DRY-RUN ' if dry else ''
        self.stdout.write(self.style.SUCCESS(f'{prefix}{report}'))
