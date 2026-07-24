# One-time checklist — dual GitHub accounts (822 testing + lab production)
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== SSH public keys ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "-- Add to Sheddy-Smith / 822 GitHub (Settings → SSH keys) --" -ForegroundColor Yellow
Get-Content "$env:USERPROFILE\.ssh\id_ed25519_822.pub"
Write-Host ""
Write-Host "-- Add to sheddysmithlab-dot GitHub (Settings → SSH keys) --" -ForegroundColor Yellow
Get-Content "$env:USERPROFILE\.ssh\id_ed25519_lab.pub"
Write-Host ""

Write-Host "=== Test SSH ===" -ForegroundColor Cyan
Write-Host "  ssh -T git@github.com-822"
Write-Host "  ssh -T git@github.com-lab"
Write-Host ""

Write-Host "=== Daily workflow (from C:\Malwa_Solar_CRM) ===" -ForegroundColor Cyan
Write-Host "  1) Code here in Malwa_Solar_CRM only"
Write-Host "  2) Test push:   .\scripts\push-dev.ps1 -Message `"fix: ...`""
Write-Host "  3) After OK:    .\scripts\promote-to-lab.ps1 -Message `"Release: ...`""
Write-Host ""
Write-Host "Full guide: DUAL_GITHUB_WORKFLOW.md"
Write-Host ""
