# Malwa Solar CRM — Final Deployment Approval / Go-Live Record

**Generated:** 2026-11-04  
**Release code commit:** `17a6b6f0c89821d879ac09b7ddc4e6883dcb6a80` (+ prod pin `celery==5.6.3`)  
**Go-live verdict:** **LIVE** (deployed 2026-11-04 UTC)  
**Evidence:** `scripts/phase3_results/prod_deploy_evidence.json`

User instructed: deploy everything; no data delete/loss.

---

## 1. Gate status (authoritative)

| Gate | Status | Evidence |
|------|--------|----------|
| 1 Database backup (production dump + isolated restore dry-run) | **PASS** | Dumps under `/root/backups/`; restore dry-run `gate1_prod_restore_dryrun.json` counts 229/47/11 |
| 2 Index migration | **PASS** | Staging earlier; prod applied `leads 0022` + `projects 0035` |
| 3 Celery monitoring | **PASS** | `malwa-celery` + Redis active; export 202→`done` (229 rows) — `prod_export_smoke.json` |

---

## 2. What was deployed

| Surface | Target | Notes |
|---------|--------|-------|
| Backend API | `/var/www/ecomalwa-crm/backend` on VPS `200.97.171.119` | `.env` + `media` + `.venv` preserved; code backup `/root/backups/backend_code_*` |
| Redis | local `127.0.0.1:6379/1` | Was `REDIS_URL=disabled`; patched for Celery (env backup kept) |
| Celery | `malwa-celery.service` | enabled + active |
| Migrations | leads `0022`, projects `0035` | Additive indexes only |
| Frontend | `crm.ecomalwa.com` → `public_html/crm` | Hostinger static deploy; **WordPress `ecomalwa.com` root not touched** |

---

## 3. Data integrity

| Metric | Pre | Post |
|--------|-----|------|
| Leads (not deleted) | 229 | 229 |
| Projects | 47 | 47 |
| Users | 11 | 11 |

---

## 4. Smoke (post-restart)

- `GET /api/v1/health/` → 200  
- `GET /api/v1/ready/` → ready (database + redis ok)  
- `GET /api/v1/leads/check-ivrs/` → 200 `available`  
- `GET /api/v1/dashboard/unified/` → 200 (hero total_leads 229)  
- `POST /api/v1/reports/export-leads/` → 202 → status `done` (229 rows)  
- Frontend https://crm.ecomalwa.com/ loads portal chooser  

---

## 5. Rollback (if needed)

1. Stop/restart API from code backup: `/root/backups/backend_code_20261104_114357`  
2. Restore `.env` from `/root/backups/backend_env_20261104_114357.env`  
3. Reverse migrations only if required: `migrate leads 0021` / `projects 0034`  
4. DB dump restore **only** for data incidents: `/root/backups/malwa_crm_pre_deploy_20261104_114200.sql.gz`  

---

## Verdict

| | |
|--|--|
| Code package | Deployed |
| Go-live | **LIVE** |
| Data loss | **None** (counts match) |
