#!/usr/bin/env bash
# Switch ecomalwa-crm-api from Gunicorn sync/WSGI to
# Caddy -> Gunicorn -> UvicornWorker -> Django ASGI.
#
# Prerequisite: backend code containing gunicorn.conf.py, malwa_solar/uvicorn_worker.py
# and the updated requirements.txt is already synced to $BE_DIR
# (ecomalwa-crm-auto-deploy.sh or rsync).
#
# Safe to re-run. Pre-flights the ASGI server on a spare loopback port before
# touching the live unit, and restores the previous unit if the swap fails.
# Rollback later:  ROLLBACK=1 bash vps-asgi-migrate.sh
set -euo pipefail

BE_DIR="${BE_DIR:-/var/www/ecomalwa-crm/backend}"
APP_USER="${APP_USER:-malwa}"
SERVICE="${SERVICE:-ecomalwa-crm-api}"
BIND="${BIND:-172.20.0.1:8020}"
TEST_PORT="${TEST_PORT:-8021}"
WORKERS="${WORKERS:-2}"
UNIT="/etc/systemd/system/${SERVICE}.service"
BACKUP="${UNIT}.wsgi.bak"
HEALTH_HOST="api.crm.ecomalwa.com"

health() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
    -H "Host: ${HEALTH_HOST}" -H 'X-Forwarded-Proto: https' "http://$1/api/v1/health/" || true
}

if [[ "${ROLLBACK:-0}" == "1" ]]; then
  [[ -f "$BACKUP" ]] || { echo "no backup at $BACKUP"; exit 1; }
  cp "$BACKUP" "$UNIT"
  systemctl daemon-reload
  systemctl restart "$SERVICE"
  sleep 3
  echo "rolled back; health=$(health "$BIND")"
  exit 0
fi

cd "$BE_DIR"
for f in gunicorn.conf.py malwa_solar/asgi.py malwa_solar/uvicorn_worker.py; do
  [[ -f "$f" ]] || { echo "missing $BE_DIR/$f — sync backend first"; exit 1; }
done

echo "==> install requirements"
sudo -u "$APP_USER" .venv/bin/pip install -q --no-cache-dir --disable-pip-version-check -r requirements.txt
sudo -u "$APP_USER" .venv/bin/python -c "import uvicorn, uvicorn_worker, uvloop, httptools; print('uvicorn', uvicorn.__version__)"

RUN_AS=(--uid="$APP_USER" --gid="$APP_USER"
  --property=WorkingDirectory="$BE_DIR"
  --property=EnvironmentFile="$BE_DIR/.env"
  --setenv=DJANGO_SETTINGS_MODULE=malwa_solar.settings.production)

echo "==> django check"
systemd-run --quiet --wait --pipe "${RUN_AS[@]}" "$BE_DIR/.venv/bin/python" manage.py check

echo "==> pre-flight ASGI server on 127.0.0.1:${TEST_PORT}"
systemctl stop asgi-preflight 2>/dev/null || true
systemctl reset-failed asgi-preflight 2>/dev/null || true
systemd-run --quiet --unit=asgi-preflight "${RUN_AS[@]}" \
  "$BE_DIR/.venv/bin/gunicorn" malwa_solar.asgi:application -c "$BE_DIR/gunicorn.conf.py" \
  --bind "127.0.0.1:${TEST_PORT}" --workers 1
code=000
for _ in $(seq 1 20); do
  sleep 1
  code="$(health "127.0.0.1:${TEST_PORT}")"
  [[ "$code" == "200" ]] && break
done
journalctl -u asgi-preflight --no-pager -n 15 || true
systemctl stop asgi-preflight 2>/dev/null || true
systemctl reset-failed asgi-preflight 2>/dev/null || true
if [[ "$code" != "200" ]]; then
  echo "pre-flight failed (health=$code); live service untouched."
  exit 1
fi
echo "pre-flight health=200"

echo "==> backup unit -> $BACKUP"
[[ -f "$BACKUP" ]] || cp "$UNIT" "$BACKUP"

cat > "$UNIT" <<EOF
[Unit]
Description=ecomalwa CRM API (Gunicorn + UvicornWorker, Django ASGI)
After=network.target

[Service]
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${BE_DIR}
Environment=DJANGO_SETTINGS_MODULE=malwa_solar.settings.production
Environment=WEB_CONCURRENCY=${WORKERS}
EnvironmentFile=${BE_DIR}/.env
ExecStart=${BE_DIR}/.venv/bin/gunicorn malwa_solar.asgi:application -c ${BE_DIR}/gunicorn.conf.py --bind ${BIND}
ExecReload=/bin/kill -s HUP \$MAINPID
KillMode=mixed
TimeoutStopSec=40
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl restart "$SERVICE"

code=000
for _ in $(seq 1 20); do
  sleep 1
  code="$(health "$BIND")"
  [[ "$code" == "200" ]] && break
done
if [[ "$code" != "200" ]]; then
  echo "ASGI service unhealthy (health=$code) — restoring WSGI unit"
  journalctl -u "$SERVICE" -n 40 --no-pager || true
  cp "$BACKUP" "$UNIT"
  systemctl daemon-reload
  systemctl restart "$SERVICE"
  sleep 3
  echo "restored; health=$(health "$BIND")"
  exit 1
fi

echo "==> verify"
systemctl is-active "$SERVICE"
ps -o pid,cmd -u "$APP_USER" | grep -E "gunicorn|uvicorn" | grep -v grep || true
echo "bridge_health=$code"
echo "public_health=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://${HEALTH_HOST}/api/v1/health/" || true)"
echo DONE
