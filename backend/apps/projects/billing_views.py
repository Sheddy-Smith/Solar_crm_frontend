"""Project Management → Sales Challan / Invoice.

Same SellChallan / SellInvoice records the Accounts module uses (so revenue,
journal and customer ledger stay in one place), but gated by the Project
Management permission and scoped to project-linked documents.
"""
from decimal import Decimal

from django.db.models import Case, IntegerField, Value, When
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import lead_owner_filter
from apps.accounts_module.document_serializers import SellChallanSerializer, SellInvoiceSerializer
from apps.accounts_module.document_services import (
    compute_challan_gst, sync_inventory_for_sell_challan, sync_inventory_for_sell_invoice,
)
from apps.accounts_module.document_views import SellChallanViewSet, SellInvoiceViewSet
from apps.accounts_module.serializers import _user_name
from apps.accounts_module.services import (
    get_or_create_party_for_project, recalculate_party_balance, sync_journal_for_invoice,
)
from apps.leads.models import Quotation

from .models import Project

PROJECT_INFO_FIELDS = [
    'project_code', 'customer_name', 'customer_phone', 'site', 'project_site_address', 'city',
    'capacity_kwp', 'project_type', 'system_type', 'consumer_number', 'discom_name', 'meter_number',
    'manager_name',
]


class _ProjectInfoMixin(serializers.Serializer):
    project_code = serializers.CharField(source='project.project_id', read_only=True)
    customer_name = serializers.CharField(source='project.customer_name', read_only=True)
    customer_phone = serializers.SerializerMethodField()
    site = serializers.CharField(source='project.site', read_only=True)
    project_site_address = serializers.CharField(source='project.site_address', read_only=True)
    city = serializers.CharField(source='project.city', read_only=True)
    capacity_kwp = serializers.DecimalField(source='project.capacity_kwp', max_digits=8, decimal_places=2, read_only=True)
    project_type = serializers.CharField(source='project.project_type', read_only=True)
    system_type = serializers.CharField(source='project.system_type', read_only=True)
    consumer_number = serializers.CharField(source='project.consumer_number', read_only=True)
    discom_name = serializers.CharField(source='project.discom_name', read_only=True)
    meter_number = serializers.CharField(source='project.meter_number', read_only=True)
    manager_name = serializers.SerializerMethodField()

    def get_customer_phone(self, obj):
        lead = obj.project.lead if obj.project_id and obj.project.lead_id else None
        return lead.mobile_number if lead else ''

    def get_manager_name(self, obj):
        manager = obj.project.manager if obj.project_id else None
        return _user_name(manager) if manager else ''

    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = attrs.get('project', getattr(self.instance, 'project', None))
        if project is None:
            raise serializers.ValidationError({'project': 'Select a project.'})
        if not attrs.get('party') and not getattr(self.instance, 'party_id', None):
            attrs['party'] = get_or_create_party_for_project(project)
        if not (attrs.get('party_name') or getattr(self.instance, 'party_name', '')):
            attrs['party_name'] = project.customer_name
        return attrs


