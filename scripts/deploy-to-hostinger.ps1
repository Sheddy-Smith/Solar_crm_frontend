# Local helper: after VPS SSH works, upload deploy script + pubkey and print next steps
param(
  [string]$Server = "200.97.171.119",
  [string]$User = "root"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lab-repos.config.ps1"

$pub = Get-Content "$env:USERPROFILE\.ssh\id_ed25519_lab.pub" -Raw
$script = Join-Path $PSScriptRoot "deploy-on-server.sh"

Write-Host "Target: ${User}@${Server}" -ForegroundColor Cyan
Write-Host ""
Write-Host "If SSH fails, add this key to the server authorized_keys first:" -ForegroundColor Yellow
Write-Host $pub
Write-Host ""

# Try copy files
scp -o BatchMode=yes -i "$env:USERPROFILE\.ssh\id_ed25519_lab" $script "${User}@${Server}:/root/deploy-on-server.sh"
if ($LASTEXITCODE -ne 0) {
  Write-Host "SCP failed — VPS SSH key not authorized for this PC yet." -ForegroundColor Red
  Write-Host "Do ONE of these:" -ForegroundColor Yellow
  Write-Host "  1) Hostinger/DigitalOcean console → paste pubkey into ~/.ssh/authorized_keys"
  Write-Host "  2) Or tell me Hostinger VPS IP + how you login (password/console)"
  exit 1
}

ssh -o BatchMode=yes -i "$env:USERPROFILE\.ssh\id_ed25519_lab" "${User}@${Server}" "chmod +x /root/deploy-on-server.sh && bash /root/deploy-on-server.sh"
