# Malwa Solar CRM — Final Deployment Approval Request

**Generated:** 2026-11-04  
**Release code commit:** `17a6b6f0c89821d879ac09b7ddc4e6883dcb6a80`  
**Docs tip (this packaging):** see `git log -1` on branch `main`  
**Current go-live verdict:** **NOT READY**

This document asks for **human approval only after Gates 1–3 are PASS**.  
It does **not** authorize deploy by itself.

---

## 1. Gate status (authoritative)

| Gate | Status | Evidence |
|------|--------|----------|
| 1 Database backup (production dump + isolated restore dry-run) | **NOT DONE** | Blocker: no SSH/key auth to production VPS from this agent (`Permission denied`). Hostinger VPS snapshot list exists (VM `1831231`) but is **not** a CRM logical dump + app restore dry-run. Staging **procedure rehearsal** only: `scripts/phase3_results/gate1_staging_rehearsal.json` |
| 2 Index migration (staging forward/rollback) | **PASS** (staging) | Rollback→forward OK on `malwa_crm_staging@127.0.0.1:3307`; indexes verified. **Production migrate not executed.** Window must still be booked before prod apply. |
| 3 Celery monitoring | **PARTIAL** | Staging Redis+worker lifecycle **PASS** (`gate3_celery_staging.json`). Production systemd unit **not installed** (example only: `docs/deploy/celery-worker.service.example`). |

Until Gate 1 is **PASS** and Gate 3 production worker monitoring is **PASS**, do not approve go-live.

---

## 2. What was verified without production changes

- Unit tests: 14/14 OK  
- Staging regression: 21/21 OK  
- IVRS global check FE/BE: PASS  
- Index migrations 0022 / 0035: staging reverse + re-apply PASS  
- Export: HTTP 202 ≠ done; poll `export-status` until `done`  
- Worker-down: status not `done`; recovery worker completes new export  

**Not tested:** Full UI E2E; exhaustive RBAC; 500+ capacity (**do not claim**).

---

## 3. Gate 1 — manual production procedure (required)

Run **on production host** after SSH access is available. Never restore into the live CRM schema.

```bash
# 1) Backup (redact passwords from logs)
TS=$(date +%Y%m%d_%H%M%S)
mkdir -p /root/backups
# Load DB_* from production .env without printing them
mysqldump --no-tablespaces --single-transaction --routines --triggers \
  -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  | gzip -c > "/root/backups/malwa_crm_pre_release_${TS}.sql.gz"
ls -lh "/root/backups/malwa_crm_pre_release_${TS}.sql.gz"
sha256sum "/root/backups/malwa_crm_pre_release_${TS}.sql.gz"

# 2) Isolated restore dry-run (separate database name)
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  -e "CREATE DATABASE malwa_crm_restore_dryrun CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
gunzip -c "/root/backups/malwa_crm_pre_release_${TS}.sql.gz" \
  | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" malwa_crm_restore_dryrun
# Compare counts vs production; optional Django settings pointing ONLY at restore DB for login smoke
# DROP DATABASE malwa_crm_restore_dryrun;  # after verification
```

Paste evidence into `docs/FINAL_RELEASE_CHECKLIST.md` evidence log (path, size, SHA256, restore host, counts, login smoke).

---

## 4. Gate 2 — production window commands (do not run until approved)

**Order:** Gate 1 PASS → book window → deploy code `17a6b6f` → migrate → restart API/worker.

```bash
cd /var/www/ecomalwa-crm/backend
.venv/bin/python manage.py migrate leads 0022 --plan
.venv/bin/python manage.py migrate projects 0035 --plan
.venv/bin/python manage.py migrate leads 0022
.venv/bin/python manage.py migrate projects 0035
```

**Rollback:**

```bash
.venv/bin/python manage.py migrate leads 0021
.venv/bin/python manage.py migrate projects 0034
# or DROP INDEX lead_del_status_created_idx ON leads_lead; (etc.)
```

Index names: `lead_del_status_created_idx`, `lead_del_assignee_created_idx`, `lead_del_next_followup_idx`, `followup_del_status_sched_idx`, `project_del_status_created_idx`, `survey_status_date_idx`.

---

## 5. Gate 3 — production worker (do not enable exports until verified)

1. Install `docs/deploy/celery-worker.service.example` as `malwa-celery.service`.  
2. `systemctl enable --now malwa-celery`  
3. Alert if inactive; monitor `LLEN celery` on Redis DB used by Celery.  
4. Prove one export: 202 queued → poll until `done` (or failed).  
5. Remember: Redis healthy ≠ worker healthy.

---

## 6. Deploy package (after gates PASS + explicit approval)

```bash
# On build machine
git fetch && git checkout 17a6b6f0c89821d879ac09b7ddc4e6883dcb6a80
# frontend build + rsync backend (paths site-specific)
# Do NOT overwrite Hostinger public_html WordPress trees
```

**Env (confirm, do not print secrets):** `DEBUG=0`, `ALLOW_EAGER_EXPORTS=0`, real `SECRET_KEY`, production `DATABASE_URL`, `REDIS_URL` if Celery/cache used.

**Smoke after restart:** `/api/v1/health/`, `/api/v1/ready/`, login, IVRS check-ivrs, lead list, dashboard, export status→done.

**Rollback:** redeploy previous git commit; reverse migrations only if needed; restore dump only for data incidents.

---

## 7. Approval checklist (human)

- [ ] Gate 1 evidence attached (prod dump + restore dry-run)  
- [ ] Gate 2 window booked; staging rollback already verified  
- [ ] Gate 3 prod worker active + alert + export done proof  
- [ ] Explicit written approval for deploy/restart/migrate  
- [ ] No 500+ capacity claim  

**Sign-off:** __________________ Date: __________

---

## Verdict

| | |
|--|--|
| Code package | Ready for review (`17a6b6f`) |
| Go-live | **NOT READY** — Gate 1 **NOT DONE**; Gate 3 production monitoring **not applied** |

Stop. Wait for separate explicit human approval before any production deployment, restart, migration, or database modification.
