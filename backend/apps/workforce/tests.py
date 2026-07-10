from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import make_user
from apps.workforce.models import Employee, EmployeeAttendance


class AttendanceMarkByDateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user(
            'wf@test.com',
            'Workforce Editor',
            {'Workforce': {'can_view': True, 'can_add': True, 'can_edit': True}},
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
