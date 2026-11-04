"""Mint JWTs for staging Locust users without HTTP login storms."""
import json
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'malwa_solar.settings.staging_local')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from pathlib import Path

User = get_user_model()
tokens = []
for u in User.objects.filter(email__startswith='staging.', is_active=True).order_by('id')[:200]:
    tokens.append({'email': u.email, 'access': str(RefreshToken.for_user(u).access_token)})
out = Path(__file__).resolve().parents[1] / 'scripts' / 'staging_locust_results' / 'minted_tokens.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(tokens), encoding='utf-8')
print('minted', len(tokens), '->', out)
