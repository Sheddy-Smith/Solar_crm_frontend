#!/usr/bin/env bash
# Malwa Solar CRM — pull latest main from GitHub and deploy FE + BE on this VPS.
# Safe for cron/systemd: no-op when already on the latest SHA.
#
# Live targets:
#   Frontend Docker  → /docker/crm-ecomalwa-frontend  (crm.ecomalwa.com :8080)
#   Backend gunicorn → /var/www/malwa-crm/backend     (api.crm.ecomalwa.com :8001)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Sheddy-Smith/Solar_crm_frontend.git}"
BRANCH="${BRANCH:-main}"
SRC_DIR="${SRC_DIR:-/opt/malwa-crm-src}"
FE_DIR="${FE_DIR:-/docker/crm-ecomalwa-frontend}"
BE_DIR="${BE_DIR:-/var/www/malwa-crm/backend}"
STATE_DIR="${STATE_DIR:-/var/lib/malwa-crm-auto-deploy}"
STATE_FILE="${STATE_DIR}/last_sha"
LOCK_FILE="${STATE_DIR}/deploy.lock"
API_URL="${API_URL:-https://api.crm.ecomalwa.com/api/v1}"
FORCE="${FORCE:-0}"
APP_USER="${APP_USER:-malwa}"

mkdir -p "$STATE_DIR" "$SRC_DIR" "$FE_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deploy is already running — exiting."
  exit 0
fi

if [[ ! -d "$SRC_DIR/.git" ]]; then
  echo "==> Cloning $REPO_URL ($BRANCH)"
  rm -rf "$SRC_DIR"
  git clone --depth 20 -b "$BRANCH" "$REPO_URL" "$SRC_DIR"
fi

cd "$SRC_DIR"
git remote set-url origin "$REPO_URL"
git fetch --depth 20 origin "$BRANCH"
git checkout -q "$BRANCH"
git reset --hard "origin/$BRANCH"
SHA="$(git rev-parse HEAD)"
SHORT="$(git rev-parse --short HEAD)"

if [[ "$FORCE" != "1" && -f "$STATE_FILE" && "$(cat "$STATE_FILE")" == "$SHA" ]]; then
  echo "Already deployed $SHORT — nothing to do."
  exit 0
fi

echo "==> Deploying $SHORT"

# Keep the on-box deploy entrypoint in sync with the repo copy.
if [[ -f "$SRC_DIR/scripts/vps-auto-deploy.sh" ]]; then
  install -m 0755 "$SRC_DIR/scripts/vps-auto-deploy.sh" /usr/local/bin/malwa-crm-auto-deploy.sh
  sed -i 's/\r$//' /usr/local/bin/malwa-crm-auto-deploy.sh || true
fi

echo "==> Sync backend → $BE_DIR"
rsync -a --delete \
  --exclude '.venv/' \
  --exclude '.env' \
  --exclude 'media/' \
  --exclude 'staticfiles/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.git/' \
  --exclude 'django.log' \
  "$SRC_DIR/backend/" "$BE_DIR/"

if id -u "$APP_USER" >/dev/null 2>&1; then
  chown -R "$APP_USER:$APP_USER" "$BE_DIR"
fi

echo "==> Migrate"
if [[ -x "$BE_DIR/.venv/bin/python" ]]; then
  sudo -u "$APP_USER" bash -lc "cd '$BE_DIR' && .venv/bin/python manage.py migrate --noinput"
else
  echo "WARNING: $BE_DIR/.venv/bin/python missing — skip migrate"
fi

echo "==> Restart malwa-gunicorn"
systemctl restart malwa-gunicorn
systemctl is-active malwa-gunicorn

echo "==> Sync frontend build context → $FE_DIR"
rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'backend/.venv/' \
  --exclude 'backend/media/' \
  --exclude 'backend/staticfiles/' \
  --exclude 'backend/.env' \
  --exclude 'dist_*.zip' \
  --exclude '*.zip' \
  --exclude '.env' \
  --exclude '.env.*' \
  "$SRC_DIR/" "$FE_DIR/"

if [[ ! -f "$FE_DIR/Dockerfile" || ! -f "$FE_DIR/docker-compose.yml" ]]; then
  echo "ERROR: Dockerfile/docker-compose.yml missing in $FE_DIR"
  exit 1
fi

echo "==> Docker build + up (VITE_API_URL=$API_URL)"
cd "$FE_DIR"
VITE_API_URL="$API_URL" docker compose build --build-arg VITE_API_URL="$API_URL"
VITE_API_URL="$API_URL" docker compose up -d

echo "$SHA" > "$STATE_FILE"
echo "==> DONE deployed $SHORT"
curl -sI "https://crm.ecomalwa.com" | head -5 || true
curl -sI "https://api.crm.ecomalwa.com/api/v1/" | head -5 || true
