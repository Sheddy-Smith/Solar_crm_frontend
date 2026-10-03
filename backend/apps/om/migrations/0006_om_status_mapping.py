from django.db import migrations


def forwards(apps, schema_editor):
    Ticket = apps.get_model('om', 'OmBreakdownTicket')
    Task = apps.get_model('om', 'OmMaintenanceTask')
    Ticket.objects.filter(status='On Hold').update(status='In Progress')
    Ticket.objects.filter(assigned_to__isnull=False, status='Open').update(status='Assigned')
    # "Overdue" is now computed from the due date instead of stored.
    Task.objects.filter(status='Overdue').update(status='Pending')


def backwards(apps, schema_editor):
    Ticket = apps.get_model('om', 'OmBreakdownTicket')
    Task = apps.get_model('om', 'OmMaintenanceTask')
    Ticket.objects.filter(status='Assigned').update(status='Open')
    Ticket.objects.filter(status='Site Visit').update(status='In Progress')
    Ticket.objects.filter(status='Closed').update(status='Resolved')
    Task.objects.filter(status__in=['Scheduled', 'Assigned', 'Accepted']).update(status='Pending')
    Task.objects.filter(status='Cancelled').update(status='Completed')


class Migration(migrations.Migration):

    dependencies = [
        ('om', '0005_om_plant_service_insurance'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
