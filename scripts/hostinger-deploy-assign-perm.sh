#!/usr/bin/env bash
# Deploy Lead Assign permission: backend migrate + frontend Docker rebuild
set -euo pipefail

BE=/var/www/malwa-crm/backend
FE=/docker/crm-ecomalwa-frontend
API_URL=https://api.crm.ecomalwa.com/api/v1
ARCHIVE=/tmp/deploy-fe.tgz

echo "==> Backend files"
test -f /tmp/malwa-be-patch.tgz
mkdir -p "$BE"
tar -xzf /tmp/malwa-be-patch.tgz -C "$BE"
rm -f /tmp/malwa-be-patch.tgz

echo "==> Migrate"
cd "$BE"
if [[ -x .venv/bin/python ]]; then
  PY=.venv/bin/python
elif [[ -x venv/bin/python ]]; then
  PY=venv/bin/python
else
  PY=python3
fi
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-malwa_solar.settings.production}"
# Load .env if present (DATABASE_URL etc.)
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
"$PY" manage.py migrate accounts 0015 --noinput
systemctl restart malwa-gunicorn
sleep 1
systemctl is-active malwa-gunicorn

echo "==> Frontend extract + rebuild"
test -f "$ARCHIVE"
mkdir -p "$FE"
tar -xzf "$ARCHIVE" -C "$FE"
rm -f "$ARCHIVE"
cd "$FE"
test -f Dockerfile
VITE_API_URL="$API_URL" docker compose build --build-arg VITE_API_URL="$API_URL"
VITE_API_URL="$API_URL" docker compose up -d
sleep 2
curl -sI https://crm.ecomalwa.com | head -5
curl -sI https://api.crm.ecomalwa.com/api/v1/ | head -3
echo DONE
