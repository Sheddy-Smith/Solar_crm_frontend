from django.db import models
from apps.accounts.models import User


class Notification(models.Model):
    """One CRM alert. `user` targets a single person; when it's empty the alert
    is broadcast to every role that can view `module`."""
    CATEGORY_CHOICES = [
        ('Service', 'Service'),
        ('Ticket', 'Ticket'),
        ('Insurance', 'Insurance'),
        ('Task', 'Task'),
        ('Free Service', 'Free Service'),
        ('General', 'General'),
    ]
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('upcoming', 'Upcoming'),
        ('info', 'Info'),
    ]
    CHANNEL_CHOICES = [
        ('crm', 'CRM'),
        ('whatsapp', 'WhatsApp'),
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('push', 'Push'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    module = models.CharField(max_length=40, blank=True, db_index=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='General', db_index=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='info', db_index=True)
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    link = models.CharField(max_length=255, blank=True)
    plant = models.ForeignKey('om.OmPlant', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES, default='crm')
    dedupe_key = models.CharField(max_length=200, unique=True)
    read_by = models.ManyToManyField(User, blank=True, related_name='read_notifications')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-created_at']
