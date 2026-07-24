#!/bin/bash
set -euo pipefail
cd /docker/temp-wp-check

# Backup Caddy once if missing
mkdir -p /root/backups
if ! ls /root/backups/Caddyfile.poer.before-temp-wp.* >/dev/null 2>&1; then
  cp /docker/shared-edge/Caddyfile /root/backups/Caddyfile.poer.before-temp-wp.$(date +%Y%m%d%H%M%S)
fi

cp -a html/wp-config.php html/wp-config.php.bak-original
python3 patch-wp-config.py

echo "==> Starting temp WordPress + MySQL (Malwa CRM API/DB untouched; Malwa frontend stays on :8080)"
docker compose up -d

echo "==> Waiting for MySQL"
for i in $(seq 1 60); do
  if docker exec temp-wp-db mysqladmin ping -h 127.0.0.1 -uroot -p'TempWpRoot_2026!' --silent 2>/dev/null; then
    echo "MySQL ready"
    break
  fi
  sleep 2
done

DBGZ=$(ls html/wp-content/updraft/*-db.gz | head -1)
echo "==> Importing $DBGZ"
gunzip -c "$DBGZ" > /tmp/temp-wp-import.sql
docker exec -i temp-wp-db mysql -uroot -p'TempWpRoot_2026!' temp_wp_check < /tmp/temp-wp-import.sql
rm -f /tmp/temp-wp-import.sql

echo "==> Fix siteurl/home to poer.in"
docker exec temp-wp-db mysql -uroot -p'TempWpRoot_2026!' temp_wp_check -e \
  "UPDATE wp_options SET option_value='https://poer.in' WHERE option_name IN ('siteurl','home'); SELECT option_name, option_value FROM wp_options WHERE option_name IN ('siteurl','home');"

echo "==> Point poer.in to temp WP :8082 — WAIT for user verify before restore"
cp /docker/shared-edge/Caddyfile /root/backups/Caddyfile.before-temp-wp-switch
sed -i 's|reverse_proxy 172.17.0.1:8080|reverse_proxy 172.17.0.1:8082|' /docker/shared-edge/Caddyfile
# idempotent if already on 8082
grep -A2 'poer.in' /docker/shared-edge/Caddyfile || true
cd /docker/shared-edge
docker compose up -d --force-recreate
sleep 3
curl -s -o /dev/null -w "local_wp=%{http_code}\n" http://127.0.0.1:8082/
curl -s -o /dev/null -w "poer=%{http_code}\n" https://poer.in/
curl -s -o /dev/null -w "api_poer=%{http_code}\n" https://api.poer.in/api/v1/
curl -s https://poer.in/ | grep -oE '<title>[^<]+</title>' | head -1
echo "LIVE_FOR_USER_VERIFY — do NOT restore until user says so"
