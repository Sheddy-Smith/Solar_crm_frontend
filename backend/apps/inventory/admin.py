from django.contrib import admin
from .models import InventoryItem, StockMovement, Warehouse
admin.site.register([InventoryItem, StockMovement, Warehouse])
