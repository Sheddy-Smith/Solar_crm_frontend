#!/usr/bin/env bash
# Fresh Hostinger VPS prepare + deploy for Malwa CRM on crm.ecomalwa.com
# SAFE: does NOT touch Aitrads (crypto-ai-trads / api.aitrads.in)
#
# Usage (on VPS as root):
#   bash /root/crm-ecomalwa-vps-prepare.sh
#   bash /root/crm-ecomalwa-vps-prepare.sh --deploy   # also build/start frontend Docker
#
set -euo pipefail

DEPLOY=0
for arg in "$@"; do
  case "$arg" in
    --deploy) DEPLOY=1 ;;
  esac
done

FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-crm.ecomalwa.com}"
API_DOMAIN="${API_DOMAIN:-api.crm.ecomalwa.com}"
API_URL="https://${API_DOMAIN}/api/v1"
FE_DIR="${FE_DIR:-/docker/crm-ecomalwa-frontend}"
FE_REPO="${FE_REPO:-https://github.com/sheddysmithlab-dot/solar_crm_frontend.git}"
BE_ENV="${BE_ENV:-/var/www/malwa-crm/backend/.env}"
EDGE_DIR="${EDGE_DIR:-/docker/shared-edge}"
BACKUP_DIR="/root/backups/crm-ecomalwa-$(date +%Y%m%d-%H%M%S)"

echo "==> Backup → $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -a "$EDGE_DIR/Caddyfile" "$BACKUP_DIR/Caddyfile" 2>/dev/null || true
cp -a "$BE_ENV" "$BACKUP_DIR/backend.env" 2>/dev/null || true
systemctl cat malwa-gunicorn.service > "$BACKUP_DIR/malwa-gunicorn.service" 2>/dev/null || true

echo "==> Clean old poer.in / temp Docker leftovers (Aitrads + crm-ecomalwa kept)"
# Exact old names only — do NOT use substring "malwa" (matches ecomalwa)
for c in malwa-frontend temp-wp-check temp-wp wordpress-temp; do
  docker rm -f "$c" 2>/dev/null || true
done
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk '
  $1 ~ /^(wordpress:|malwa-frontend)/ { print $2 }
' | xargs -r docker rmi -f || true
# Archive old helper scripts (do not delete aitrads)
mkdir -p /root/backups/old-poer-scripts
for f in /root/point-poer-frontend.sh /root/restore-caddy-poer.sh /root/separate-malwa-edge.sh; do
  if [[ -f "$f" ]]; then mv -f "$f" /root/backups/old-poer-scripts/ || true; fi
done
# Remove obsolete empty malwa-frontend path if present
rm -rf /docker/malwa-frontend 2>/dev/null || true

echo "==> Write shared-edge Caddyfile (Aitrads + crm.ecomalwa.com)"
cat > "$EDGE_DIR/Caddyfile" <<EOF
{
	email admin@${FRONTEND_DOMAIN}
}

# --- Aitrads API (do not remove) ---
api.aitrads.in {
	encode gzip
	reverse_proxy crypto-ai-trads-backend-1:8000
}

# --- Malwa Solar CRM (crm.ecomalwa.com) ---
${FRONTEND_DOMAIN} {
	reverse_proxy 172.17.0.1:8080
}

${API_DOMAIN} {
	reverse_proxy 172.17.0.1:8001 {
		header_up X-Forwarded-Proto {scheme}
		header_up X-Real-IP {remote_host}
		header_up Host {host}
	}
}
EOF

echo "==> Update backend Django hosts for ${FRONTEND_DOMAIN} / ${API_DOMAIN}"
if [[ -f "$BE_ENV" ]]; then
  # Only rewrite host-related lines; keep DB/SECRET intact
  sed -i.bak-ecomalwa \
    -e "s|^ALLOWED_HOSTS=.*|ALLOWED_HOSTS=${API_DOMAIN},${FRONTEND_DOMAIN},127.0.0.1,localhost|" \
    -e "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://${FRONTEND_DOMAIN}|" \
    -e "s|^CSRF_TRUSTED_ORIGINS=.*|CSRF_TRUSTED_ORIGINS=https://${FRONTEND_DOMAIN},https://${API_DOMAIN}|" \
    "$BE_ENV"
  echo "Backend .env hosts updated (backup: ${BE_ENV}.bak-ecomalwa)"
else
  echo "WARNING: $BE_ENV missing — create it before go-live"
fi

echo "==> Reload edge + backend"
cd "$EDGE_DIR"
docker compose up -d --force-recreate
systemctl restart malwa-gunicorn || true

if [[ "$DEPLOY" -eq 1 ]]; then
  echo "==> Clone/update frontend repo → $FE_DIR"
  mkdir -p "$(dirname "$FE_DIR")"
  if [[ ! -d "$FE_DIR/.git" ]]; then
    git clone --depth 1 "$FE_REPO" "$FE_DIR"
  else
    git -C "$FE_DIR" fetch origin
    git -C "$FE_DIR" reset --hard origin/main
  fi

  echo "==> Build + start frontend Docker (VITE_API_URL=$API_URL)"
  cd "$FE_DIR"
  # Stop old container name if any
  docker rm -f crm-ecomalwa-frontend malwa-frontend 2>/dev/null || true
  VITE_API_URL="$API_URL" docker compose build --build-arg VITE_API_URL="$API_URL"
  VITE_API_URL="$API_URL" docker compose up -d
fi

echo ""
echo "=== PREP DONE ==="
echo "Frontend domain : https://${FRONTEND_DOMAIN}"
echo "API domain      : https://${API_DOMAIN}/api/v1/"
echo "Compose URL     : https://raw.githubusercontent.com/sheddysmithlab-dot/solar_crm_frontend/main/docker-compose.yml"
echo "Backup          : $BACKUP_DIR"
echo ""
echo "DNS REQUIRED (Hostinger DNS → this VPS):"
echo "  A  ${FRONTEND_DOMAIN}     → 200.97.171.119"
echo "  A  ${API_DOMAIN}          → 200.97.171.119"
echo "  (remove parking / domain.name records)"
echo ""
if [[ "$DEPLOY" -ne 1 ]]; then
  echo "Frontend container NOT built yet. Re-run with --deploy after DNS + git push."
fi
echo "Verify:"
echo "  curl -sI https://${FRONTEND_DOMAIN} | head"
echo "  curl -sI https://${API_DOMAIN}/api/v1/ | head"
echo "  curl -s https://api.aitrads.in/health"
