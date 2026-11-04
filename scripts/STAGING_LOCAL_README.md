# Local staging + Locust (never production)

## Stack
- API: Waitress on `127.0.0.1:8050` (Gunicorn preferred on Linux)
- DB: `backend/staging_local.sqlite3` by default (anonymized seed only)
- Redis: **Memurai / real Redis** on `127.0.0.1:6379` (preferred); fakeredis fallback
- Settings: `malwa_solar.settings.staging_local`
- Optional MySQL: set `STAGING_MYSQL_ROOT_PASSWORD`, run `scripts/setup_staging_mysql.ps1`,
  then `DJANGO_SETTINGS_MODULE=malwa_solar.settings.staging_mysql` + `STAGING_DATABASE_URL`

## Boot
```powershell
# Memurai/Redis must already be listening on 6379
$env:REDIS_URL='redis://127.0.0.1:6379/1'
.\.venv\Scripts\python.exe scripts\start_local_staging_api.py

# Separate terminal
.\.venv\Scripts\python.exe scripts\mint_staging_tokens.py
$env:LOCUST_RUN_SECONDS='35'
.\.venv\Scripts\python.exe scripts\run_phase2_locust_ramp.py
.\.venv\Scripts\python.exe scripts\run_phase2_failure_tests.py
```

## Credentials (local dummy only)
- `staging.admin@local.test` / `StagingLoad@123`
- `staging.user001@local.test` …  

## Results
- `scripts/staging_locust_results/phase2_ramp_summary.json`
- `scripts/staging_locust_results/phase2_failure_tests.json`
- `docs/PHASE2_SCALE_REPORT.md`
