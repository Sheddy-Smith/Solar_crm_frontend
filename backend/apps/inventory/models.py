from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import F

from apps.accounts.models import User


class Warehouse(models.Model):
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class InventoryItem(models.Model):
    CATEGORY_CHOICES = [
        ('Solar Panel', 'Solar Panel'),
        ('Inverter', 'Inverter'),
        ('Battery', 'Battery'),
        ('Structure', 'Structure'),
        ('Cable & Wire', 'Cable & Wire'),
        ('ACDB/DCDB', 'ACDB/DCDB'),
        ('Other', 'Other'),
    ]
    UNIT_CHOICES = [
        ('Nos', 'Nos'),
        ('Meter', 'Meter'),
        ('Kg', 'Kg'),
        ('Roll', 'Roll'),
        ('Set', 'Set'),
    ]

    name = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='Other')
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='Nos')
    hsn_code = models.CharField(max_length=20, blank=True)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    minimum_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class StockMovement(models.Model):
    TYPE_CHOICES = [
        ('Inward', 'Inward'),
        ('Outward', 'Outward'),
        ('Transfer', 'Transfer'),
        ('Adjustment', 'Adjustment'),
    ]

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    from_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='outgoing',
    )
    to_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incoming',
    )
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def _stock_delta(movement_type, quantity, to_warehouse_id=None, from_warehouse_id=None):
        if movement_type == 'Inward':
            return quantity
        if movement_type == 'Outward':
            return -quantity
        if movement_type == 'Transfer':
            return 0
        if movement_type == 'Adjustment':
            if to_warehouse_id:
                return quantity
            if from_warehouse_id:
                return -quantity
        return 0

    def save(self, *args, **kwargs):
        is_create = self._state.adding
        with transaction.atomic():
            exclude = ['created_by'] if self.created_by_id is None else None
            self.full_clean(exclude=exclude)

            previous = None
            if not is_create:
                previous = StockMovement.objects.select_for_update().get(pk=self.pk)

            item = InventoryItem.objects.select_for_update().get(pk=self.item_id)
            previous_delta = 0 if previous is None else self._stock_delta(
                previous.movement_type, previous.quantity,
                previous.to_warehouse_id, previous.from_warehouse_id,
            )

            # If the movement was re-pointed at a different item, the old
            # delta must be reverted on the OLD item, not subtracted here.
            old_item = None
            if previous is not None and previous.item_id != self.item_id:
                old_item = InventoryItem.objects.select_for_update().get(pk=previous.item_id)
                reverted_old_stock = old_item.current_stock - previous_delta
                if reverted_old_stock < 0:
                    raise ValidationError({'item': 'Reverting this movement would make the original item stock negative.'})
                previous_delta = 0

            new_delta = self._stock_delta(
                self.movement_type, self.quantity,
                self.to_warehouse_id, self.from_warehouse_id,
            )
            updated_stock = item.current_stock - previous_delta + new_delta

            if updated_stock < 0:
                raise ValidationError({'quantity': 'Insufficient stock for this movement.'})

            super().save(*args, **kwargs)
            if old_item is not None:
                old_item.current_stock = reverted_old_stock
                old_item.save(update_fields=['current_stock'])
            item.current_stock = updated_stock
            item.save(update_fields=['current_stock'])

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            item = InventoryItem.objects.select_for_update().get(pk=self.item_id)
            delta = self._stock_delta(
                self.movement_type, self.quantity,
                self.to_warehouse_id, self.from_warehouse_id,
            )
            updated_stock = item.current_stock - delta
            if updated_stock < 0:
                raise ValidationError({'quantity': 'Deleting this movement would result in negative stock.'})

            super().delete(*args, **kwargs)
            item.current_stock = updated_stock
            item.save(update_fields=['current_stock'])

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Stock Movements'
        constraints = [
            models.CheckConstraint(check=models.Q(quantity__gt=0), name='sm_positive_quantity'),
            models.CheckConstraint(check=models.Q(rate__gte=0), name='sm_non_negative_rate'),
            models.CheckConstraint(
                check=(
                    ~models.Q(movement_type='Inward')
                    | (models.Q(from_warehouse__isnull=True) & models.Q(to_warehouse__isnull=False))
                ),
                name='sm_inward_warehouses',
            ),
            models.CheckConstraint(
                check=(
                    ~models.Q(movement_type='Outward')
                    | (models.Q(from_warehouse__isnull=False) & models.Q(to_warehouse__isnull=True))
                ),
                name='sm_outward_warehouses',
            ),
            models.CheckConstraint(
                check=(
                    ~models.Q(movement_type='Transfer')
                    | (
                        models.Q(from_warehouse__isnull=False)
                        & models.Q(to_warehouse__isnull=False)
                        & ~models.Q(from_warehouse=models.F('to_warehouse'))
                    )
                ),
                name='sm_transfer_warehouses',
            ),
            models.CheckConstraint(
                check=(
                    ~models.Q(movement_type='Adjustment')
                    | models.Q(from_warehouse__isnull=False)
                    | models.Q(to_warehouse__isnull=False)
                ),
                name='sm_adjustment_requires_warehouse',
            ),
        ]
