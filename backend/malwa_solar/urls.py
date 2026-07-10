from django.contrib import admin
from django.urls import path, include, re_path
from .media_views import secure_media_serve

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
        path('dashboard/', include('apps.dashboard.urls')),
        path('settings/', include('apps.crm_settings.urls')),
    ])),
]

# Media (uploaded documents/photos) is served through an auth-gated view in both
# dev and prod (BUG-047) — Whitenoise only serves static files, not uploads, so
# this route is required in production too. (Note: the host's filesystem is
# ephemeral — uploads still need external storage such as S3 to survive redeploys.)
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', secure_media_serve),
]
