# Start every Malwa CRM microservice slice (local strangler layout).
# Prerequisites: MySQL/DATABASE_URL + SECRET_KEY in backend/.env (same as monolith).
# Gateway (optional): caddy run --config services/gateway/Caddyfile

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$env:PYTHONPATH = "$Root;$Root\backend;$Root\services\shared"
if (-not $env:SECRET_KEY) { $env:SECRET_KEY = 'dev-microservices-scaffold-key' }
$env:DJANGO_SETTINGS_MODULE = 'services.django_settings'

python -c "from services.service_factory import write_slice_urlmodules; write_slice_urlmodules()"

$services = @(
  'auth','notifications','settings','leads','projects','inventory','finance',
  'workforce','liaison','om','amc','tasks','insights','reports'
)

foreach ($name in $services) {
  Write-Host "Starting $name ..."
  Start-Process -FilePath python -ArgumentList @(
    "$Root\services\run_service.py", $name
  ) -WorkingDirectory $Root -WindowStyle Minimized
}

Write-Host ""
Write-Host "All slices launched (minimized). Gateway: caddy run --config services/gateway/Caddyfile"
Write-Host "FE should use VITE_API_URL=http://127.0.0.1:8080/api/v1 when gateway is up."
Write-Host "Monolith fallback still expected on :8000 for unmatched routes."
