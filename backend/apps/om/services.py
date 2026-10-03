import logging
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction

from .models import (
    FREE_SERVICE_YEARS, QUARTERLY_INTERVAL_MONTHS,
    OmPlant, OmMaintenanceTask,
)
from .schedule import free_service_end, quarterly_due_dates

logger = logging.getLogger(__name__)

FREE_SERVICE_EXPIRING_DAYS = 90
QUARTERLY_CHECKLIST = [
    'Inverter status & error log',
    'Panel condition & cleaning',
    'Structure & fasteners',
    'DC / AC cable condition',
    'Earthing & LA',
    'ACDB / DCDB condition',
    'Meter reading',
]
SYSTEM_TYPE_FROM_PROJECT = {'On-Grid': 'On Grid', 'Off-Grid': 'Off Grid', 'Hybrid': 'Hybrid'}


def _fmt(value):
    if value is None:
        return ''
    if isinstance(value, Decimal):
        text = format(value.normalize(), 'f')
        return text.rstrip('0').rstrip('.') if '.' in text else text
    return str(value).strip()


def _first(*values):
    for value in values:
        text = _fmt(value)
        if text:
            return text
    return ''


def _join(parts, sep=' • '):
    return sep.join(p for p in (_fmt(x) for x in parts) if p)


def _approved_quotation(project):
    if not project.lead_id:
        return None
    quotes = project.lead.quotations.exclude(status='Cancelled')
    return quotes.filter(status='Approved').order_by('-updated_at').first() or quotes.order_by('-updated_at').first()


def build_snapshot(project):
    """Customer + plant details pulled from everything the CRM already knows."""
    lead = project.lead if project.lead_id else None
    config = getattr(project, 'system_config', None)
    survey = getattr(project, 'site_survey', None)
    quote = _approved_quotation(project)
    net_meter = project.lc_net_meters.order_by('-installation_date', '-created_at').first()
    warranties = list(project.amc_warranties.all())

    inverter_serial = _join(
        [w.serial_number for w in warranties if 'inverter' in (w.asset_type or '').lower()], sep=', ',
    )
    panel_serials = _join(
        [w.serial_number for w in warranties if any(k in (w.asset_type or '').lower() for k in ('panel', 'module'))],
        sep=', ',
    )
    warranty_lines = []
    if quote:
        for label, value in (('Panel', quote.panel_warranty), ('Inverter', quote.inverter_warranty), ('Structure', quote.structure_warranty)):
            if value:
                warranty_lines.append(f'{label}: {value}')
    for w in warranties:
        warranty_lines.append(_join([w.asset_type, w.manufacturer, w.serial_number, f'till {w.warranty_end}' if w.warranty_end else '']))

    earthing = ''
    if survey:
        earthing = _join([
            f'{survey.earthing_count} pits' if survey.earthing_count else '',
            survey.earthing_type, survey.earthing_location,
        ])
    if not earthing and quote:
        earthing = _fmt(quote.earthing_kit)

    net_meter_details = ''
    if net_meter:
        net_meter_details = _join([
            net_meter.meter_type, net_meter.meter_number, net_meter.meter_make, net_meter.phase,
            f'Installed {net_meter.installation_date:%d-%m-%Y}' if net_meter.installation_date else net_meter.status,
        ])
    elif project.meter_number:
        net_meter_details = _join(['Meter', project.meter_number, project.meter_type])

    return {
        'lead': lead,
        'customer_name': project.customer_name,
        'mobile_number': _first(lead.mobile_number if lead else ''),
        'alternate_mobile': _first(lead.alternate_number if lead else ''),
        'email': _first(lead.email if lead else ''),
        'address': _first(project.site_address, lead.address if lead else ''),
        'city': _first(project.city, lead.city if lead else ''),
        'state': _first(project.state, lead.state if lead else ''),
        'contact_person': project.customer_name,
        'plant_name': project.project_name,
        'plant_location': _first(project.site, project.city, project.site_address),
        'capacity_kw': project.capacity_kwp,
        'plant_type': _first(project.system_type),
        'system_type': SYSTEM_TYPE_FROM_PROJECT.get(project.project_type, 'On Grid'),
        'installation_date': project.installation_done_on,
        'handover_date': project.actual_completion,
        'panel_brand': _first(config and config.panel_brand, survey and survey.panel_brand, quote and quote.panel_brand),
        'panel_model': _first(config and config.panel_model, quote and quote.panel_model),
        'panel_wattage_w': _first(config and config.panel_wattage_w, survey and survey.panel_wattage_w, quote and quote.panel_wattage),
        'panel_count': _first(config and config.panel_count, survey and survey.panel_count, quote and quote.number_of_panels),
        'panel_serials': panel_serials,
        'inverter_brand': _first(config and config.inverter_brand, survey and survey.inverter_brand, quote and quote.inverter_brand),
        'inverter_model': _first(config and config.inverter_model, quote and quote.inverter_model),
        'inverter_capacity_kw': _first(config and config.inverter_capacity_kw, survey and survey.inverter_capacity_kw, quote and quote.inverter_capacity),
        'inverter_serial': inverter_serial,
        'structure_type': _first(survey and survey.get_structure_type_display(), quote and quote.structure_type),
        'acdb_details': _first(quote and quote.acdb),
        'dcdb_details': _first(quote and quote.dcdb),
        'earthing_details': earthing,
        'net_meter_details': net_meter_details,
        'warranty_details': '\n'.join(line for line in warranty_lines if line),
    }