class ProjectSalesChallanSerializer(_ProjectInfoMixin, SellChallanSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not (attrs.get('site_address') or getattr(self.instance, 'site_address', '')):
            project = attrs.get('project') or self.instance.project
            attrs['site_address'] = (project.site_address or project.site or '')[:300]
        return attrs

    class Meta(SellChallanSerializer.Meta):
        fields = SellChallanSerializer.Meta.fields + PROJECT_INFO_FIELDS


class ProjectInvoiceSerializer(_ProjectInfoMixin, SellInvoiceSerializer):
    class Meta(SellInvoiceSerializer.Meta):
        fields = SellInvoiceSerializer.Meta.fields + PROJECT_INFO_FIELDS


class _ProjectScopedMixin:
    permission_module = 'Project Management'
    date_field = None

    def get_queryset(self):
        qs = super().get_queryset().select_related('project__lead', 'project__manager').filter(
            project__isnull=False, project__is_deleted=False,
        )
        filt = lead_owner_filter(self.request.user, prefix='project__lead__')
        if filt:
            qs = qs.filter(**filt)
        params = self.request.query_params
        if params.get('project_code'):
            qs = qs.filter(project__project_id__icontains=params['project_code'].strip())
        if params.get('customer'):
            qs = qs.filter(project__customer_name__icontains=params['customer'].strip())
        if params.get('date_from'):
            qs = qs.filter(**{f'{self.date_field}__gte': params['date_from']})
        if params.get('date_to'):
            qs = qs.filter(**{f'{self.date_field}__lte': params['date_to']})
        return qs


def _clip(value, size):
    return ' '.join(str(value or '').split())[:size]


def _qty(value, default=1):
    try:
        qty = Decimal(str(value))
    except Exception:
        return Decimal(default)
    return qty if qty > 0 else Decimal(default)


def _join(*parts, sep=' '):
    return sep.join(str(p).strip() for p in parts if p not in (None, '') and str(p).strip())


def _quotation_spec_lines(q):
    """The quotation's "System Specification" table as zero-rate (included) lines."""
    panel_spec = _join(q.panel_type, f'{q.panel_wattage.normalize():f} Wp' if q.panel_wattage else '')
    inverter_spec = _join(q.inverter_capacity, q.inverter_type, 'On-Grid', q.connection_type)
    structure_spec = q.structure_spec_details or _join(q.structure_type, q.structure_material, q.coating_details)
    rows = [
        ('Solar PV Modules', 'Solar Panel', panel_spec, _join(q.panel_brand, q.panel_model, sep=' / '), q.number_of_panels, 'Nos', True),
        ('Solar Inverter', 'Inverter', inverter_spec, _join(q.inverter_brand, q.inverter_model, sep=' / '), q.inverter_quantity, 'Nos', True),
        ('Module Mounting Structure', 'Structure', structure_spec, q.structure_material, 1, 'Set', True),
        ('Net Metering', 'Net Metering', q.net_meter_details, '', 1, 'Lot', False),
        ('DC Cable', 'Cable', q.dc_cable, '', 1, 'Lot', False),
        ('AC Cable', 'Cable', q.ac_cable, '', 1, 'Lot', False),
        ('ACDB', 'Protection', q.acdb, '', 1, 'Nos', False),
        ('DCDB', 'Protection', q.dcdb, '', 1, 'Nos', False),
        ('Earthing Kit', 'Earthing', q.earthing_kit, '', 1, 'Set', False),
        ('Lightning Arrester', 'Earthing', q.lightning_arrester or q.infra_items, '', 1, 'Nos', False),
        ('MC4 Connectors', 'Accessories', q.mc4_connector or q.connectors, '', 1, 'Set', False),
        ('Cable Tray', 'Accessories', q.cable_tray, '', 1, 'Lot', False),
        ('PVC Pipe', 'Accessories', q.pvc_pipe, '', 1, 'Lot', False),
        ('Govt. Liaisoning', 'Service', q.govt_liasoning_details, '', 1, 'Lot', False),
    ]
    lines = []
    for name, category, spec, brand, qty, unit, always in rows:
        if not (always or spec):
            continue
        lines.append({
            'material_name': name, 'category': category, 'specification': _clip(spec, 300),
            'brand': _clip(brand, 100), 'quantity': _qty(qty), 'unit': unit, 'rate': Decimal('0'),
        })
    return lines


def _split_base_rate(target_total):
    """Taxable value whose 8.9% split GST lands exactly on the quotation total."""
    target = Decimal(target_total).quantize(Decimal('0.01'))
    base = (target / Decimal('1.089')).quantize(Decimal('0.01'))
    for delta in ('0', '-0.01', '0.01', '-0.02', '0.02', '-0.03', '0.03'):
        candidate = base + Decimal(delta)
        gst, _ = compute_challan_gst(candidate, 'Split', 0)
        if candidate + gst == target:
            return candidate
    return base


def quotation_to_challan(q, project=None):
    items = list(q.items.all())
    kw = q.plant_capacity_kw or getattr(project, 'capacity_kwp', None)
    capacity = f'{Decimal(kw).normalize():f} kW ' if kw else ''
    install = q.installation_type or 'Rooftop'
    system_line = {
        'material_name': _clip(f'Supply, Installation, Testing & Commissioning of {capacity}Grid-Tied {install} Solar Power Plant', 200),
        'category': 'Solar Power Plant', 'specification': _clip(q.subject, 300), 'brand': '',
        'quantity': Decimal('1'), 'unit': 'Set',
    }
    item_lines = [{
        'material_name': _clip(it.item_name, 200), 'category': 'Material', 'specification': _clip(it.specification, 300),
        'brand': _clip(it.brand, 100), 'quantity': _qty(it.quantity), 'unit': it.unit or 'Nos', 'rate': it.rate,
    } for it in items]

    if q.use_split_gst and q.project_cost_with_gst:
        gst_mode, gst_percent = 'Split', Decimal('8.9')
        system_line['rate'] = _split_base_rate(q.project_cost_with_gst)
        included = [{**line, 'rate': Decimal('0')} for line in item_lines]
        lines = [system_line, *_quotation_spec_lines(q), *included]
    else:
        gst_percent = q.gst_percent or Decimal('0')
        if q.use_split_gst and gst_percent == Decimal('8.9'):
            gst_mode = 'Split'
        else:
            gst_mode = 'Flat' if gst_percent else 'None'
        cost_rows = [
            ('Material Supply', q.material_cost), ('Structure', q.structure_cost),
            ('Installation & Commissioning', q.installation_cost), ('Transportation', q.transportation_cost),
            ('Liaisoning Charges', q.liaisoning_charges), ('Net Metering Charges', q.net_metering_charges),
            ('Other Charges', q.other_charges),
        ]
        costs = [{
            'material_name': name, 'category': 'Charges', 'specification': '', 'brand': '',
            'quantity': Decimal('1'), 'unit': 'Lot', 'rate': amount,
        } for name, amount in cost_rows if amount]
        priced = item_lines + costs
        if not priced:
            system_line['rate'] = q.subtotal or Decimal('0')
            priced = [system_line]
        lines = [*priced, *_quotation_spec_lines(q)]

    for idx, line in enumerate(lines):
        line.update(section='Main', sort_order=idx)
    return {
        'quotation_id': q.id,
        'quotation_no': q.quotation_number or '',
        'quotation_date': q.quotation_date,
        'quotation_status': q.status,
        'quotation_total': q.project_cost_with_gst if gst_mode == 'Split' else q.grand_total,
        'gst_mode': gst_mode,
        'gst_percent': gst_percent,
        'lines': lines,
    }


class ProjectSalesChallanViewSet(_ProjectScopedMixin, SellChallanViewSet):
    serializer_class = ProjectSalesChallanSerializer
    date_field = 'challan_date'

    def perform_create(self, serializer):
        challan = serializer.save(created_by=self.request.user, source='Project')
        sync_inventory_for_sell_challan(challan, self.request.user)

    @action(detail=False, methods=['get'], url_path='quotation-prefill')
    def quotation_prefill(self, request):
        projects = Project.objects.filter(is_deleted=False)
        filt = lead_owner_filter(request.user, prefix='lead__')
        if filt:
            projects = projects.filter(**filt)
        project = get_object_or_404(projects, pk=request.query_params.get('project'))
        if not project.lead_id:
            return Response({'quotations': [], 'prefill': None})
        quotations = Quotation.objects.filter(lead_id=project.lead_id, is_deleted=False).annotate(
            rank=Case(When(status='Approved', then=Value(0)), When(status='Sent', then=Value(1)),
                      default=Value(2), output_field=IntegerField()),
        ).order_by('rank', '-created_at').prefetch_related('items')
        chosen_id = request.query_params.get('quotation')
        chosen = next((q for q in quotations if str(q.id) == str(chosen_id)), None) if chosen_id else None
        chosen = chosen or next(iter(quotations), None)
        return Response({
            'quotations': [{
                'id': q.id, 'quotation_number': q.quotation_number, 'status': q.status,
                'quotation_date': q.quotation_date,
                'total': q.project_cost_with_gst if q.use_split_gst and q.project_cost_with_gst else q.grand_total,
            } for q in quotations],
            'prefill': quotation_to_challan(chosen, project) if chosen else None,
        })


class ProjectInvoiceViewSet(_ProjectScopedMixin, SellInvoiceViewSet):
    serializer_class = ProjectInvoiceSerializer
    date_field = 'invoice_date'

    def perform_create(self, serializer):
        invoice = serializer.save(created_by=self.request.user, source='Project')
        sync_inventory_for_sell_invoice(invoice, self.request.user)
        sync_journal_for_invoice(invoice, 'sell')
        recalculate_party_balance(invoice.party_id)
