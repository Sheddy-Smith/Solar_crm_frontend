from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include, re_path
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET
from .media_views import secure_media_serve


# Keep-alive target for the frontend's silent 14-minute ping (Render free tier
# sleeps after 15 idle minutes). Plain Django view on purpose: no DRF auth,
# throttling or DB query — just an HTTP 200.
@never_cache
@require_GET
def health(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/health/', health),
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
        path('daily-tasks/', include('apps.daily_tasks.urls')),
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
