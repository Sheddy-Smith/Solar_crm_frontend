# Local-only staging MySQL bootstrap. Requires STAGING_MYSQL_ROOT_PASSWORD.
# Never points at Hostinger production.
param(
  [string]$RootPassword = $env:STAGING_MYSQL_ROOT_PASSWORD,
  [string]$DbName = 'malwa_crm_staging',
  [string]$DbUser = 'malwa_staging',
  [string]$DbPass = 'StagingLocal_Only_123'
)

if (-not $RootPassword) {
  Write-Error 'Set STAGING_MYSQL_ROOT_PASSWORD then re-run. Refusing to guess root password.'
  exit 1
}

$mysql = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
$sql = @"
CREATE DATABASE IF NOT EXISTS $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DbUser'@'localhost' IDENTIFIED BY '$DbPass';
GRANT ALL ON $DbName.* TO '$DbUser'@'localhost';
FLUSH PRIVILEGES;
SELECT 'staging_mysql_ok' AS status;
"@

& $mysql -u root "-p$RootPassword" -e $sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "DATABASE_URL=mysql://$DbUser`:$DbPass@127.0.0.1:3306/$DbName"
Write-Host 'Then: set REDIS_URL=redis://127.0.0.1:6379/1 and run migrate + seed_staging_anonymized'
