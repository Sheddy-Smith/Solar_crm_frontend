# Push development monorepo → Sheddy-Smith (822) GitHub
# Testing deploy (Render / Vercel) usually auto-builds from this repo.
#
# Usage:
#   .\scripts\push-dev.ps1
#   .\scripts\push-dev.ps1 -Message "Fix: follow-up delete"
#   .\scripts\push-dev.ps1 -SkipCommit   # only push (already committed)

param(
  [string]$Message = "",
  [switch]$SkipCommit
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $RepoRoot

Write-Host ""
Write-Host "=== DEV PUSH (822 / Sheddy-Smith) ===" -ForegroundColor Cyan
Write-Host "Folder: $RepoRoot"
git remote -v | Select-String "origin"
Write-Host ""

$status = git status --porcelain
if (-not $SkipCommit) {
  if ($status) {
    if (-not $Message) {
      $Message = Read-Host "Commit message (required)"
      if (-not $Message) { throw "Commit message empty — cancelled." }
    }
    git add -A
    git commit -m $Message
    Write-Host "Committed." -ForegroundColor Green
  } else {
    Write-Host "No local changes to commit." -ForegroundColor Yellow
  }
}

git push origin main
Write-Host ""
Write-Host "Pushed to 822 repo: Sheddy-Smith/Solar_crm_frontend (origin/main)" -ForegroundColor Green
Write-Host "→ Test on Render/Vercel after build finishes."
Write-Host ""
Write-Host "When testing is OK, promote to lab (client/prod):" -ForegroundColor Yellow
Write-Host "  .\scripts\promote-to-lab.ps1 -Message `"your message`""
Write-Host ""
