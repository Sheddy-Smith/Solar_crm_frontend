#!/bin/bash
set -euo pipefail
echo "==> Restore poer.in → Malwa frontend :8080"
# Prefer exact backup if present
if ls /root/backups/Caddyfile.poer.before-temp-wp.* >/dev/null 2>&1; then
  cp "$(ls -t /root/backups/Caddyfile.poer.before-temp-wp.* | head -1)" /docker/shared-edge/Caddyfile
else
  sed -i 's|reverse_proxy 172.17.0.1:8082|reverse_proxy 172.17.0.1:8080|' /docker/shared-edge/Caddyfile
fi
grep -A2 'poer.in' /docker/shared-edge/Caddyfile
cd /docker/shared-edge
docker compose up -d --force-recreate
sleep 2

echo "==> Stop/remove temp WordPress stack (Malwa API/DB never touched)"
cd /docker/temp-wp-check
docker compose down -v || true

echo "==> Verify Malwa frontend"
docker ps --format '{{.Names}} {{.Ports}}' | grep -E 'malwa|shared-edge' || true
curl -s -o /dev/null -w "poer=%{http_code}\n" https://poer.in/
curl -s -o /dev/null -w "api_poer=%{http_code}\n" https://api.poer.in/api/v1/
# Spot-check Malwa title/markers if present
curl -s https://poer.in/ | head -c 400
echo
echo RESTORED
