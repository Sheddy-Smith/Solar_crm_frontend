import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.development')
django.setup()

from django.utils import timezone
from datetime import timedelta
from apps.accounts.models import User
from apps.projects.models import (
    Project, ProjectActivity, ProjectNote, ProjectDocument, 
    ProjectExpense, WorkOrder
)

# Get the admin user
admin = User.objects.filter(is_superuser=True).first()
if not admin:
    print("No admin user found")
    exit(1)

# Get all projects
projects = Project.objects.all()[:1]  # Get first project for testing
if not projects:
    print("No projects found")
    exit(1)

project = projects[0]
print(f"Testing project: {project.project_name} (ID: {project.id})")

# Add sample activities
for i in range(3):
    activity, created = ProjectActivity.objects.update_or_create(
        project=project,
        title=f"Site Visit {i+1}",
        defaults={
            'activity_type': 'Site Survey' if i == 0 else 'Installation' if i == 1 else 'Testing',
            'status': 'Completed' if i < 2 else 'In Progress',
            'priority': 'High' if i == 0 else 'Medium',
            'notes': f"Activity notes for visit {i+1}",
            'created_by': admin,
        }
    )

# Add sample notes
for i in range(2):
    note, created = ProjectNote.objects.update_or_create(
        project=project,
        title=f"Note {i+1}",
        defaults={
            'content': f"Customer requested special configuration for system {i+1}",
            'created_by': admin,
        }
    )

# Add sample documents
# Skip documents (require file uploads)

# Add sample expenses
for i in range(2):
    expense, created = ProjectExpense.objects.update_or_create(
        project=project,
        description=f"Equipment Purchase {i+1}",
        defaults={
            'category': 'Materials' if i == 0 else 'Equipment',
            'amount': 50000 + (i * 20000),
            'date': timezone.now().date() - timedelta(days=i),
            'created_by': admin
        }
    )

# Add sample team members
# Skip team members (not needed for basic test)

# Add sample milestones
for i in range(2):
    wo, created = WorkOrder.objects.get_or_create(
        project=project,
        task=f"Installation Phase {i+1}",
        defaults={
            'category': 'Installation' if i < 2 else 'Testing',
            'assignee': admin,
            'status': 'Completed' if i == 0 else 'In Progress',
            'start_date': timezone.now().date() - timedelta(days=5-i),
            'due_date': timezone.now().date() + timedelta(days=5-i),
            'notes': f"Work order for phase {i+1}",
            'created_by': admin
        }
    )

# Add sample checklist items
# Skip checklist items (not in basic models)

print("✓ Sample data added successfully!")
print(f"[OK] Activities: {ProjectActivity.objects.filter(project=project).count()}")
print(f"[OK] Notes: {ProjectNote.objects.filter(project=project).count()}")
print(f"[OK] Expenses: {ProjectExpense.objects.filter(project=project).count()}")
print(f"[OK] Work Orders: {WorkOrder.objects.filter(project=project).count()}")
print(f"[SUCCESS] Database seeding completed!")
print(f"Project Details Page should now show real data from the backend.")
