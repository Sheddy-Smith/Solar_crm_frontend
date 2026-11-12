"""Idempotent project creation / linking for Won leads and Approved quotations."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone


@transaction.atomic
def ensure_project_for_lead(lead, *, quotation=None, user=None):
    """Get or create the single active project for a lead (row-locked).

    Returns (project, created: bool).
    """
    from apps.leads.models import Lead, Quotation
    from apps.liaisoning.models import LiaisonProjectStage
    from apps.projects.bom_services import get_active_bom_version, seed_material_plans_from_bom
    from apps.projects.models import Project, SiteSurvey, ProjectDocument

    locked_lead = Lead.objects.select_for_update().filter(pk=lead.pk).first()
    if not locked_lead:
        raise ValueError('Lead not found')

    existing = (
        Project.objects.select_for_update()
        .filter(lead_id=locked_lead.pk, is_deleted=False)
        .order_by('id')
        .first()
    )

    quote = quotation
    if quote is None:
        quote = (
            Quotation.objects.filter(lead_id=locked_lead.pk, is_deleted=False)
            .exclude(status='Rejected')
            .order_by('-updated_at', '-id')
            .first()
        )

    def _capacity():
        if quote and quote.plant_capacity_kw:
            return Decimal(str(quote.plant_capacity_kw))
        try:
            return Decimal(str(locked_lead.estimated_capacity or '0').replace('kW', '').replace('kw', '').strip() or '0')
        except (InvalidOperation, ValueError):
            return Decimal('0')

    def _total_value():
        if quote and quote.grand_total:
            return Decimal(str(quote.grand_total))
        if locked_lead.project_cost:
            try:
                return Decimal(str(locked_lead.project_cost))
            except (InvalidOperation, ValueError):
                pass
        return Decimal('0')

    if existing:
        changed = []
        cap = _capacity()
        if cap > 0 and (not existing.capacity_kwp or existing.capacity_kwp == 0):
            existing.capacity_kwp = cap
            changed.append('capacity_kwp')
        val = _total_value()
        if val > 0 and (not existing.total_value or existing.total_value == 0):
            existing.total_value = val
            changed.append('total_value')
        if changed:
            changed.append('updated_at')
            existing.save(update_fields=changed)
        LiaisonProjectStage.objects.get_or_create(project=existing)
        _seed_bom_plans(existing, quote, user)
        return existing, False

    lead_survey = getattr(locked_lead, 'site_survey', None)
    project = Project.objects.create(
        project_name=locked_lead.project_name or f'{locked_lead.customer_name} Solar Project',
        lead=locked_lead,
        customer_name=locked_lead.customer_name,
        site_address=(lead_survey.site_address if lead_survey and lead_survey.site_address else locked_lead.address),
        city=locked_lead.city,
        state=locked_lead.state,
        site_size=(lead_survey.site_size_sqft if lead_survey else ''),
        project_type=locked_lead.project_type or 'On-Grid',
        capacity_kwp=_capacity(),
        total_value=_total_value(),
        manager=locked_lead.assigned_to,
        status='Planning',
        created_by=user or locked_lead.created_by,
    )
    LiaisonProjectStage.objects.get_or_create(project=project)
    try:
        from apps.accounts_module.services import get_or_create_party_for_project
        get_or_create_party_for_project(project)
    except Exception:
        pass

    if lead_survey and not SiteSurvey.objects.filter(project=project).exists():
        try:
            from django.core.files.base import ContentFile
            SiteSurvey.objects.create(
                project=project,
                survey_date=lead_survey.survey_date,
                surveyed_by=lead_survey.surveyed_by,
                roof_type=getattr(lead_survey, 'mounting_type', '') or '',
                rooftop_area_sqft=getattr(lead_survey, 'site_size_sqft', '') or '',
                available_area_sqft=getattr(lead_survey, 'site_size_sqft', '') or '',
                latitude=getattr(lead_survey, 'latitude', None),
                longitude=getattr(lead_survey, 'longitude', None),
            )
            for photo in lead_survey.photos.all():
                try:
                    photo.image.open('rb')
                    content = photo.image.read()
                except (OSError, ValueError):
                    continue
                finally:
                    try:
                        photo.image.close()
                    except Exception:
                        pass
                doc = ProjectDocument(
                    project=project,
                    name=getattr(photo, 'caption', None) or f'Site Photo {photo.pk}',
                    category='Site Photos',
                    uploaded_by=getattr(lead_survey, 'surveyed_by', None) or user,
                )
                doc.file.save(photo.image.name.rsplit('/', 1)[-1], ContentFile(content), save=True)
        except Exception:
            pass

    _seed_bom_plans(project, quote, user)
    return project, True


def _seed_bom_plans(project, quote, user=None):
    from apps.projects.bom_services import get_active_bom_version, seed_material_plans_from_bom

    bom = None
    if quote and getattr(quote, 'bom_version_id', None):
        bom = quote.bom_version
    if bom is None and quote and quote.plant_capacity_kw:
        bom = get_active_bom_version(quote.plant_capacity_kw)
    if bom is None and project.capacity_kwp:
        bom = get_active_bom_version(project.capacity_kwp)
    if bom and not bom.pending_configuration:
        seed_material_plans_from_bom(project, bom, quotation=quote)


def amc_auto_create_enabled() -> bool:
    """Configurable gate — default OFF so contracts are never invented silently.

    Set env SOLAR_AMC_ON_PROJECT_COMPLETION=1 (or true/yes) to enable draft AMC
    creation when a project reaches Completed.
    """
    from django.conf import settings
    import os

    raw = os.environ.get('SOLAR_AMC_ON_PROJECT_COMPLETION')
    if raw is None:
        raw = getattr(settings, 'SOLAR_AMC_ON_PROJECT_COMPLETION', False)
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() in ('1', 'true', 'yes', 'on')


@transaction.atomic
def ensure_amc_draft_for_completed_project(project, user=None):
    """Idempotent AMC shell for Completed projects when auto-create is enabled.

    Does not invent annual_value / dates — leaves Draft-ready Active shell with
    remarks marking pending commercial configuration. Never duplicates an
    existing Active/Expiring Soon contract for the same project.
    """
    from apps.amc.models import AmcContract

    if (project.status or '') != 'Completed':
        return None, False
    if not amc_auto_create_enabled():
        return None, False
    existing = (
        AmcContract.objects.select_for_update()
        .filter(project_id=project.pk)
        .exclude(status='Cancelled')
        .order_by('id')
        .first()
    )
    if existing:
        return existing, False
    contract = AmcContract.objects.create(
        project=project,
        customer_name=project.customer_name or project.project_name or 'Customer',
        site=project.site_address or project.city or '',
        contract_type='Comprehensive',
        annual_value=Decimal('0'),
        status='Active',
        remarks='Auto-created on project completion — configure value/dates before billing.',
        created_by=user or project.created_by,
    )
    return contract, True
