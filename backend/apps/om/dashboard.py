"""O&M dashboard counters + the plant filters behind every counter/alert card."""
from datetime import date, timedelta

from django.db.models import Q

from .models import OmPlant, OmMaintenanceTask, OmBreakdownTicket, OmInsurance

SERVICE_DUE_WINDOW_DAYS = 15
INSURANCE_EXPIRING_DAYS = 30
FREE_SERVICE_ALERT_DAYS = 30
UPCOMING_VISIT_DAYS = 7

FREE_STATUSES = ('Free Service Active', 'Free Service Expiring Soon')
PAID_STATUSES = ('Paid O&M', 'AMC Active', 'AMC Expired')


def _open_tasks():
    return OmMaintenanceTask.objects.exclude(status__in=OmMaintenanceTask.CLOSED_STATUSES)


def insurance_states(today=None):
    """plant_id → 'active' | 'expiring' | 'expired' using each plant's latest policy."""
    today = today or date.today()
    latest = {}
    for policy in OmInsurance.objects.order_by('plant_id', '-expiry_date', '-id'):
        latest.setdefault(policy.plant_id, policy)
    states = {}
    for plant_id, policy in latest.items():
        if policy.status == 'Not Insured':
            continue
        days = (policy.expiry_date - today).days if policy.expiry_date else None
        if policy.status == 'Expired' or (days is not None and days < 0):
            states[plant_id] = 'expired'
        elif days is not None and days <= INSURANCE_EXPIRING_DAYS:
            states[plant_id] = 'expiring'
        else:
            states[plant_id] = 'active'
    return states


def plant_ids_for(key, today=None):
    """Plant ids matching a dashboard filter key, or None for an unknown key."""
    today = today or date.today()
    quarterly = _open_tasks().filter(source='Quarterly', plant__isnull=False)
    open_tickets = OmBreakdownTicket.objects.filter(status__in=OmBreakdownTicket.OPEN_STATUSES, plant__isnull=False)
    plants = OmPlant.objects.all()

    if key == 'service_due':
        qs = quarterly.filter(due_date__gte=today, due_date__lte=today + timedelta(days=SERVICE_DUE_WINDOW_DAYS))
        return set(qs.values_list('plant_id', flat=True))
    if key == 'service_overdue':
        return set(quarterly.filter(due_date__lt=today).values_list('plant_id', flat=True))
    if key == 'open_tickets':
        return set(open_tickets.values_list('plant_id', flat=True))
    if key == 'critical_tickets':
        return set(open_tickets.filter(priority='Critical').values_list('plant_id', flat=True))
    if key == 'no_pending_complaints':
        return set(plants.exclude(id__in=open_tickets.values('plant_id')).values_list('id', flat=True))
    if key == 'free_service':
        return set(plants.filter(om_status__in=FREE_STATUSES).values_list('id', flat=True))
    if key == 'free_expiring':
        return set(plants.filter(
            om_status__in=FREE_STATUSES, free_service_end__gte=today,
            free_service_end__lte=today + timedelta(days=FREE_SERVICE_ALERT_DAYS),
        ).values_list('id', flat=True))
    if key == 'free_expired':
        return set(plants.filter(om_status='Free Service Expired').values_list('id', flat=True))
    if key == 'paid':
        return set(plants.filter(om_status__in=PAID_STATUSES).values_list('id', flat=True))
    if key == 'active':
        return set(plants.filter(is_active=True).values_list('id', flat=True))
    if key in ('insurance_active', 'insurance_expiring', 'insurance_expired'):
        wanted = key.split('_', 1)[1]
        return {pid for pid, state in insurance_states(today).items() if state == wanted}
    if key == 'not_insured':
        insured = set(insurance_states(today))
        return set(plants.exclude(id__in=insured).values_list('id', flat=True))
    return None


