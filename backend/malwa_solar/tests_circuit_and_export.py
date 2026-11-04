from django.test import SimpleTestCase

from malwa_solar.circuit_breaker import CircuitBreaker, CircuitOpenError


class CircuitBreakerTests(SimpleTestCase):
    def test_opens_after_threshold_and_recovers(self):
        br = CircuitBreaker('t', failure_threshold=2, recovery_timeout=0.01)

        def boom():
            raise RuntimeError('x')

        for _ in range(2):
            with self.assertRaises(RuntimeError):
                br.call(boom)
        self.assertFalse(br.allow())
        import time
        time.sleep(0.02)
        self.assertTrue(br.allow())
        self.assertEqual(br.call(lambda: 7), 7)

    def test_open_raises_circuit_error(self):
        br = CircuitBreaker('t2', failure_threshold=1, recovery_timeout=60)

        def boom():
            raise RuntimeError('x')

        with self.assertRaises(RuntimeError):
            br.call(boom)
        with self.assertRaises(CircuitOpenError):
            br.call(lambda: 1)
