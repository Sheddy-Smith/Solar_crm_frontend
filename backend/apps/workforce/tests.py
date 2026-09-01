from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.workforce.models import Employee, EmployeeAttendance
from apps.workforce.services import attendance_ledger_payload, local_today


class AttendanceMarkByDateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user(
            'wf@test.com',
            'Workforce Editor',
            {'Employee': {'can_view': True, 'can_add': True, 'can_edit': True}},
        )
        self.client.force_authenticate(self.user)
        self.employee = Employee.objects.create(name='Ravi Kumar', daily_rate=900)

    def test_mark_by_date_creates_attendance_row(self):
        target = date(2026, 7, 10)
        res = self.client.post('/api/v1/workforce/attendance/mark-by-date/', {
            'employee': self.employee.id,
            'date': target.isoformat(),
            'status': 'Present',
            'hours': 8,
            'ot_hours': 1,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'Present')
        self.assertEqual(res.data['hours'], '8.00')

        record = EmployeeAttendance.objects.get(employee=self.employee, date=target)
        self.assertEqual(record.status, 'Present')
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.present_days, 1)

    def test_mark_by_date_upserts_existing_row(self):
        target = date(2026, 7, 11)
        EmployeeAttendance.objects.create(
            employee=self.employee,
            date=target,
            status='Absent',
        )
        res = self.client.post('/api/v1/workforce/attendance/mark-by-date/', {
            'employee': self.employee.id,
            'date': target.isoformat(),
            'status': 'Present',
            'hours': 9,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(EmployeeAttendance.objects.filter(employee=self.employee, date=target).count(), 1)
        record = EmployeeAttendance.objects.get(employee=self.employee, date=target)
        self.assertEqual(record.status, 'Present')

    def test_mark_by_date_requires_employee_and_date(self):
        res = self.client.post('/api/v1/workforce/attendance/mark-by-date/', {'status': 'Present'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('employee and date', res.data['detail'])

    @patch('apps.workforce.views.attendance_date_allowed', return_value=False)
    def test_mark_by_date_rejects_future_date(self, _allowed):
        res = self.client.post('/api/v1/workforce/attendance/mark-by-date/', {
            'employee': self.employee.id,
            'date': '2099-12-31',
            'status': 'Present',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('future', res.data['detail'].lower())


class AttendanceLedgerFutureTests(TestCase):
    def setUp(self):
        self.user = make_user('ledger@test.com', 'Ledger Viewer', {'Employee': {'full_access': True}})
        self.employee = Employee.objects.create(name='Ridvan Hussain', daily_rate=Decimal('800.00'))

    @patch('apps.workforce.services.local_today')
    def test_ledger_excludes_future_present_from_totals(self, mock_today):
        mock_today.return_value = date(2026, 9, 1)
        # Erroneous future rows (bug scenario)
        for day in range(1, 31):
            EmployeeAttendance.objects.create(
                employee=self.employee,
                date=date(2026, 9, day),
                status='Present',
                hours=Decimal('9.00'),
                payment=Decimal('800.00'),
            )
        payload = attendance_ledger_payload(
            self.employee,
            date(2026, 9, 1),
            date(2026, 9, 30),
            self.user,
        )
        self.assertEqual(payload['summary']['present_days'], 1)
        self.assertEqual(payload['summary']['period_earning'], '800.00')
        future_rows = [r for r in payload['records'] if r['date'] > '2026-09-01']
        self.assertTrue(all(r['status'] == 'Not Marked' for r in future_rows))
        self.assertTrue(all(r['payment'] == '0.00' for r in future_rows))
        # DB should be sanitized on load
        self.assertEqual(
            EmployeeAttendance.objects.filter(
                employee=self.employee, date__gt=date(2026, 9, 1), status='Present',
            ).count(),
            0,
        )
