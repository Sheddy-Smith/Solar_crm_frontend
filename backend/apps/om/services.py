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
    # Staged plants stay Pending until commissioning complete activates them.
    if not plant.is_active and plant.om_status == 'Commissioning Pending':
        return 'Commissioning Pending'
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


CLEANING_VISITS_PER_YEAR = 18
CLEANING_CHECKLIST = [
    'Panel surface dust / bird droppings cleared',
    'Chemical / cleaning solution used (if any)',
    'Structure & rail wipe-down',
    'Photos before / after captured',
    'Customer acknowledgement',
]


@transaction.atomic
def stage_plant_pending(project, user=None):
    """When a commissioning engineer is assigned, stage the plant in O&M as Commissioning Pending.

    Does not start free-service window or quarterly schedule — that happens on activate_plant.
    """
    if not project:
        return None, False
    snapshot = build_snapshot(project)
    plant = OmPlant.objects.select_for_update().filter(project=project).first()
    created = plant is None
    if created:
        customer = None
        try:
            from apps.accounts_module.services import get_or_create_party_for_project
            customer = get_or_create_party_for_project(project)
        except Exception:
            logger.exception('O&M: could not link customer for pending plant project %s', project.pk)
        plant = OmPlant(project=project, customer=customer, created_by=user, **snapshot)
    else:
        # Already activated plants must not be downgraded to Pending.
        if plant.is_active and plant.om_status != 'Commissioning Pending':
            return plant, False
        for field, value in snapshot.items():
            current = getattr(plant, field)
            if current in (None, '') and value not in (None, ''):
                setattr(plant, field, value)

    plant.is_active = False
    plant.om_status = 'Commissioning Pending'
    plant.save()
    return plant, created


def ensure_cleaning_schedule(plant, user=None, visits_per_year=CLEANING_VISITS_PER_YEAR):
    """Create annual panel-cleaning visit tasks (default 18 / year during free-service window)."""
    if not plant or not plant.commissioning_date or not plant.free_service_end:
        return 0
    start = plant.commissioning_date
    end = plant.free_service_end
    if end <= start:
        return 0
    # Spread visits evenly across the free-service years.
    years = max(1, (end.year - start.year) or 1)
    total = visits_per_year * years
    interval_days = max(1, int(round(365 / visits_per_year)))
    existing = {
        t.sequence_no: t
        for t in plant.tasks.filter(source='Cleaning')
    }
    created = 0
    for number in range(1, total + 1):
        due = start + timedelta(days=interval_days * number)
        if due > end:
            break
        task = existing.get(number)
        if task is None:
            OmMaintenanceTask.objects.create(
                plant=plant,
                project=plant.project,
                title=f'Panel Cleaning {number}/{total}',
                site=plant.plant_location,
                source='Cleaning',
                sequence_no=number,
                task_type='Preventive',
                priority='Medium',
                due_date=due,
                deadline=due + timedelta(days=7),
                status='Scheduled',
                checklist=[{'label': label, 'done': False} for label in CLEANING_CHECKLIST],
                created_by=user,
            )
            created += 1
        elif task.status == 'Scheduled' and task.due_date != due and not task.visits.exists():
            task.due_date = due
            task.deadline = due + timedelta(days=7)
            task.save(update_fields=['due_date', 'deadline', 'updated_at'])
    return created


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
    ensure_cleaning_schedule(plant, user=user)

    from apps.notifications.services import notify
    notify(
        f'plant-activated-{plant.pk}',
        f'O&M activated: {plant.plant_name}',
        message=f'{plant.plant_code} commissioned on {commissioning_date:%d-%m-%Y}. '
                f'Free service till {plant.free_service_end:%d-%m-%Y}.',
        category='Service', severity='info', plant=plant, link=f'/om/plants?plant={plant.pk}',
    )
    return plant, created


def _parse_date(value):
    if value in (None, ''):
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _parse_int(value, default=None):
    if value in (None, ''):
        return default
    try:
        return int(Decimal(str(value)))
    except Exception:
        return default


def _add_years(start, years):
    from apps.liaisoning.commissioning_complete import add_years
    if not start or not years:
        return None
    return add_years(start, int(years))


