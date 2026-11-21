"""Live local E2E: follow-up bumps Recent Leads + task assignment creates notification."""
from __future__ import annotations

import json
import sys
from datetime import timedelta
from pathlib import Path

import django

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.development')
django.setup()

from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.permissions import is_super_admin
from apps.leads.models import Lead
from apps.notifications.models import Notification


def main():
    admin = next((u for u in User.objects.filter(is_active=True).order_by('id')[:20] if is_super_admin(u)), None)
    admin = admin or User.objects.get(pk=1)
    assignee = User.objects.filter(is_active=True).exclude(pk=admin.pk).first()
    assert admin and assignee, 'Need admin + assignee users'

    client = APIClient()
    client.force_authenticate(admin)
    now = timezone.now()

    # --- Task 01: follow-up bumps last_activity_at / recent order ---
    lead_old = Lead.objects.create(
        customer_name='E2E Old Lead',
        mobile_number='7700099001',
        created_by=admin,
        assigned_to=admin,
        status='Follow-up',
        last_activity_at=now - timedelta(hours=6),
    )
    lead_mid = Lead.objects.create(
        customer_name='E2E Mid Lead',
        mobile_number='7700099002',
        created_by=admin,
        assigned_to=admin,
        status='New',
        last_activity_at=now - timedelta(hours=1),
    )

    fu = client.post(
        '/api/v1/follow-ups/',
        {
            'lead': lead_old.id,
            'follow_up_type': 'Call',
            'scheduled_at': now.isoformat(),
            'completed_at': now.isoformat(),
            'status': 'Completed',
            'notes': 'E2E follow-up call',
        },
        format='json',
    )
    assert fu.status_code == 201, fu.data
    lead_old.refresh_from_db()
    assert lead_old.last_activity_at and lead_old.last_activity_at > lead_mid.last_activity_at

    recent = client.get('/api/v1/leads/recent/?limit=10')
    assert recent.status_code == 200, recent.data
    ids = [row['id'] for row in recent.data]
    assert ids[0] == lead_old.id, f'Recent top={ids[0]} expected={lead_old.id} full={ids[:5]}'
    print('PASS Task01: follow-up bumped last_activity_at and Recent Leads order')

    # --- Task 02: assignment notification ---
    before = Notification.objects.filter(user=assignee, category='Task').count()
    assign = client.post(
        '/api/v1/daily-tasks/assignments/',
        {
            'title': 'E2E Assigned Task',
            'description': 'Verify bell + push pipeline',
            'assigned_to': assignee.id,
            'task_date': now.date().isoformat(),
            'due_date': now.date().isoformat(),
            'status': 'Not Completed',
        },
        format='json',
    )
    assert assign.status_code == 201, assign.data
    task_id = assign.data['id']
    rows = list(Notification.objects.filter(user=assignee, category='Task').order_by('-id')[:3])
    assert len(rows) >= before + 1
    latest = rows[0]
    assert latest.dedupe_key == f'staff-task-assigned-{task_id}-{assignee.id}'
    assert 'E2E Assigned Task' in latest.title
    assert latest.link == '/daily-tasks'
    assert assignee.name.split()[0] in latest.message or 'Assigned by' in latest.message

    # Assignee unread API
    aclient = APIClient()
    aclient.force_authenticate(assignee)
    unread = aclient.get('/api/v1/notifications/unread-count/')
    assert unread.status_code == 200
    assert unread.data['count'] >= 1
    listed = aclient.get('/api/v1/notifications/?limit=10&unread=1')
    assert listed.status_code == 200
    titles = [n['title'] for n in listed.data]
    assert any('E2E Assigned Task' in t for t in titles)

    # Outsider must not see private task notification
    outsider = User.objects.filter(is_active=True).exclude(pk__in=[admin.pk, assignee.pk]).first()
    if outsider:
        oclient = APIClient()
        oclient.force_authenticate(outsider)
        olist = oclient.get('/api/v1/notifications/?limit=50&unread=1')
        otitles = [n['title'] for n in olist.data]
        assert not any('E2E Assigned Task' in t for t in otitles)

    # VAPID endpoint availability
    vapid = client.get('/api/v1/notifications/push-vapid-public-key/')
    print('VAPID status', vapid.status_code, vapid.data if vapid.status_code < 500 else '')

    print('PASS Task02: task assignment created assignee-only notification + unread API')
    print(json.dumps({
        'follow_up_id': fu.data['id'],
        'recent_top_lead': ids[0],
        'task_id': task_id,
        'notification_id': latest.id,
        'assignee': assignee.email,
        'unread': unread.data['count'],
        'vapid_configured': vapid.status_code == 200 and bool(vapid.data.get('configured')),
    }, indent=2))


if __name__ == '__main__':
    main()
