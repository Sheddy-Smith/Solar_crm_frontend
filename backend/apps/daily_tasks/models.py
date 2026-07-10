from django.conf import settings
from django.db import models
from django.utils import timezone


class DailyTask(models.Model):
    CATEGORY_CHOICES = [
        ('site_visit_log', 'Site Visit Log'),
        ('installation_progress', 'Installation Progress'),
        ('material_dispatch', 'Material Dispatch'),
        ('stock_check', 'Stock Check'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
    ]

    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    task_date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    notes = models.TextField(blank=True)
    details = models.JSONField(default=dict, blank=True)
    summary_text = models.CharField(max_length=500, blank=True)
    assigned_to = models.ForeignKey(
        'workforce.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='daily_tasks',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='daily_tasks_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-task_date', '-created_at']

    def __str__(self):
        return f'{self.get_category_display()} — {self.task_date}'

    def refresh_summary_text(self):
        d = self.details or {}
        if self.category == 'site_visit_log':
            parts = [d.get('site_location'), d.get('survey_findings')]
            self.summary_text = ' · '.join((p or '').strip() for p in parts if (p or '').strip())[:200]
        elif self.category == 'installation_progress':
            work = (d.get('work_done') or '').strip()
            self.summary_text = work.split('\n')[0][:200] if work else (d.get('project_label') or '')
        elif self.category == 'material_dispatch':
            parts = [d.get('vehicle_number'), d.get('items_dispatched')]
            first = (parts[1] or '').strip().split('\n')[0] if parts[1] else ''
            self.summary_text = ' · '.join(p for p in [parts[0], first] if p)[:200]
        elif self.category == 'stock_check':
            checked = (d.get('checked_items') or '').strip()
            wh = (d.get('warehouse_label') or '').strip()
            line = checked.split('\n')[0][:120] if checked else ''
            self.summary_text = f'{wh}: {line}'.strip(': ')[:200] if wh or line else ''
        else:
            self.summary_text = ''

    def save(self, *args, **kwargs):
        self.refresh_summary_text()
        super().save(*args, **kwargs)