def sync_plant_amc_warranties(plant, user=None):
    """Upsert AmcWarranty rows from plant warranty fields (no duplicates per asset type)."""
    if not plant or not plant.project_id:
        return
    from apps.amc.models import AmcWarranty
    from apps.liaisoning.commissioning_complete import warranty_status_for
    from django.utils import timezone

    today = timezone.localdate()
    specs = [
        ('Panel', plant.panel_warranty_start or plant.commissioning_date, plant.panel_warranty_end, plant.panel_warranty_years, plant.panel_brand, plant.panel_serials),
        ('Inverter', plant.inverter_warranty_start or plant.commissioning_date, plant.inverter_warranty_end, plant.inverter_warranty_years, plant.inverter_brand, plant.inverter_serial),
        ('Service', plant.service_warranty_start or plant.commissioning_date, plant.service_warranty_end, plant.service_warranty_years, 'Company', ''),
    ]
    for asset_type, start, end, years, manufacturer, serial in specs:
        if not end and not years:
            continue
        existing = AmcWarranty.objects.filter(project=plant.project, asset_type=asset_type).order_by('-id').first()
        payload = {
            'asset_type': asset_type,
            'manufacturer': (manufacturer or '')[:100],
            'serial_number': str(serial or '')[:100],
            'warranty_start': start,
            'warranty_end': end,
            'status': warranty_status_for(end, today) if end else 'Active',
            'coverage_details': f'{years} Years' if years else '',
            'created_by': user,
        }
        if existing:
            for k, v in payload.items():
                if k == 'created_by':
                    continue
                setattr(existing, k, v)
            existing.save()
        else:
            AmcWarranty.objects.create(project=plant.project, **payload)


PLANT_REGISTER_FIELDS = [
    'customer_name', 'mobile_number', 'alternate_mobile', 'email', 'address', 'city', 'state',
    'contact_person', 'customer_type',
    'plant_name', 'plant_location', 'capacity_kw', 'plant_type', 'system_type',
    'installation_date', 'commissioning_date', 'handover_date',
    'panel_brand', 'panel_model', 'panel_wattage_w', 'panel_count', 'panel_serials',
    'panel_installation_date',
    'inverter_brand', 'inverter_model', 'inverter_capacity_kw', 'inverter_count', 'inverter_serial',
    'inverter_installation_date',
    'structure_type', 'acdb_details', 'dcdb_details', 'earthing_details', 'net_meter_details',
    'data_logger_brand', 'data_logger_model', 'data_logger_serial',
    'panel_warranty_years', 'panel_performance_warranty_years', 'inverter_warranty_years',
    'service_warranty_years',
    'panel_warranty_start', 'inverter_warranty_start', 'service_warranty_start',
    'next_service_due', 'free_service_included', 'service_frequency',
    'wifi_ssid', 'solar_app_platform', 'solar_app_type', 'solar_app_username',
    'account_created', 'plant_online', 'data_logger_connected', 'monitoring_status', 'last_online_date',
    'remarks', 'registration_source',
]

DATE_FIELDS = {
    'installation_date', 'commissioning_date', 'handover_date',
    'panel_installation_date', 'inverter_installation_date',
    'panel_warranty_start', 'inverter_warranty_start', 'service_warranty_start',
    'next_service_due', 'last_online_date',
}
BOOL_FIELDS = {
    'free_service_included', 'account_created', 'plant_online',
    'data_logger_connected', 'is_draft',
}
INT_FIELDS = {
    'panel_warranty_years', 'panel_performance_warranty_years',
    'inverter_warranty_years', 'service_warranty_years',
}


