# Create local MySQL DB/user for Malwa CRM (Hostinger-like stack).
# Does NOT touch Hostinger / poer.in.
#
# Usage:
#   .\scripts\setup-local-mysql.ps1 -RootPassword "YOUR_LOCAL_MYSQL_ROOT_PASSWORD"
#
param(
  [Parameter(Mandatory = $true)]
  [string]$RootPassword,
  [string]$DbName = "malwa_solar_local",
  [string]$DbUser = "malwa_local",
  [string]$DbPass = "MalwaLocal@2026",
  [string]$MysqlExe = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $MysqlExe)) {
  throw "mysql.exe not found at $MysqlExe"
}

# MySQL identifiers use backticks; in PowerShell `"@` here-string, `` = one backtick
$sql = @"
CREATE DATABASE IF NOT EXISTS ``$DbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DbUser'@'localhost' IDENTIFIED BY '$DbPass';
CREATE USER IF NOT EXISTS '$DbUser'@'127.0.0.1' IDENTIFIED BY '$DbPass';
ALTER USER '$DbUser'@'localhost' IDENTIFIED BY '$DbPass';
ALTER USER '$DbUser'@'127.0.0.1' IDENTIFIED BY '$DbPass';
GRANT ALL PRIVILEGES ON ``$DbName``.* TO '$DbUser'@'localhost';
GRANT ALL PRIVILEGES ON ``$DbName``.* TO '$DbUser'@'127.0.0.1';
FLUSH PRIVILEGES;
SELECT 'LOCAL_MYSQL_READY' AS status, '$DbName' AS db_name, '$DbUser' AS db_user;
"@

$env:MYSQL_PWD = $RootPassword
try {
  $sql | & $MysqlExe -u root --protocol=tcp -h 127.0.0.1 -P 3306
  if ($LASTEXITCODE -ne 0) { throw "mysql failed with exit $LASTEXITCODE" }
}
finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Local MySQL ready (Hostinger NOT touched)." -ForegroundColor Green
Write-Host "DATABASE_URL=mysql://${DbUser}:${DbPass}@127.0.0.1:3306/${DbName}"
Write-Host "REDIS_URL=disabled"
