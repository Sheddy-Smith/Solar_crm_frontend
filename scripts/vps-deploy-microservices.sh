#!/usr/bin/env bash
# Deploy Malwa CRM microservice mesh on the VPS (Docker Compose).
# Keeps legacy monolith (ecomalwa-crm-api) running as rollback.
# Gateway publishes on 127.0.0.1:8080 — wire Caddy/api host only after soak.
set -euo pipefail

ROOT="${MALWA_CRM_ROOT:-/var/www/ecomalwa-crm}"
COMPOSE_FILE="$ROOT/docker-compose.microservices.yml"
ENV_FILE="${MALWA_MS_ENV:-/etc/ecomalwa-crm/microservices.env}"

cd "$ROOT"
git fetch origin main
git checkout main
git pull --ff-only origin main

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing $COMPOSE_FILE"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Create $ENV_FILE with SECRET_KEY, DATABASE_URL, REDIS_URL, ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

export MALWA_SERVICE_ENV=production
export DJANGO_SETTINGS_MODULE=services.django_settings

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "==> Microservices mesh status"
docker compose -f "$COMPOSE_FILE" ps
echo "==> Gateway health (local)"
curl -fsS "http://127.0.0.1:8080/api/v1/health/" || true
echo
echo "Soak mesh on :8080 then point api.crm Caddy upstream from monolith :8000 to gateway :8080"
