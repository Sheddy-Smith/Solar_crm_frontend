from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include([
        path('', include('apps.accounts.urls')),
        path('', include('apps.leads.urls')),
        path('', include('apps.projects.urls')),
        path('inventory/', include('apps.inventory.urls')),
        path('accounts/', include('apps.accounts_module.urls')),
        path('workforce/', include('apps.workforce.urls')),
        path('liaison/', include('apps.liaisoning.urls')),
        path('om/', include('apps.om.urls')),
        path('amc/', include('apps.amc.urls')),
        path('reports/', include('apps.reports.urls')),
        path('settings/', include('apps.crm_settings.urls')),
    ])),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
