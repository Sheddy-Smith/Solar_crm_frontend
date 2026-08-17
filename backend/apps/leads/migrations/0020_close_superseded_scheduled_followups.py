from django.db import migrations
from django.db.models import Q
from django.utils import timezone


def close_superseded_scheduled(apps, schema_editor):
    FollowUp = apps.get_model('leads', 'FollowUp')
    Lead = apps.get_model('leads', 'Lead')
    now = timezone.now()
    past = FollowUp.objects.filter(
        status='Scheduled', is_deleted=False, scheduled_at__lt=now,
    ).select_related('lead')
    for fu in past:
        superseded = FollowUp.objects.filter(lead_id=fu.lead_id, is_deleted=False).exclude(pk=fu.pk).filter(
            Q(status='Completed', created_at__gte=fu.scheduled_at)
            | Q(status='Completed', completed_at__gte=fu.scheduled_at)
            | Q(status='Scheduled', scheduled_at__gt=fu.scheduled_at)
        ).exists()
        if superseded:
            fu.status = 'Missed'
            fu.save(update_fields=['status'])

    for lead in Lead.objects.filter(is_deleted=False):
        next_scheduled = (
            FollowUp.objects.filter(lead_id=lead.pk, status='Scheduled', is_deleted=False)
            .order_by('scheduled_at')
            .values_list('scheduled_at', flat=True)
            .first()
        )
        if lead.next_follow_up != next_scheduled:
            lead.next_follow_up = next_scheduled
            lead.save(update_fields=['next_follow_up'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('leads', '0019_quotation_soft_delete'),
    ]

    operations = [
        migrations.RunPython(close_superseded_scheduled, noop),
    ]
