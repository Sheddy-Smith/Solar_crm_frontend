from django.test import SimpleTestCase, override_settings
from django.urls import reverse


class HealthReadyTests(SimpleTestCase):
    def test_health_url_configured(self):
        from malwa_solar.urls import urlpatterns
        paths = []
        for p in urlpatterns:
            try:
                paths.append(p.pattern._route)
            except Exception:
                pass
        self.assertTrue(any('health' in (x or '') for x in paths))
        self.assertTrue(any('ready' in (x or '') for x in paths))

    def test_pagination_max_is_bounded(self):
        from malwa_solar.pagination import DefaultPagination
        self.assertLessEqual(DefaultPagination.max_page_size, 200)

    def test_gunicorn_defaults_are_conservative(self):
        import importlib.util
        import os
        from pathlib import Path
        conf = Path(__file__).resolve().parents[1] / 'gunicorn.conf.py'
        os.environ.pop('WEB_CONCURRENCY', None)
        os.environ.pop('GUNICORN_THREADS', None)
        spec = importlib.util.spec_from_file_location('gconf', conf)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.assertLessEqual(mod.workers, 3)
        self.assertLessEqual(mod.threads, 3)
