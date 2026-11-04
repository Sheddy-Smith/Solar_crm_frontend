"""Local checks for multi-device / concurrent-user capacity knobs."""
from django.conf import settings
from django.test import SimpleTestCase


class CapacityLimitSettingsTests(SimpleTestCase):
    def test_throttle_rates_support_multi_device_accounts(self):
        rates = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
        self.assertEqual(rates['login'], '40/min')
        self.assertEqual(rates['anon'], '200/min')
        self.assertEqual(rates['user'], '750/min')

    def test_gunicorn_defaults_raise_in_flight_capacity(self):
        import importlib.util
        from pathlib import Path

        conf_path = Path(__file__).resolve().parents[1] / 'gunicorn.conf.py'
        spec = importlib.util.spec_from_file_location('gunicorn_conf_under_test', conf_path)
        mod = importlib.util.module_from_spec(spec)
        # Clear overrides so file defaults are what we assert.
        import os
        os.environ.pop('WEB_CONCURRENCY', None)
        os.environ.pop('GUNICORN_THREADS', None)
        spec.loader.exec_module(mod)
        # Conservative 1-vCPU defaults; larger boxes raise via env only.
        self.assertEqual(mod.workers, 2)
        self.assertEqual(mod.threads, 2)
        self.assertEqual(mod.worker_class, 'sync')
        self.assertGreaterEqual(mod.workers * mod.threads, 4)
