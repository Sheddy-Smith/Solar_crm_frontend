#!/usr/bin/env bash
set -euo pipefail
sleep 2
echo "==> Headers"
curl -sI https://crm.ecomalwa.com | head -8
echo "==> HTML asset"
curl -s https://crm.ecomalwa.com | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -3
echo "==> Container assets"
docker exec crm-ecomalwa-frontend sh -c 'ls /usr/share/nginx/html/assets/index-*.js'
echo "==> API URL baked"
docker exec crm-ecomalwa-frontend sh -c 'grep -o "api.crm.ecomalwa.com" /usr/share/nginx/html/assets/index-*.js | head -1'
echo "==> Local 8080"
curl -sI http://127.0.0.1:8080 | head -5
echo OK
