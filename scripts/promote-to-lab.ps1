# Promote confirmed code: C:\Malwa_Solar_CRM → PROD split folders → lab GitHub push
# Does NOT push to 822. Run push-dev.ps1 first for testing.
#
# Usage:
#   .\scripts\promote-to-lab.ps1
#   .\scripts\promote-to-lab.ps1 -Message "Release: follow-ups + tele portal"
#   .\scripts\promote-to-lab.ps1 -DryRun   # only sync + commit locally, no push

param(
  [string]$Message = "Promote from development monorepo",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "sync-to-lab.ps1"

Write-Host ""
Write-Host "=== PROMOTE TO LAB (client / poer.in production) ===" -ForegroundColor Cyan
Write-Host "Source : C:\Malwa_Solar_CRM"
Write-Host "Copy to: C:\Malwa_Solar_CRM_PROD\malwa-crm-frontend + malwa-crm-backend"
Write-Host "Push to: sheddysmithlab-dot/solar_crm_frontend + solar_crm_backend"
Write-Host ""

if ($DryRun) {
  Write-Host "DryRun: sync + commit only (no GitHub push)." -ForegroundColor Yellow
  & $script -Message $Message
} else {
  $confirm = Read-Host "Testing on 822/Render already OK? Type YES to push lab"
  if ($confirm -ne "YES") {
    Write-Host "Cancelled. Nothing pushed to lab." -ForegroundColor Yellow
    exit 0
  }
  & $script -Push -Message $Message
}

Write-Host ""
Write-Host "Next (if VPS should get new build):" -ForegroundColor Yellow
Write-Host "  Frontend: rebuild Docker on VPS (see DUAL_GITHUB_WORKFLOW.md)"
Write-Host "  Backend : sync/pull on VPS + migrate + restart gunicorn"
Write-Host ""
