#!/usr/bin/env bash
# Thin wrapper used by systemd timer — always runs the auto-deploy script.
set -euo pipefail
exec /usr/local/bin/malwa-crm-auto-deploy.sh
