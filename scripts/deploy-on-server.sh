#!/usr/bin/env bash
# Malwa Solar CRM — Hostinger VPS deploy for crm.ecomalwa.com
# Prefer Docker frontend + existing gunicorn backend (see crm-ecomalwa-vps-prepare.sh).
# Legacy nginx static path kept only as fallback.
set -euo pipefail

APP_USER="${APP_USER:-malwa}"
APP_ROOT="${APP_ROOT:-/var/www/malwa-crm}"
DOMAIN="${DOMAIN:-crm.ecomalwa.com}"
API_DOMAIN="${API_DOMAIN:-api.crm.ecomalwa.com}"
FRONTEND_REPO="${FRONTEND_REPO:-https://github.com/sheddysmithlab-dot/solar_crm_frontend.git}"
BACKEND_REPO="${BACKEND_REPO:-https://github.com/sheddysmithlab-dot/solar_crm_backend.git}"
BRANCH="${BRANCH:-main}"

echo "NOTE: Preferred path is Docker frontend via scripts/crm-ecomalwa-vps-prepare.sh --deploy"
echo "This script updates backend checkout + .env hosts only if needed."

if [[ -f /root/crm-ecomalwa-vps-prepare.sh ]]; then
  bash /root/crm-ecomalwa-vps-prepare.sh --deploy
  exit 0
fi

echo "==> Fallback: clone backend if missing"
mkdir -p "$APP_ROOT"
id -u "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"

if [[ ! -d "$APP_ROOT/backend/.git" ]]; then
  git clone -b "$BRANCH" "$BACKEND_REPO" "$APP_ROOT/backend"
fi

if [[ ! -f "$APP_ROOT/backend/.env" ]]; then
  cat > "$APP_ROOT/backend/.env" <<ENV
DJANGO_SETTINGS_MODULE=malwa_solar.settings.production
DEBUG=False
SECRET_KEY=CHANGE_ME_GENERATE_NEW
ALLOWED_HOSTS=${API_DOMAIN},${DOMAIN},127.0.0.1,localhost
DATABASE_URL=mysql://USER:PASS@HOST:3306/DB
REDIS_URL=disabled
CORS_ALLOWED_ORIGINS=https://${DOMAIN}
CSRF_TRUSTED_ORIGINS=https://${DOMAIN},https://${API_DOMAIN}
ENV
  chown "$APP_USER:$APP_USER" "$APP_ROOT/backend/.env"
  echo "Created .env — EDIT secrets before migrate."
fi

echo "Done fallback stub. Use crm-ecomalwa-vps-prepare.sh for full Docker cutover."
