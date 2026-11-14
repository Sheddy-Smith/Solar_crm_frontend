"""3 kW Structure & Electrical BOM template — sourced from physical BOM form images.

Outward column = default planned / quotation quantities (NOT warehouse stock).
Blank / dash Outward → quantity 0 (included so planners can enable later).
Split size/spec rows → separate BOM lines with unique material_name.
"""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Any, Optional

TEMPLATE_LABEL = '3 KW – Structure & Electrical BOM'
TEMPLATE_CAPACITY_KW = Decimal('3.00')
TEMPLATE_NOTES = (
    'Seeded from physical 3 kW B.O.M. FORM (Structure & Electrical) Outward column. '
    'Quantities are material requirements, not opening stock.'
)

# Inventory master names (must match Product Master / prior BOM product seed).
# unit_form: printed form unit; unit_inventory: InventoryItem.unit
#
# Each row: dict with keys used by seed_3kw_structure_electrical_bom.
# qty=None means "include with 0 and mark as not required / blank outward".
BOM_3KW_LINES: list[dict[str, Any]] = [
    # --- Page 1 (Sr 1–29) ---
    {'sr': 1, 'material_name': 'Base Plate 150x150mm', 'inventory_name': 'Base Plate 150x150mm',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': '—'},
    {'sr': 2, 'material_name': 'Base Plate 200x200mm', 'inventory_name': 'Base Plate 200x200mm',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('4'), 'outward': '4'},
    # Pole Superstructure: two lengths on form (7' and 9') → two lines, same inventory SKU.
    {'sr': 3, 'material_name': "Pole Superstructure 7 ft", 'inventory_name': 'Pole Superstructure',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('2'), 'outward': "2 (7')",
     'sku': "7ft", 'needs_verification': True,
     'verification_note': 'Form marks 150x40x15 / 170x50x15 and Sigma/Plane — confirm exact pole profile.'},
    {'sr': 3, 'material_name': "Pole Superstructure 9 ft", 'inventory_name': 'Pole Superstructure',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('2'), 'outward': "2 (9')",
     'sku': "9ft", 'needs_verification': True,
     'verification_note': 'Form marks 150x40x15 / 170x50x15 and Sigma/Plane — confirm exact pole profile.'},
    {'sr': 4, 'material_name': 'Pole C Channel', 'inventory_name': 'Pole C Channel',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 5, 'material_name': 'C Channel 80x40 3900mm', 'inventory_name': 'C Channel 80x40',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1 (3900)', 'sku': '3900'},
    {'sr': 5, 'material_name': 'C Channel 80x40 4400mm', 'inventory_name': 'C Channel 80x40',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1 (4400)', 'sku': '4400'},
    {'sr': 6, 'material_name': 'Strut Channel 41x41 3600mm', 'inventory_name': 'Strut Channel 41x41',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('4'), 'outward': '4 (3600)', 'sku': '3600'},
    {'sr': 6, 'material_name': 'Strut Channel 41x41 Support 3600mm', 'inventory_name': 'Strut Channel 41x41 Support',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1 (Support 3600)', 'sku': 'support-3600'},
    # Hilti / Fisher shared form row — one outward "1"; map Hilti, flag Fisher choice.
    {'sr': 7, 'material_name': 'Hilti Chemical', 'inventory_name': 'Hilti Chemical',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1',
     'needs_verification': True,
     'verification_note': 'Form row is "Hilti Chemical / Fisher & Nozal" with single Outward 1 — confirm brand.'},
    {'sr': 8, 'material_name': 'Fastener 10x100mm', 'inventory_name': 'Fastener 10x100mm',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': '—'},
    {'sr': 8, 'material_name': 'Fastener 10x150mm', 'inventory_name': 'Fastener 10x150mm',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': '—'},
    {'sr': 9, 'material_name': 'Thread Rod M10', 'inventory_name': 'Thread Rod M10',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('2'), 'outward': '2'},
    {'sr': 10, 'material_name': 'M10 Nut GI', 'inventory_name': 'M10 Nut GI',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('40'), 'outward': '40'},
    {'sr': 10, 'material_name': 'M10 Washer GI', 'inventory_name': 'M10 Washer GI',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('40'), 'outward': '40'},
    {'sr': 11, 'material_name': 'Nut Bolt Washer Set GI M10x25', 'inventory_name': 'Nut Bolt Washer Set GI M10x25',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('35'), 'outward': '35'},
    {'sr': 12, 'material_name': 'End Clamp 30-35mm', 'inventory_name': 'End Clamp 30-35mm',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('12'), 'outward': '12'},
    # Mid Clamp size ambiguous on form (3MM / 5MM) with single qty 12.
    {'sr': 13, 'material_name': 'Mid Clamp 3mm', 'inventory_name': 'Mid Clamp 3mm',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('12'), 'outward': '12',
     'needs_verification': True,
     'verification_note': 'Form lists Mid Clamp 3MM / 5MM with one Outward 12 — confirm thickness.'},
    {'sr': 14, 'material_name': 'Spring Nut M8 GI', 'inventory_name': 'Spring Nut M8 GI',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('24'), 'outward': '24'},
    {'sr': 15, 'material_name': 'Head Allen Key SS', 'inventory_name': 'Head Allen Key SS',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('24'), 'outward': '24'},
    {'sr': 16, 'material_name': 'Silver Aluminium Paint', 'inventory_name': 'Silver Aluminium Paint',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': '—'},
    {'sr': 17, 'material_name': 'ACDB', 'inventory_name': 'ACDB',
     'category': 'ACDB/DCDB', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1'},
    {'sr': 18, 'material_name': 'DCDB', 'inventory_name': 'DCDB',
     'category': 'ACDB/DCDB', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1'},
    {'sr': 19, 'material_name': 'Lugs Ring Type Cu 10sqmm', 'inventory_name': 'Lugs Ring Type Cu 10sqmm',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('2'), 'outward': '2'},
    {'sr': 20, 'material_name': 'Lugs Ring Type Al 10sqmm', 'inventory_name': 'Lugs Ring Type Al 10sqmm',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('2'), 'outward': '2'},
    {'sr': 21, 'material_name': 'Lugs Ring Type Al 16sqmm', 'inventory_name': 'Lugs Ring Type Al 16sqmm',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('2'), 'outward': '2'},
    {'sr': 22, 'material_name': 'Copper Wire 2.5sqmm Black', 'inventory_name': 'Copper Wire 2.5sqmm Black',
     'category': 'Cable & Wire', 'unit': 'Meter', 'qty': Decimal('40'), 'outward': '40', 'unit_form': 'MTR'},
    {'sr': 23, 'material_name': 'Copper Wire 2.5sqmm Red', 'inventory_name': 'Copper Wire 2.5sqmm Red',
     'category': 'Cable & Wire', 'unit': 'Meter', 'qty': Decimal('40'), 'outward': '40', 'unit_form': 'MTR'},
    {'sr': 24, 'material_name': 'AC Cu Cable 3 Core 2.5sqmm', 'inventory_name': 'AC Cu Cable 3 Core 2.5sqmm',
     'category': 'Cable & Wire', 'unit': 'Meter', 'qty': Decimal('1.5'), 'outward': '1.5', 'unit_form': 'MTR'},
    {'sr': 25, 'material_name': 'Copper Wire 4sqmm Black', 'inventory_name': 'Copper Wire 4sqmm Black',
     'category': 'Cable & Wire', 'unit': 'Meter', 'qty': Decimal('0'), 'outward': '', 'unit_form': 'MTR'},
    {'sr': 26, 'material_name': 'Copper Wire 4sqmm Red', 'inventory_name': 'Copper Wire 4sqmm Red',
     'category': 'Cable & Wire', 'unit': 'Meter', 'qty': Decimal('0'), 'outward': '', 'unit_form': 'MTR'},
    {'sr': 27, 'material_name': 'AC Cu Cable 3 Core 4sqmm', 'inventory_name': 'AC Cu Cable 3 Core 4sqmm',
     'category': 'Cable & Wire', 'unit': 'Meter', 'qty': Decimal('0'), 'outward': '', 'unit_form': 'MTR'},
    {'sr': 28, 'material_name': 'DC Wire 4sqmm Black', 'inventory_name': 'DC Wire 4sqmm Black',
     'category': 'Cable & Wire', 'unit': 'Meter', 'qty': Decimal('30'), 'outward': '30', 'unit_form': 'MTR'},
    {'sr': 29, 'material_name': 'DC Wire 4sqmm Red', 'inventory_name': 'DC Wire 4sqmm Red',
     'category': 'Cable & Wire', 'unit': 'Meter', 'qty': Decimal('30'), 'outward': '30', 'unit_form': 'MTR'},

    # --- Page 2 (Sr 30–64); empty Sr 65–70 skipped ---
    {'sr': 30, 'material_name': 'Al. Earth Wire 10sqmm / Cu 2.5sqmm', 'inventory_name': 'Al. Earth Wire 10sqmm / Cu 2.5sqmm',
     'category': 'Cable & Wire', 'unit': 'Meter', 'qty': Decimal('80'), 'outward': '80', 'unit_form': 'MTR'},
    {'sr': 31, 'material_name': 'Al. Earth Wire 16sqmm', 'inventory_name': 'Al. Earth Wire 16sqmm',
     'category': 'Cable & Wire', 'unit': 'Meter', 'qty': Decimal('40'), 'outward': '40', 'unit_form': 'MTR'},
    {'sr': 32, 'material_name': 'MC4 Connector', 'inventory_name': 'MC4 Connector',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('4'), 'outward': '4'},
    # Insulation Tape "1, 1" — two rolls; colours not specified on Outward.
    {'sr': 33, 'material_name': 'Insulation Tape Red', 'inventory_name': 'Insulation Tape Red',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1',
     'needs_verification': True,
     'verification_note': 'Form Outward "1, 1" across R/Y/BL/B/W/G — confirm which two colours (defaulted Red+Black).'},
    {'sr': 33, 'material_name': 'Insulation Tape Black', 'inventory_name': 'Insulation Tape Black',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1',
     'needs_verification': True,
     'verification_note': 'Form Outward "1, 1" across R/Y/BL/B/W/G — confirm which two colours (defaulted Red+Black).'},
    {'sr': 34, 'material_name': 'Cable Tie 150mm', 'inventory_name': 'Cable Tie 150mm',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('100'), 'outward': '100'},
    {'sr': 35, 'material_name': 'Cable Tie 300mm', 'inventory_name': 'Cable Tie 300mm',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('100'), 'outward': '100'},
    {'sr': 36, 'material_name': 'PVC Duct Channel 45x45', 'inventory_name': 'PVC Duct Channel 45x45',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1'},
    {'sr': 37, 'material_name': 'PVC Wall Grip', 'inventory_name': 'PVC Wall Grip',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('25'), 'outward': '25'},
    {'sr': 38, 'material_name': 'PVC Pipe 1" Polycab / Ecomalwa', 'inventory_name': 'PVC Pipe 1" Polycab / Ecomalwa',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('20'), 'outward': '20'},
    {'sr': 39, 'material_name': 'PVC Band 1"', 'inventory_name': 'PVC Band 1"',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('5'), 'outward': '5'},
    {'sr': 40, 'material_name': 'PVC Elbow 1"', 'inventory_name': 'PVC Elbow 1"',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('50'), 'outward': '50'},
    {'sr': 41, 'material_name': 'PVC T 1"', 'inventory_name': 'PVC T 1"',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('5'), 'outward': '5'},
    {'sr': 42, 'material_name': 'D-Clip 25mm Double', 'inventory_name': 'D-Clip 25mm Double',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('100'), 'outward': '100'},
    {'sr': 43, 'material_name': 'D-Clip 25mm Single', 'inventory_name': 'D-Clip 25mm Single',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('100'), 'outward': '100'},
    {'sr': 44, 'material_name': 'Bombay Kheel 50mm', 'inventory_name': 'Bombay Kheel 50mm',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('5'), 'outward': '5'},
    # Jadu Screw & Washer "25, 25" → one kit product qty 25 (screw+washer set).
    {'sr': 45, 'material_name': 'Jadu Screw 50mm & Washer', 'inventory_name': 'Jadu Screw 50mm & Washer',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('25'), 'outward': '25, 25',
     'needs_verification': True,
     'verification_note': 'Form shows 25, 25 (screw + washer). Mapped as 25 sets of combined product.'},
    {'sr': 46, 'material_name': 'Solar Panel DCR', 'inventory_name': 'Solar Panel DCR',
     'category': 'Solar Panel', 'unit': 'Nos', 'qty': Decimal('5'), 'outward': '5 (DCR)'},
    {'sr': 47, 'material_name': 'Solar Inverter 3kW', 'inventory_name': 'Solar Inverter 3kW',
     'category': 'Inverter', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1 (3kW)'},
    {'sr': 48, 'material_name': 'Earthing Electrode CB 14mmx1000mm', 'inventory_name': 'Earthing Electrode CB 14mmx1000mm',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': '—'},
    # 17X1200/1500 with qty 3 — length ambiguous.
    {'sr': 49, 'material_name': 'Earthing Electrode CB 17x1500mm', 'inventory_name': 'Earthing Electrode CB 17x1500mm',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('3'), 'outward': '3',
     'needs_verification': True,
     'verification_note': 'Form lists CB 17X1200/1500mm with Outward 3 — confirm 1200 vs 1500mm.'},
    {'sr': 50, 'material_name': 'Lightning Arrestor CB 14x1 Mtr Multi', 'inventory_name': 'Lightning Arrestor CB 14x1 Mtr Multi',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1'},
    {'sr': 51, 'material_name': 'Earthing Chemical Bag 25kg', 'inventory_name': 'Earthing Chemical Bag 25kg',
     'category': 'Electrical', 'unit': 'Nos', 'qty': Decimal('1'), 'outward': '1 (25 KG)'},
    {'sr': 52, 'material_name': 'U Channel Stand', 'inventory_name': 'U Channel Stand',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 53, 'material_name': 'Chaddar Base', 'inventory_name': 'Chaddar Base',
     'category': 'Structure', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    # J-Bolt / SDS / Nut / Washer / Civil — blank outward on this 3 kW sheet.
    {'sr': 54, 'material_name': 'J Bolt 40x100', 'inventory_name': 'J Bolt 40x100',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 54, 'material_name': 'J Bolt 40x125', 'inventory_name': 'J Bolt 40x125',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 54, 'material_name': 'J Bolt 40x150', 'inventory_name': 'J Bolt 40x150',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 55, 'material_name': 'J Bolt 50x100', 'inventory_name': 'J Bolt 50x100',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 55, 'material_name': 'J Bolt 50x150', 'inventory_name': 'J Bolt 50x150',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 56, 'material_name': 'J Bolt Angle 125mm', 'inventory_name': 'J Bolt Angle 125mm',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 56, 'material_name': 'J Bolt Angle 150mm', 'inventory_name': 'J Bolt Angle 150mm',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 57, 'material_name': 'SDS 25mm', 'inventory_name': 'SDS 25mm',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 57, 'material_name': 'SDS 50mm', 'inventory_name': 'SDS 50mm',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 57, 'material_name': 'SDS 65mm', 'inventory_name': 'SDS 65mm',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 58, 'material_name': 'M8 Nut', 'inventory_name': 'M8 Nut',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 58, 'material_name': 'M9 Nut', 'inventory_name': 'M9 Nut',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 59, 'material_name': 'Chaddar Washer', 'inventory_name': 'Chaddar Washer',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 59, 'material_name': 'Damar Washer', 'inventory_name': 'Damar Washer',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 60, 'material_name': 'Silicon', 'inventory_name': 'Silicon',
     'category': 'Hardware', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 61, 'material_name': 'Baalu', 'inventory_name': 'Baalu',
     'category': 'Other', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 62, 'material_name': 'Gitti', 'inventory_name': 'Gitti',
     'category': 'Other', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 63, 'material_name': 'Cement', 'inventory_name': 'Cement',
     'category': 'Other', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
    {'sr': 64, 'material_name': 'Suttering (Frame)', 'inventory_name': 'Suttering (Frame)',
     'category': 'Other', 'unit': 'Nos', 'qty': Decimal('0'), 'outward': ''},
]


def norm_name(value: str) -> str:
    text = (value or '').strip().casefold()
    text = re.sub(r'\s+', ' ', text)
    text = text.replace('×', 'x').replace('–', '-').replace('—', '-')
    return text


def resolve_lead_capacity_kw(lead) -> Optional[Decimal]:
    """Detect capacity from estimated_capacity first, then project_name (e.g. '3 KW …')."""
    from .bom_services import parse_capacity_kw

    for raw in (
        getattr(lead, 'estimated_capacity', None),
        getattr(lead, 'project_name', None),
    ):
        kw = parse_capacity_kw(raw)
        if kw is not None:
            return kw
    return None


def lead_project_cost_amount(lead) -> Optional[Decimal]:
    """Return positive Project Cost from Lead, else None (do not invent)."""
    raw = getattr(lead, 'project_cost', None)
    if raw is None or raw == '':
        return None
    try:
        amount = Decimal(str(raw))
    except Exception:
        return None
    if amount <= 0:
        return None
    return amount.quantize(Decimal('0.01'))


def inventory_unit_price(item) -> Decimal:
    """Prefer selling_price, else rate — never invent non-zero when both empty."""
    if item is None:
        return Decimal('0.00')
    for attr in ('selling_price', 'rate'):
        val = getattr(item, attr, None)
        if val is None:
            continue
        try:
            amount = Decimal(str(val))
        except Exception:
            continue
        if amount > 0:
            return amount.quantize(Decimal('0.01'))
    return Decimal('0.00')
