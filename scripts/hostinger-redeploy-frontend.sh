#!/usr/bin/env bash
# Redeploy Malwa CRM frontend on Hostinger VPS (crm.ecomalwa.com)
set -euo pipefail

FE_DIR=/docker/crm-ecomalwa-frontend
API_URL=https://api.crm.ecomalwa.com/api/v1
ARCHIVE=/tmp/deploy-fe.tgz
BACKUP="/root/backups/crm-fe-$(date +%Y%m%d-%H%M%S)"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Missing $ARCHIVE"
  exit 1
fi

echo "==> Backup → $BACKUP"
mkdir -p /root/backups
cp -a "$FE_DIR" "$BACKUP" 2>/dev/null || true

echo "==> Extract archive → $FE_DIR"
mkdir -p "$FE_DIR"
tar -xzf "$ARCHIVE" -C "$FE_DIR"

cd "$FE_DIR"
test -f Dockerfile
test -f docker-compose.yml
test -f package.json
test -f src/App.jsx

if ! grep -q 'assignedTo?.name || .Unassigned' src/App.jsx; then
  echo "WARNING: avatar-removal marker not found in App.jsx (continuing)"
fi

echo "==> Docker build (VITE_API_URL=$API_URL)"
VITE_API_URL="$API_URL" docker compose build --build-arg VITE_API_URL="$API_URL"

echo "==> Docker up"
VITE_API_URL="$API_URL" docker compose up -d

echo "==> Status"
docker ps --filter name=crm-ecomalwa-frontend
curl -sI https://crm.ecomalwa.com | head -8
curl -sI https://api.crm.ecomalwa.com/api/v1/ | head -5

rm -f "$ARCHIVE"
echo "DONE"
