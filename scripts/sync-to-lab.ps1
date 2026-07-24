# Sync monorepo → lab split repos (PROD folders), then optionally push to github.com-lab
#
# IMPORTANT:
# - Repos are NOT auto-linked. Changes in C:\Malwa_Solar_CRM do NOT appear in
#   C:\Malwa_Solar_CRM_PROD until you run this script.
# - Prefer: .\scripts\promote-to-lab.ps1  (asks YES before push)
#
# Usage:
#   .\scripts\sync-to-lab.ps1
#   .\scripts\sync-to-lab.ps1 -Push
#   .\scripts\sync-to-lab.ps1 -Push -Message "Release: follow-up timeline"

param(
  [switch]$Push,
  [string]$Message = "Sync from development monorepo"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lab-repos.config.ps1"

if ($LabGitHubUser -eq "CHANGE_ME_LAB_USERNAME") {
  Write-Host "ERROR: Open scripts\lab-repos.config.ps1 and set `$LabGitHubUser to your lab GitHub username." -ForegroundColor Red
  exit 1
}

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Force -Path $path | Out-Null }
}

function Sync-Frontend {
  Ensure-Dir $ProdFrontendPath
  # Copy monorepo root → prod frontend (exclude backend + secrets + tooling)
  robocopy $MonorepoPath $ProdFrontendPath /E /NFL /NDL /NJH /NJS `
    /XD backend node_modules .git dist .vercel __pycache__ .cursor scripts .github agent-transcripts public_html vps_backend crm .venv venv `
    /XF "*.pyc" ".env" ".env.local" "DEPLOYMENT_POER_IN_FULL.md" "DUAL_GITHUB_WORKFLOW.md" "POSTGRESQL_TABLES.md" "VPS_DUAL_APP_SEPARATION.md" "*.sql" | Out-Null
  # robocopy 0-7 = success-ish
  if ($LastExitCode -ge 8) { throw "Frontend robocopy failed with code $LastExitCode" }
  # Never keep DB dump JSON in lab frontend
  $dumpDir = Join-Path $ProdFrontendPath "Data"
  if (Test-Path $dumpDir) {
    Get-ChildItem $dumpDir -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match 'hostinger|to_local|local_full|local_pg' } |
      Remove-Item -Force -ErrorAction SilentlyContinue
  }
}

function Sync-Backend {
  Ensure-Dir $ProdBackendPath
  robocopy (Join-Path $MonorepoPath "backend") $ProdBackendPath /E /NFL /NDL /NJH /NJS `
    /XD __pycache__ .venv venv .git media staticfiles `
    /XF "*.pyc" ".env" "db.sqlite3" "django.log" | Out-Null
  if ($LastExitCode -ge 8) { throw "Backend robocopy failed with code $LastExitCode" }
}

function Ensure-GitRepo($path, $remoteUrl) {
  Push-Location $path
  try {
    if (-not (Test-Path ".git")) {
      git init
      git branch -M main
    }
    $existing = git remote 2>$null
    if ($existing -notcontains "origin") {
      git remote add origin $remoteUrl
    } else {
      git remote set-url origin $remoteUrl
    }
  } finally {
    Pop-Location
  }
}

function Commit-And-MaybePush($path, $label) {
  Push-Location $path
  try {
    git add -A
    $pending = git status --porcelain
    if (-not $pending) {
      Write-Host "[$label] No changes to commit." -ForegroundColor Yellow
    } else {
      git commit -m $Message
      Write-Host "[$label] Committed." -ForegroundColor Green
    }
    if ($Push) {
      git push -u origin main
      Write-Host "[$label] Pushed to origin/main." -ForegroundColor Green
    }
  } finally {
    Pop-Location
  }
}

Write-Host "Syncing frontend..." -ForegroundColor Cyan
Sync-Frontend
Write-Host "Syncing backend..." -ForegroundColor Cyan
Sync-Backend

$feRemote = "git@github.com-lab:${LabGitHubUser}/${LabFrontendRepo}.git"
$beRemote = "git@github.com-lab:${LabGitHubUser}/${LabBackendRepo}.git"

Ensure-GitRepo $ProdFrontendPath $feRemote
Ensure-GitRepo $ProdBackendPath $beRemote

Commit-And-MaybePush $ProdFrontendPath "frontend"
Commit-And-MaybePush $ProdBackendPath "backend"

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Dev monorepo stays on Sheddy-Smith (822). Lab repos: $feRemote / $beRemote"
if (-not $Push) {
  Write-Host "Tip: re-run with -Push after lab GitHub repos exist and SSH key is added." -ForegroundColor Yellow
}
