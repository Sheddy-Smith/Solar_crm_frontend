from django.db import migrations, models


class Migration(migrations.Migration):
    """Composite indexes for list/filter/dashboard hot paths (staging EXPLAIN first)."""

    dependencies = [
        ('leads', '0021_unassign_tele_sales_assignees'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='lead',
            index=models.Index(
                fields=['is_deleted', 'status', '-created_at'],
                name='lead_del_status_created_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='lead',
            index=models.Index(
                fields=['is_deleted', 'assigned_to', '-created_at'],
                name='lead_del_assignee_created_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='lead',
            index=models.Index(
                fields=['is_deleted', 'next_follow_up'],
                name='lead_del_next_followup_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='followup',
            index=models.Index(
                fields=['is_deleted', 'status', 'scheduled_at'],
                name='followup_del_status_sched_idx',
            ),
        ),
    ]
