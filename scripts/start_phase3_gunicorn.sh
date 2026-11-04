#!/usr/bin/env bash
# Linux-only Phase 3 Gunicorn staging (MySQL + Redis). Never production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
export DJANGO_SETTINGS_MODULE=malwa_solar.settings.staging_mysql
export STAGING_DATABASE_URL="${STAGING_DATABASE_URL:?set STAGING_DATABASE_URL}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/5}"
export SECRET_KEY="${SECRET_KEY:-phase3-staging-local-only-not-for-production-32b}"
export WEB_CONCURRENCY="${WEB_CONCURRENCY:-2}"
export GUNICORN_THREADS="${GUNICORN_THREADS:-2}"
export GUNICORN_BIND="${GUNICORN_BIND:-127.0.0.1:8060}"
export DASHBOARD_CACHE_TTL="${DASHBOARD_CACHE_TTL:-60}"
unset DATABASE_URL || true
python manage.py migrate --noinput
python manage.py seed_staging_anonymized --users 80 --leads 500
exec gunicorn -c gunicorn.conf.py malwa_solar.wsgi:application