@transaction.atomic
def register_existing_plant(project, payload, user=None, draft=False):
    """Register or update an existing/old plant into O&M without creating duplicates.

    Uses the project's OneToOne OmPlant. Prefer this over a second plant row when
    commissioning already staged/activated the plant.
    """
    from malwa_solar.encryption import encrypt_value
    from apps.notifications.services import notify

    if not project:
        raise ValueError('project is required')

    snapshot = build_snapshot(project)
    plant = OmPlant.objects.select_for_update().filter(project=project).first()
    created = plant is None

    if created:
        customer = None
        try:
            from apps.accounts_module.services import get_or_create_party_for_project
            customer = get_or_create_party_for_project(project)
        except Exception:
            logger.exception('O&M: could not link customer for register plant project %s', project.pk)
        plant = OmPlant(
            project=project,
            customer=customer,
            created_by=user,
            customer_name=snapshot.get('customer_name') or project.customer_name or 'Customer',
            plant_name=snapshot.get('plant_name') or project.project_name or 'Plant',
        )
        for field, value in snapshot.items():
            if hasattr(plant, field) and value not in (None, ''):
                setattr(plant, field, value)

    data = dict(payload or {})
    for field in PLANT_REGISTER_FIELDS:
        if field not in data:
            continue
        value = data[field]
        if field in DATE_FIELDS:
            value = _parse_date(value)
        elif field in BOOL_FIELDS:
            if isinstance(value, str):
                value = value.strip().lower() in ('1', 'true', 'yes', 'y')
            else:
                value = bool(value)
        elif field in INT_FIELDS:
            value = _parse_int(value)
        elif field == 'capacity_kw':
            if value in (None, ''):
                value = None
            else:
                try:
                    value = Decimal(str(value))
                except Exception:
                    value = None
        elif isinstance(value, str):
            value = value.strip()
        setattr(plant, field, value)

    # Plaintext passwords from registration form → encrypted storage
    wifi_pw = data.get('wifi_password')
    if wifi_pw not in (None, ''):
        plant.wifi_password_encrypted = encrypt_value(str(wifi_pw))
    app_pw = data.get('solar_app_password')
    if app_pw not in (None, ''):
        plant.solar_app_password_encrypted = encrypt_value(str(app_pw))

    # Auto Warranty Till = start + years
    panel_start = plant.panel_warranty_start or plant.panel_installation_date or plant.commissioning_date
    inv_start = plant.inverter_warranty_start or plant.inverter_installation_date or plant.commissioning_date
    svc_start = plant.service_warranty_start or plant.commissioning_date
    if plant.panel_warranty_years and panel_start:
        plant.panel_warranty_start = panel_start
        plant.panel_warranty_end = _add_years(panel_start, plant.panel_warranty_years)
    if plant.inverter_warranty_years and inv_start:
        plant.inverter_warranty_start = inv_start
        plant.inverter_warranty_end = _add_years(inv_start, plant.inverter_warranty_years)
    if plant.service_warranty_years and svc_start:
        plant.service_warranty_start = svc_start
        plant.service_warranty_end = _add_years(svc_start, plant.service_warranty_years)

    if not plant.commissioning_date:
        plant.commissioning_date = (
            plant.panel_installation_date
            or plant.inverter_installation_date
            or plant.installation_date
        )
    if plant.commissioning_date and plant.free_service_included:
        plant.free_service_start = plant.commissioning_date
        plant.free_service_end = free_service_end(plant.commissioning_date, FREE_SERVICE_YEARS)

    lines = []
    if plant.panel_warranty_years and plant.panel_warranty_end:
        lines.append(f'Panel: {plant.panel_warranty_years}Y till {plant.panel_warranty_end:%d-%m-%Y}')
    if plant.inverter_warranty_years and plant.inverter_warranty_end:
        lines.append(f'Inverter: {plant.inverter_warranty_years}Y till {plant.inverter_warranty_end:%d-%m-%Y}')
    if plant.service_warranty_years and plant.service_warranty_end:
        lines.append(f'Service: {plant.service_warranty_years}Y till {plant.service_warranty_end:%d-%m-%Y}')
    if lines:
        plant.warranty_details = '\n'.join(lines)

    plant.is_draft = bool(draft)
    if draft:
        plant.is_active = False
        if plant.om_status != 'Commissioning Pending':
            plant.om_status = 'Commissioning Pending'
    else:
        plant.is_active = True
        plant.is_draft = False
        plant.om_status = compute_om_status(plant)

    if not plant.lead_id and project.lead_id:
        plant.lead_id = project.lead_id

    plant.save()

    if not draft:
        if plant.commissioning_date:
            ensure_quarterly_schedule(plant, user=user)
            ensure_cleaning_schedule(plant, user=user)
        sync_plant_amc_warranties(plant, user=user)
        notify(
            f'plant-registered-{plant.pk}',
            f'Existing plant added to O&M: {plant.plant_name}',
            message=f'{plant.plant_code} registered'
                    + (f' · commissioned {plant.commissioning_date:%d-%m-%Y}' if plant.commissioning_date else ''),
            category='Service', severity='info', plant=plant, link=f'/om/plants?plant={plant.pk}',
        )
    return plant, created


def build_registration_prefill(project):
    """Payload used by Add Existing Plant → Add from Existing Project."""
    snap = build_snapshot(project)
    commissioning = project.lc_commissionings.order_by('-created_at').first() if hasattr(project, 'lc_commissionings') else None
    plant = getattr(project, 'om_plant', None)
    data = {
        **{k: ('' if v is None else v) for k, v in snap.items() if k != 'lead'},
        'project': project.id,
        'project_code': project.project_id,
        'project_name': project.project_name,
        'has_existing_plant': bool(plant and plant.pk),
        'existing_plant_id': plant.pk if plant else None,
        'existing_plant_active': bool(plant and plant.is_active and not plant.is_draft),
    }
    if commissioning:
        data['commissioning_date'] = commissioning.date or data.get('commissioning_date')
        if commissioning.inverter_warranty_years:
            data['inverter_warranty_years'] = commissioning.inverter_warranty_years
        if commissioning.panel_warranty_years:
            data['panel_warranty_years'] = commissioning.panel_warranty_years
        if commissioning.service_warranty_years:
            data['service_warranty_years'] = commissioning.service_warranty_years
        if commissioning.next_service_due:
            data['next_service_due'] = commissioning.next_service_due
        if commissioning.solar_app_platform:
            data['solar_app_platform'] = commissioning.solar_app_platform
        if commissioning.solar_app_username:
            data['solar_app_username'] = commissioning.solar_app_username
        if commissioning.wifi_ssid:
            data['wifi_ssid'] = commissioning.wifi_ssid
    if plant:
        for field in PLANT_REGISTER_FIELDS:
            val = getattr(plant, field, None)
            if val not in (None, ''):
                data[field] = val
    # Serialize dates
    for key, val in list(data.items()):
        if isinstance(val, date):
            data[key] = val.isoformat()
        elif isinstance(val, Decimal):
            data[key] = str(val)
    return data
