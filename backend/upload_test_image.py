import os
import django
import urllib.request

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.development')
django.setup()

from apps.projects.models import Project
from django.core.files.base import ContentFile

project = Project.objects.first()
print(f"Project: {project.project_name} (ID: {project.id})")
print(f"Current image: {project.project_image.name if project.project_image else 'None'}")

# Try Unsplash free solar panel image
urls = [
    ('https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80', 'solar_panels.jpg'),
    ('https://picsum.photos/seed/solarpanel/800/600', 'solar_test.jpg'),
]

for url, fname in urls:
    try:
        print(f"Downloading from: {url}")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as resp:
            img_bytes = resp.read()
        image_name = f"project_{project.id}_{fname}"
        project.project_image.save(image_name, ContentFile(img_bytes), save=True)
        print(f"SUCCESS - Image saved: {project.project_image.name}")
        print(f"Size: {len(img_bytes):,} bytes")
        break
    except Exception as e:
        print(f"Failed: {e}")
        continue
else:
    print("All downloads failed.")

print("Done.")
