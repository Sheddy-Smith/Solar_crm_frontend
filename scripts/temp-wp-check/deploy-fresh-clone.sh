#!/bin/bash
set -euo pipefail
cd /docker/temp-wp-check

echo "==> Extract fresh ecomalwa clone"
rm -rf html
mkdir -p html
tar -xzf files.tar.gz -C html --strip-components=1
# if still nested
if [ -d html/public_html ] && [ ! -f html/wp-config.php ]; then
  shopt -s dotglob
  mv html/public_html/* html/
  rmdir html/public_html || true
fi
test -f html/wp-config.php
ls html | head -15

echo "==> Patch wp-config for temp DB only"
cp -a html/wp-config.php html/wp-config.php.bak-ecomalwa
python3 patch-wp-config.py
grep -E "DB_NAME|DB_USER|DB_HOST|WP_HOME|WP_SITEURL" html/wp-config.php | sed "s/PASSWORD.*/PASSWORD', '***');/"

echo "==> Recreate temp WP stack (Malwa CRM API/DB untouched)"
docker compose down -v || true
docker compose up -d

echo "==> Wait MySQL"
for i in $(seq 1 60); do
  if docker exec temp-wp-db mysqladmin ping -h 127.0.0.1 -uroot -p'TempWpRoot_2026!' --silent 2>/dev/null; then
    echo MySQL_OK
    break
  fi
  sleep 2
done

echo "==> Import fresh DB"
gunzip -c db.sql.gz > /tmp/temp-wp-import.sql
docker exec -i temp-wp-db mysql -uroot -p'TempWpRoot_2026!' temp_wp_check < /tmp/temp-wp-import.sql
rm -f /tmp/temp-wp-import.sql

docker exec temp-wp-db mysql -uroot -p'TempWpRoot_2026!' temp_wp_check -e \
  "UPDATE wp_options SET option_value='https://poer.in' WHERE option_name IN ('siteurl','home'); SELECT option_name, option_value FROM wp_options WHERE option_name IN ('siteurl','home');"

# Fix ownership for apache
docker exec temp-wp-web chown -R www-data:www-data /var/www/html || true

echo "==> Ensure poer.in -> :8082"
cp /docker/shared-edge/Caddyfile /root/backups/Caddyfile.before-ecomalwa-live 2>/dev/null || true
sed -i 's|reverse_proxy 172.17.0.1:8080|reverse_proxy 172.17.0.1:8082|' /docker/shared-edge/Caddyfile
# already 8082 is fine
grep -A2 'poer.in,' /docker/shared-edge/Caddyfile
cd /docker/shared-edge
docker compose up -d --force-recreate
sleep 3

curl -s -o /dev/null -w "poer=%{http_code}\n" https://poer.in/
curl -s -o /dev/null -w "api_poer=%{http_code}\n" https://api.poer.in/api/v1/
curl -s https://poer.in/ | grep -oE '<title>[^<]+</title>' | head -1
echo "LIVE_FOR_USER_VERIFY — wait until user says restore CRM"
