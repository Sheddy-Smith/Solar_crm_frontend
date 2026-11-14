"""Complete Commissioning → encrypt credentials → activate O&M plant → warranty rows."""
from __future__ import annotations

import re
from datetime import date

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from malwa_solar.encryption import encrypt_value

from .commissioning_tasks import sync_commissioning_tasks

SOLAR_APP_CHOICES = (
    'SolisCloud', 'SolarMan', 'ShinePhone', 'Fronius Solar.web', 'Growatt OSS',
    'Sungrow iSolarCloud', 'GoodWe SEMS', 'Other',
)


def add_years(start: date, years: int) -> date:
    try:
        return start.replace(year=start.year + years)
    except ValueError:
        # 29 Feb → 28 Feb on non-leap targets
        return start.replace(month=2, day=28, year=start.year + years)


def parse_warranty_years(value) -> int:
    if value is None or value == '':
        raise ValidationError({'detail': 'Warranty years are required.'})
    if isinstance(value, (int, float)):
        years = int(value)
    else:
        match = re.search(r'(\d+)', str(value))
        if not match:
            raise ValidationError({'detail': f'Invalid warranty value: {value}'})
        years = int(match.group(1))
    if years <= 0 or years > 50:
        raise ValidationError({'detail': f'Warranty years out of range: {years}'})
    return years


def _require(data, key, label):
    value = (data.get(key) or '').strip() if isinstance(data.get(key), str) else data.get(key)
    if value in (None, ''):
        raise ValidationError({key: f'{label} is required.'})
    return value


@transaction.atomic
def complete_commissioning(commissioning, data, *, actor=None):
    """Mandatory completion form → Completed → O&M plant + warranties + encrypted logins."""
    if commissioning.status == 'Completed':
        raise ValidationError({'detail': 'Commissioning is already completed.'})
    if not commissioning.assigned_employee_id:
        raise ValidationError({'assigned_employee': 'Assign an engineer before completing.'})

    commissioning_date = commissioning.date or timezone.localdate()
    inv_years = parse_warranty_years(data.get('inverter_warranty'))
    panel_years = parse_warranty_years(data.get('panel_warranty'))
    service_years = parse_warranty_years(data.get('service_warranty'))

    next_service = data.get('next_service_due')
    if not next_service:
        next_service = add_years(commissioning_date, service_years)
    elif isinstance(next_service, str):
        next_service = date.fromisoformat(next_service)

    wifi_ssid = str(_require(data, 'wifi_ssid', 'Wi-Fi ID (Site)'))
    wifi_password = str(_require(data, 'wifi_password', 'Wi-Fi Password'))
    solar_app = str(_require(data, 'solar_app_platform', 'Solar App / Platform'))
    app_user = str(_require(data, 'solar_app_username', 'Customer App ID'))
    app_password = str(_require(data, 'solar_app_password', 'Customer App Password'))

    commissioning.inverter_warranty_years = inv_years
    commissioning.panel_warranty_years = panel_years
    commissioning.service_warranty_years = service_years
    commissioning.next_service_due = next_service
    commissioning.wifi_ssid = wifi_ssid[:120]
    commissioning.wifi_password_encrypted = encrypt_value(wifi_password)
    commissioning.solar_app_platform = solar_app[:80]
    commissioning.solar_app_username = app_user[:120]
    commissioning.solar_app_password_encrypted = encrypt_value(app_password)
    commissioning.status = 'Completed'
    commissioning.completed_at = timezone.now()
    if not commissioning.date:
        commissioning.date = commissioning_date
    commissioning.save()

    sync_commissioning_tasks(commissioning, actor=actor)

    from apps.om.services import activate_plant
    from apps.amc.models import AmcWarranty
    from apps.notifications.services import notify

    plant, _created = activate_plant(commissioning.project, commissioning_date, user=actor or commissioning.created_by)

    inv_end = add_years(commissioning_date, inv_years)
    panel_end = add_years(commissioning_date, panel_years)
    service_end = add_years(commissioning_date, service_years)

    plant.inverter_warranty_years = inv_years
    plant.panel_warranty_years = panel_years
    plant.service_warranty_years = service_years
    plant.inverter_warranty_end = inv_end
    plant.panel_warranty_end = panel_end
    plant.service_warranty_end = service_end
    plant.next_service_due = next_service
    plant.wifi_ssid = wifi_ssid[:120]
    plant.wifi_password_encrypted = commissioning.wifi_password_encrypted
    plant.solar_app_platform = solar_app[:80]
    plant.solar_app_username = app_user[:120]
    plant.solar_app_password_encrypted = commissioning.solar_app_password_encrypted
    plant.warranty_details = (
        f'Inverter: {inv_years} Years (till {inv_end:%d-%m-%Y})\n'
        f'Panel: {panel_years} Years (till {panel_end:%d-%m-%Y})\n'
        f'Service: {service_years} Years (till {service_end:%d-%m-%Y})\n'
        f'Next service due: {next_service:%d-%m-%Y}'
    )
    plant.save()

    project = commissioning.project
    if project.status not in ('Completed', 'Cancelled'):
        project.status = 'Completed'
        project.save(update_fields=['status', 'updated_at'])

    warranty_specs = (
        ('Inverter', inv_years, inv_end),
        ('Panel', panel_years, panel_end),
        ('Service', service_years, service_end),
    )
    for asset_type, years, end in warranty_specs:
        existing = AmcWarranty.objects.filter(project=project, asset_type=asset_type).order_by('-id').first()
        payload = {
            'asset_type': asset_type,
            'manufacturer': '',
            'serial_number': '',
            'warranty_start': commissioning_date,
            'warranty_end': end,
            'status': 'Active',
            'coverage_details': f'{years} Years from commissioning',
            'created_by': actor or commissioning.created_by,
        }
        if existing:
            for k, v in payload.items():
                if k == 'created_by':
                    continue
                setattr(existing, k, v)
            existing.save()
        else:
            AmcWarranty.objects.create(project=project, **payload)

    notify(
        f'commissioning-completed-om-{commissioning.pk}',
        f'Commissioning complete → O&M: {plant.plant_name}',
        message=(
            f'{plant.plant_code} moved to O&M. '
            f'Free service till {plant.free_service_end:%d-%m-%Y}. '
            f'Next service {next_service:%d-%m-%Y}.'
        ),
        category='Service',
        severity='info',
        plant=plant,
        link=f'/om/plants?plant={plant.pk}',
        module='O&M',
    )
    return commissioning, plant
