from django.contrib import admin
from .models import InventoryCategory, InventoryItem, StockMovement, Warehouse

admin.site.register([InventoryCategory, InventoryItem, StockMovement, Warehouse])
