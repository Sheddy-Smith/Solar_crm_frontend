"""Configurable, versioned BOM & pricing master (per plant capacity kW).

Quantities/prices are NOT hardcoded — admins configure Active versions.
Historical quotations/projects keep their bom_version FK and are not rewritten
when a newer BOM version is activated.
"""
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import models
from django.db.models import UniqueConstraint


class BomCapacityConfig(models.Model):
    """One row per supported plant capacity (3/4/5/6 kW + future)."""

    capacity_kw = models.DecimalField(max_digits=8, decimal_places=2, unique=True)
    label = models.CharField(max_length=40, blank=True, default='')
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'capacity_kw']

    def __str__(self):
        return self.label or f'{self.capacity_kw} kW'

    def save(self, *args, **kwargs):
        if not self.label:
            try:
                q = self.capacity_kw
                label_num = str(int(q)) if q == q.to_integral_value() else str(q)
            except Exception:
                label_num = str(self.capacity_kw)
            self.label = f'{label_num} kW'
        super().save(*args, **kwargs)


class BomVersion(models.Model):
    STATUS_DRAFT = 'Draft'
    STATUS_ACTIVE = 'Active'
    STATUS_INACTIVE = 'Inactive'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_ACTIVE, 'Active'),
        (STATUS_INACTIVE, 'Inactive'),
    ]

    capacity_config = models.ForeignKey(
        BomCapacityConfig, on_delete=models.CASCADE, related_name='versions',
    )
    version_number = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    effective_date = models.DateField(null=True, blank=True)
    labour_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    other_charges = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    tax_percent = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0'))
    # Optional fixed project price override (contract price). Empty → derived from materials+labour+tax.
    final_project_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    # True until admin fills real quantities/prices (audit: do not invent BOM values).
    pending_configuration = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_bom_versions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-version_number', '-id']
        constraints = [
            UniqueConstraint(
                fields=['capacity_config', 'version_number'],
                name='uniq_bom_version_per_capacity',
            ),
            # One Active version per capacity is enforced in activate_bom_version()
            # (MySQL does not reliably support conditional unique constraints).
        ]

    def __str__(self):
        return f'{self.capacity_config} v{self.version_number} ({self.status})'

    @property
    def capacity_kw(self):
        return self.capacity_config.capacity_kw

    def materials_subtotal(self) -> Decimal:
        total = Decimal('0')
        for line in self.lines.all():
            total += line.line_total
        return total.quantize(Decimal('0.01'))

    def computed_project_price(self) -> Decimal:
        if self.final_project_price is not None:
            return Decimal(self.final_project_price).quantize(Decimal('0.01'))
        sub = self.materials_subtotal() + Decimal(self.labour_cost or 0) + Decimal(self.other_charges or 0)
        tax = (sub * Decimal(self.tax_percent or 0) / Decimal('100')).quantize(Decimal('0.01'))
        return (sub + tax).quantize(Decimal('0.01'))


class BomLine(models.Model):
    version = models.ForeignKey(BomVersion, on_delete=models.CASCADE, related_name='lines')
    category = models.CharField(max_length=100, blank=True, default='')
    material_name = models.CharField(max_length=200)
    sku = models.CharField(max_length=64, blank=True, default='')
    unit = models.CharField(max_length=20, default='Nos')
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal('0'))
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    sort_order = models.PositiveIntegerField(default=0)
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='bom_lines',
    )

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.material_name} × {self.quantity}'

    @property
    def line_total(self) -> Decimal:
        try:
            return (Decimal(self.quantity or 0) * Decimal(self.unit_price or 0)).quantize(Decimal('0.01'))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal('0')
