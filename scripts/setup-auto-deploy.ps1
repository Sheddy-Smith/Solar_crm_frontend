# Install / refresh Malwa CRM auto-deploy on Hostinger VPS.
# After this, every push to Sheddy-Smith/Solar_crm_frontend main deploys
# frontend + backend within ~1 minute (systemd timer).
#
# Usage:
#   .\scripts\setup-auto-deploy.ps1
#   .\scripts\setup-auto-deploy.ps1 -ForceDeployNow

param(
  [string]$Server = "200.97.171.119",
  [string]$User = "root",
  [string]$IdentityFile = "$env:USERPROFILE\.ssh\id_ed25519_lab",
  [switch]$ForceDeployNow
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$ssh = @("-o", "BatchMode=yes", "-o", "ConnectTimeout=20", "-i", $IdentityFile)
$target = "${User}@${Server}"

Write-Host "=== Install auto-deploy on $target ===" -ForegroundColor Cyan

scp @ssh `
  "$RepoRoot\scripts\vps-auto-deploy.sh" `
  "${target}:/usr/local/bin/malwa-crm-auto-deploy.sh"

scp @ssh `
  "$RepoRoot\scripts\systemd\malwa-crm-auto-deploy.service" `
  "${target}:/etc/systemd/system/malwa-crm-auto-deploy.service"

scp @ssh `
  "$RepoRoot\scripts\systemd\malwa-crm-auto-deploy.timer" `
  "${target}:/etc/systemd/system/malwa-crm-auto-deploy.timer"

$remote = @'
set -euo pipefail
chmod +x /usr/local/bin/malwa-crm-auto-deploy.sh
# strip Windows CRLF if any
sed -i "s/\r$//" /usr/local/bin/malwa-crm-auto-deploy.sh \
  /etc/systemd/system/malwa-crm-auto-deploy.service \
  /etc/systemd/system/malwa-crm-auto-deploy.timer
systemctl daemon-reload
systemctl enable --now malwa-crm-auto-deploy.timer
systemctl list-timers malwa-crm-auto-deploy.timer --no-pager
'@

if ($ForceDeployNow) {
  $remote += "`nFORCE=1 /usr/local/bin/malwa-crm-auto-deploy.sh`n"
}

ssh @ssh $target $remote

Write-Host ""
Write-Host "Auto-deploy installed." -ForegroundColor Green
Write-Host "Push to origin/main → VPS pulls + deploys FE Docker + BE gunicorn (~1 min)."
Write-Host ""
Write-Host "Optional instant GitHub Actions deploy — add repo secrets on Sheddy-Smith/Solar_crm_frontend:" -ForegroundColor Yellow
Write-Host "  VPS_HOST     = $Server"
Write-Host "  VPS_USER     = $User"
Write-Host "  VPS_SSH_KEY  = (private key that can SSH as $User)"
Write-Host ""
