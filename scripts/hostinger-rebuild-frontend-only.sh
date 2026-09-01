#!/usr/bin/env bash
set -euo pipefail
FE=/docker/crm-ecomalwa-frontend
API_URL=https://api.crm.ecomalwa.com/api/v1
ARCHIVE=/tmp/deploy-fe.tgz
test -f "$ARCHIVE"
mkdir -p "$FE"
tar -xzf "$ARCHIVE" -C "$FE"
rm -f "$ARCHIVE"
cd "$FE"
test -f Dockerfile
grep -n "can_assign\|Lead', 'Assign'\|hasModuleAccess(loggedInUser, 'Lead', 'Assign')" src/App.jsx src/settingsHubPages.jsx | head -10
VITE_API_URL="$API_URL" docker compose build --build-arg VITE_API_URL="$API_URL"
VITE_API_URL="$API_URL" docker compose up -d
sleep 2
curl -sI https://crm.ecomalwa.com | head -6
curl -s https://crm.ecomalwa.com | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1
echo DONE