def compute_om_status(plant, today=None):
    today = today or date.today()
    if plant.amc_contract_id:
        contract = plant.amc_contract
        if contract.status in ('Active', 'Expiring Soon') and (not contract.end_date or contract.end_date >= today):
            return 'AMC Active'
        return 'AMC Expired'
    if plant.om_status == 'Paid O&M':
        return 'Paid O&M'
    if not plant.free_service_end:
        return 'Free Service Active'
    if today > plant.free_service_end:
        return 'Free Service Expired'
    if (plant.free_service_end - today).days <= FREE_SERVICE_EXPIRING_DAYS:
        return 'Free Service Expiring Soon'
    return 'Free Service Active'


def ensure_quarterly_schedule(plant, user=None):
    """Create the 20 quarterly services of the free-service period. When the
    commissioning date moves, only services nobody has started are re-dated."""
    if not plant.commissioning_date:
        return 0
    due_dates = quarterly_due_dates(plant.commissioning_date, FREE_SERVICE_YEARS, QUARTERLY_INTERVAL_MONTHS)
    total = len(due_dates)
    existing = {t.sequence_no: t for t in plant.tasks.filter(source='Quarterly')}
    created = 0
    for number, due in enumerate(due_dates, start=1):
        task = existing.get(number)
        if task is None:
            OmMaintenanceTask.objects.create(
                plant=plant,
                project=plant.project,
                title=f'Quarterly Service {number}/{total}',
                site=plant.plant_location,
                source='Quarterly',
                sequence_no=number,
                task_type='Preventive',
                priority='Medium',
                due_date=due,
                deadline=due + timedelta(days=7),
                status='Scheduled',
                checklist=[{'label': label, 'done': False} for label in QUARTERLY_CHECKLIST],
                created_by=user,
            )
            created += 1
        elif task.status == 'Scheduled' and task.due_date != due and not task.visits.exists():
            task.due_date = due
            task.deadline = due + timedelta(days=7)
            task.save(update_fields=['due_date', 'deadline', 'updated_at'])
    return created


@transaction.atomic
def activate_plant(project, commissioning_date=None, user=None):
    """Lead → Project → Commissioning → Plant. Safe to call repeatedly."""
    commissioning_date = commissioning_date or date.today()
    snapshot = build_snapshot(project)
    plant = OmPlant.objects.select_for_update().filter(project=project).first()
    created = plant is None

    if created:
        customer = None
        try:
            from apps.accounts_module.services import get_or_create_party_for_project
            customer = get_or_create_party_for_project(project)
        except Exception:
            logger.exception('O&M: could not link customer account for project %s', project.pk)
        plant = OmPlant(project=project, customer=customer, created_by=user, **snapshot)
    else:
        # Keep anything staff already corrected on the plant; only fill blanks.
        for field, value in snapshot.items():
            current = getattr(plant, field)
            if current in (None, '') and value not in (None, ''):
                setattr(plant, field, value)

    if plant.commissioning_date != commissioning_date:
        plant.commissioning_date = commissioning_date
        plant.free_service_start = commissioning_date
        plant.free_service_end = free_service_end(commissioning_date, FREE_SERVICE_YEARS)
    plant.is_active = True
    plant.om_status = compute_om_status(plant)
    plant.save()
    ensure_quarterly_schedule(plant, user=user)

    if created:
        from apps.notifications.services import notify
        notify(
            f'plant-activated-{plant.pk}',
            f'O&M activated: {plant.plant_name}',
            message=f'{plant.plant_code} commissioned on {commissioning_date:%d-%m-%Y}. '
                    f'Free service till {plant.free_service_end:%d-%m-%Y}.',
            category='Service', severity='info', plant=plant, link=f'/om/plants?plant={plant.pk}',
        )
    return plant, created
