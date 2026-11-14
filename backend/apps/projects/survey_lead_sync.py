"""Keep Lead.site_survey.status in sync with Project SiteSurvey (canonical form)."""
from __future__ import annotations

ALLOWED_STATUSES = {'Pending', 'In Progress', 'Completed'}


def normalize_survey_status(raw) -> str:
    value = str(raw or '').strip()
    if value == 'Draft':
        return 'Pending'
    if value in ALLOWED_STATUSES:
        return value
    return 'Pending'


def sync_lead_site_survey_from_project_survey(survey) -> None:
    """Upsert LeadSiteSurvey from a Project SiteSurvey, keyed by project.lead_id."""
    project = getattr(survey, 'project', None)
    lead_id = getattr(project, 'lead_id', None) if project is not None else None
    if not lead_id:
        return

    from apps.leads.models import LeadSiteSurvey

    status = normalize_survey_status(getattr(survey, 'status', None))
    defaults = {
        'status': status,
        'survey_date': getattr(survey, 'survey_date', None),
        'latitude': (getattr(survey, 'latitude', None) or '')[:20],
        'longitude': (getattr(survey, 'longitude', None) or '')[:20],
        'surveyed_by_id': getattr(survey, 'surveyed_by_id', None),
    }
    lead_survey, created = LeadSiteSurvey.objects.get_or_create(
        lead_id=lead_id,
        defaults=defaults,
    )
    if created:
        return

    update_fields = []
    for field, value in defaults.items():
        if getattr(lead_survey, field) != value:
            setattr(lead_survey, field, value)
            update_fields.append(field)
    if update_fields:
        lead_survey.save(update_fields=update_fields + ['updated_at'])


def resolve_lead_survey_status(lead) -> str:
    """Authoritative survey status for Lead List: project SiteSurvey first, else LeadSiteSurvey."""
    annotated = getattr(lead, 'list_survey_status', None)
    if annotated:
        return normalize_survey_status(annotated)

    # Prefetched projects (optional)
    cache = getattr(lead, '_prefetched_objects_cache', None) or {}
    projects = cache.get('projects')
    if projects is not None:
        ranked = []
        rank = {'Completed': 3, 'In Progress': 2, 'Pending': 1, 'Draft': 1}
        for project in projects:
            site = getattr(project, 'site_survey', None)
            if site and site.status:
                ranked.append(site.status)
        if ranked:
            best = max(ranked, key=lambda s: rank.get(s, 0))
            return normalize_survey_status(best)

    lead_survey = getattr(lead, 'site_survey', None)
    if lead_survey and lead_survey.status:
        return normalize_survey_status(lead_survey.status)

    from apps.projects.models import SiteSurvey

    status = (
        SiteSurvey.objects.filter(project__lead_id=lead.id)
        .order_by('-updated_at')
        .values_list('status', flat=True)
        .first()
    )
    return normalize_survey_status(status)