def filter_plants(qs, params):
    today = date.today()
    key = params.get('filter')
    if key:
        ids = plant_ids_for(key, today)
        if ids is not None:
            qs = qs.filter(id__in=ids)
    if params.get('om_status'):
        qs = qs.filter(om_status=params['om_status'])
    if params.get('engineer'):
        engineer = params['engineer']
        qs = qs.filter(
            Q(tasks__assigned_engineer_id=engineer) | Q(tickets__assigned_to_id=engineer)
        ).distinct()
    if params.get('date_from'):
        qs = qs.filter(commissioning_date__gte=params['date_from'])
    if params.get('date_to'):
        qs = qs.filter(commissioning_date__lte=params['date_to'])
    if params.get('capacity_min'):
        qs = qs.filter(capacity_kw__gte=params['capacity_min'])
    if params.get('capacity_max'):
        qs = qs.filter(capacity_kw__lte=params['capacity_max'])
    search = (params.get('search') or '').strip()
    if search:
        q = (
            Q(customer_name__icontains=search) | Q(mobile_number__icontains=search)
            | Q(alternate_mobile__icontains=search) | Q(plant_name__icontains=search)
            | Q(plant_location__icontains=search) | Q(city__icontains=search)
            | Q(address__icontains=search) | Q(project__project_id__icontains=search)
            | Q(inverter_serial__icontains=search) | Q(panel_serials__icontains=search)
            | Q(project__sell_invoices__invoice_no__icontains=search)
        )
        upper = search.upper()
        for prefix, field in (('PLT-', 'id'), ('LD-', 'lead_id'), ('CUS-', 'customer_id')):
            if upper.startswith(prefix) and upper[len(prefix):].isdigit():
                q |= Q(**{field: int(upper[len(prefix):])})
        qs = qs.filter(q).distinct()
    return qs


def dashboard_summary(today=None):
    today = today or date.today()
    plants = OmPlant.objects.all()
    open_tasks = _open_tasks().filter(plant__isnull=False)
    task_day = Q(visit_date=today) | Q(visit_date__isnull=True, due_date=today)
    upcoming = (
        Q(visit_date__gt=today, visit_date__lte=today + timedelta(days=UPCOMING_VISIT_DAYS))
        | Q(visit_date__isnull=True, due_date__gt=today, due_date__lte=today + timedelta(days=UPCOMING_VISIT_DAYS))
    )
    ins = insurance_states(today)

    def count(key):
        return len(plant_ids_for(key, today) or ())

    summary = {
        'total_plants': plants.count(),
        'active_plants': plants.filter(is_active=True).count(),
        'free_service_plants': count('free_service'),
        'expired_service_plants': count('free_expired'),
        'paid_plants': count('paid'),
        'service_due': count('service_due'),
        'service_overdue': count('service_overdue'),
        'open_tickets': OmBreakdownTicket.objects.filter(status__in=OmBreakdownTicket.OPEN_STATUSES).count(),
        'critical_complaints': OmBreakdownTicket.objects.filter(
            status__in=OmBreakdownTicket.OPEN_STATUSES, priority='Critical',
        ).count(),
        'todays_tasks': open_tasks.filter(task_day).count(),
        'upcoming_visits': open_tasks.filter(upcoming).count(),
        'insurance_active': sum(1 for s in ins.values() if s == 'active'),
        'insurance_expiring': sum(1 for s in ins.values() if s == 'expiring'),
        'insurance_expired': sum(1 for s in ins.values() if s == 'expired'),
    }
    alerts = {
        'critical': [
            {'key': 'service_overdue', 'label': 'Service overdue', 'count': summary['service_overdue']},
            {'key': 'insurance_expired', 'label': 'Insurance expired', 'count': summary['insurance_expired']},
            {'key': 'critical_tickets', 'label': 'Open critical complaint', 'count': count('critical_tickets')},
            {'key': 'free_expired', 'label': 'Free service expired', 'count': summary['expired_service_plants']},
        ],
        'upcoming': [
            {'key': 'service_due', 'label': f'Service due within {SERVICE_DUE_WINDOW_DAYS} days', 'count': summary['service_due']},
            {'key': 'insurance_expiring', 'label': f'Insurance expiry within {INSURANCE_EXPIRING_DAYS} days', 'count': summary['insurance_expiring']},
            {'key': 'free_expiring', 'label': f'Free service expiry within {FREE_SERVICE_ALERT_DAYS} days', 'count': count('free_expiring')},
        ],
        'active': [
            {'key': 'free_service', 'label': 'Free service active', 'count': summary['free_service_plants']},
            {'key': 'insurance_active', 'label': 'Insurance active', 'count': summary['insurance_active']},
            {'key': 'no_pending_complaints', 'label': 'No pending complaints', 'count': count('no_pending_complaints')},
        ],
    }
    return {'summary': summary, 'alerts': alerts, 'generated_on': today}
