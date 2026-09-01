from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, F, Max, Sum, Q
from django.utils import timezone

from apps.projects.models import SequenceCounter


def next_item_code():
    from .models import InventoryItem

    max_id = InventoryItem.objects.aggregate(m=Max('id'))['m'] or 0
    with transaction.atomic():
        counter, created = SequenceCounter.objects.select_for_update().get_or_create(
            key='ITEM', defaults={'value': max_id},
        )
        if not created and counter.value < max_id:
            counter.value = max_id
            counter.save(update_fields=['value'])
    num = SequenceCounter.next_value('ITEM', initial=max_id)
    return f'ITEM-{num:04d}'


def inventory_summary():
    from .models import InventoryItem, StockMovement

    qs = InventoryItem.objects.filter(is_active=True)
    total_value = qs.aggregate(val=Sum(F('current_stock') * F('rate')))['val'] or 0

    by_unit = list(
        qs.values('unit')
        .annotate(total=Sum('current_stock'))
        .order_by('unit')
    )
    for row in by_unit:
        row['total'] = float(row['total'] or 0)

    by_category = list(
        qs.values('category')
        .annotate(count=Count('id'), stock=Sum('current_stock'))
        .order_by('-count')[:12]
    )

    cutoff = timezone.now() - timedelta(days=15)
    stale_items = (
        InventoryItem.objects.filter(is_active=True, current_stock__gt=0)
        .exclude(movements__created_at__gte=cutoff)
        .count()
    )

    movement_qs = StockMovement.objects.all()
    total_movements = movement_qs.count()

    in_rows = (
        movement_qs.filter(movement_type='Inward')
        .values('item__unit')
        .annotate(total=Sum('quantity'))
    )
    out_rows = (
        movement_qs.filter(movement_type='Outward')
        .values('item__unit')
        .annotate(total=Sum('quantity'))
    )

    def unit_map(rows):
        return {r['item__unit'] or 'Nos': float(r['total'] or 0) for r in rows}

    def alert_row(item):
        return {
            'id': item.id,
            'name': item.name,
            'item_code': item.item_code or '',
            'category': item.category or '',
            'current_stock': float(item.current_stock or 0),
            'minimum_stock': float(item.minimum_stock or 0),
            'unit': item.unit or 'Nos',
            'warehouse_name': item.warehouse.name if item.warehouse_id else '',
        }

    critical_qs = qs.filter(current_stock__lte=0).select_related('warehouse').order_by('name')
    warning_qs = qs.filter(current_stock__lte=F('minimum_stock'), current_stock__gt=0).select_related('warehouse').order_by('current_stock', 'name')
    stable_qs = qs.filter(current_stock__gt=F('minimum_stock')).select_related('warehouse').order_by('-current_stock', 'name')

    return {
        'total_items': qs.count(),
        'low_stock': warning_qs.count(),
        'out_of_stock': critical_qs.count(),
        'stable_stock': stable_qs.count(),
        'total_value': float(total_value),
        'by_unit': by_unit,
        'by_category': by_category,
        'stale_stock_items': stale_items,
        'total_movements': total_movements,
        'stock_in_by_unit': unit_map(in_rows),
        'stock_out_by_unit': unit_map(out_rows),
        'alerts': {
            'critical': [alert_row(i) for i in critical_qs[:12]],
            'warning': [alert_row(i) for i in warning_qs[:12]],
            'stable': [alert_row(i) for i in stable_qs[:12]],
            'critical_count': critical_qs.count(),
            'warning_count': warning_qs.count(),
            'stable_count': stable_qs.count(),
        },
    }


def movement_analytics(date_from=None, date_to=None, movement_type=None, reference_type=None, search=None):
    from .models import StockMovement

    qs = StockMovement.objects.select_related('item', 'from_warehouse', 'to_warehouse')
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    if movement_type and movement_type != 'All':
        qs = qs.filter(movement_type=movement_type)
    if reference_type and reference_type != 'All':
        qs = qs.filter(reference_type=reference_type)
    if search:
        qs = qs.filter(
            Q(item__name__icontains=search)
            | Q(item__item_code__icontains=search)
            | Q(item__category__icontains=search)
            | Q(reference_no__icontains=search)
            | Q(notes__icontains=search)
        )

    total = qs.count()
    in_by_unit = unit_totals(qs.filter(movement_type='Inward'))
    out_by_unit = unit_totals(qs.filter(movement_type='Outward'))

    cutoff = timezone.now() - timedelta(days=15)
    stale = (
        qs.filter(created_at__lt=cutoff, movement_type='Inward')
        .values('item_id')
        .distinct()
        .count()
    )

    return {
        'total_movements': total,
        'stock_in_by_unit': in_by_unit,
        'stock_out_by_unit': out_by_unit,
        'stale_inward_items': stale,
    }


def unit_totals(qs):
    rows = qs.values('item__unit').annotate(total=Sum('quantity'))
    return {r['item__unit'] or 'Nos': float(r['total'] or 0) for r in rows}


DEFAULT_CATEGORIES = [
    ('Structure', 'Mounting structures, rails, and packing units'),
    ('Electrical', 'Cables, connectors, ACDB/DCDB, hardware'),
    ('Invertor', 'On-grid, off-grid and hybrid inverters'),
    ('Panel', 'PV modules and solar panels'),
    ('Battery', 'Storage batteries (LFP / LTB / Lead Acid)'),
    ('Solar Panel', 'Legacy alias for panels'),
    ('Inverter', 'Legacy alias for inverters'),
    ('Cable & Wire', 'DC/AC cables and wiring'),
    ('ACDB/DCDB', 'Distribution boxes'),
    ('Steel', 'Angle, channel, sheet, pipe etc.'),
    ('Hardware', 'Nuts, bolts, fasteners, consumables'),
    ('Other', 'Miscellaneous items'),
]


def seed_inventory_categories():
    from .models import InventoryCategory

    template_for = {
        'Structure': 'Structure',
        'Electrical': 'Electrical',
        'Invertor': 'Invertor',
        'Panel': 'Panel',
        'Battery': 'Battery',
        'Solar Panel': 'Panel',
        'Inverter': 'Invertor',
    }
    for name, description in DEFAULT_CATEGORIES:
        obj, created = InventoryCategory.objects.get_or_create(
            name=name,
            defaults={
                'description': description,
                'form_template': template_for.get(name, 'Generic'),
            },
        )
        if not created and not obj.form_template:
            obj.form_template = template_for.get(name, 'Generic')
            obj.save(update_fields=['form_template'])
