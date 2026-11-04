# Malwa Solar CRM — Final Release Checklist

**Date:** 2026-11-04  
**Verdict:** **READY FOR APPROVAL**  
**Production actions in this package:** **None** (no deploy, restart, migration, or DB write).  
**Capacity:** Do **not** claim 500+ concurrent users. Phase 3 SLO evidence remains ~20 users on isolated Waitress staging.

---

## 1. Release identity

| Field | Value |
|-------|-------|
| Git commit (full) | `17a6b6f0c89821d879ac09b7ddc4e6883dcb6a80` |
| Short hash | `17a6b6f` |
| Parent | `03ec5d3e5c7ad9bdd2770322975e083c8b2af9cf` |
| Branch | `main` (ahead of `origin/main` by this release; **not pushed**) |
| Subject | Prepare scale hardening release with IVRS global check and staging safety. |
| Files in commit | **96** |
| Changed-files list | `scripts/phase3_results/release_changed_files.txt` |

---

## 2. Dirty tree cleanup

| Check | Status | Notes |
|-------|--------|-------|
| Verified scale/hardening/IVRS changes committed | **PASS** | Commit `17a6b6f` |
| Junk / tokens / tmp / postman left untracked | **PASS** | Intentionally excluded |
| Unrelated local scripts (`scripts/_tmp_*`, `_ecomalwa_*`) | **PASS** | Not in release |
| Residual dirty: `scripts/vps-asgi-migrate.sh` | **PASS** (excluded) | Not part of this release package |

---

## 3. Production DB backup checklist (prepare only — do not run yet)

Execute **only after explicit production approval**, on the production host.

1. Confirm target is production app path and `DATABASE_URL` from production `.env` only.
2. Create offline backup directory (example): `/root/backups/`.
3. Logical dump (preferred):

```bash
TS=$(date +%Y%m%d_%H%M%S)
# Parse DATABASE_URL from production .env — never echo password into chat/logs long-term
mysqldump --no-tablespaces --single-transaction --routines --triggers \
  -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  | gzip -c > "/root/backups/malwa_crm_pre_release_${TS}.sql.gz"
ls -lh "/root/backups/malwa_crm_pre_release_${TS}.sql.gz"
```

4. Record: dump path, size, SHA256, MySQL version, app commit currently running.
5. Optional: filesystem snapshot / Hostinger panel backup if available.
6. Verify restore dry-run on a **non-production** instance before relying on the dump.
7. Keep dump until at least one successful production soak after deploy.

**Rollback dump restore (emergency only):**

```bash
gunzip -c /root/backups/malwa_crm_pre_release_<TS>.sql.gz | mysql -h ... -u ... -p ... <db>
# Then redeploy previous git commit and restart API/worker once approved
```

---

## 4. Index migration plan (additive — production not executed)

### Migrations
| App | Migration | Operations |
|-----|-----------|------------|
| `leads` | `0022_lead_followup_query_indexes` | `AddIndex` ×4 on Lead/FollowUp |
| `projects` | `0035_project_status_list_indexes` | `AddIndex` ×2 on Project/SiteSurvey |

Model `Meta.indexes` aligned so `makemigrations --check` is clean.

### Safe production plan (approval required)
1. Complete §3 backup and verify dump size > 0.
2. Maintenance window (prefer low traffic). MySQL 8 online DDL usually allows concurrent DML; still expect brief metadata locks.
3. Deploy code first **or** migrate then restart — pick one documented order; recommend: **backup → deploy code → migrate → restart workers/API**.
4. Run:

```bash
cd /var/www/<crm>/backend
.venv/bin/python manage.py showmigrations leads projects | tee /tmp/mig_before.txt
.venv/bin/python manage.py migrate leads 0022 --plan
.venv/bin/python manage.py migrate projects 0035 --plan
.venv/bin/python manage.py migrate leads 0022
.venv/bin/python manage.py migrate projects 0035
.venv/bin/python manage.py showmigrations leads projects | tee /tmp/mig_after.txt
```

5. Verify indexes exist (`SHOW INDEX FROM leads_lead` / `projects_project`).
6. Smoke login + leads list + dashboard.

### Rollback migrations (if needed)
```bash
.venv/bin/python manage.py migrate leads 0021
.venv/bin/python manage.py migrate projects 0034
```
Or drop named indexes manually if migrate reverse unavailable under pressure.

---

## 5. IVRS global duplicate check

| Check | Status | Evidence |
|-------|--------|----------|
| API `GET /api/v1/leads/check-ivrs/?ivrs=` | **PASS** | Staging live after API restart |
| Existing IVRS → `available: false` | **PASS** | `STG000500` → false + customer_name |
| Free IVRS → `available: true` | **PASS** | synthetic free value |
| Tele list hides other-owner IVRS | **PASS** | `release_rbac_ivrs.json` |
| Tele `check-ivrs` still detects collision | **PASS** | Same file — root-cause fix verified |
| FE `leadApi.checkIvrs` in App + Tele | **PASS** | `src/api.js`, `App.jsx`, `telePortal.jsx` |
| Create serializer still rejects duplicates | **PASS** | Unchanged `validate_ivrs_number` |

Artifacts: `scripts/phase3_results/release_ivrs_verify.json`, `release_rbac_ivrs.json`.

---

## 6. Final tests (isolated staging / local only)

| Suite | Status | Result |
|-------|--------|--------|
| Unit: predeploy + capacity + circuit + foundations | **PASS** | 14/14 OK |
| Staging regression `run_predeploy_regression.py` | **PASS** | 21/21 (`fail_count: 0`) |
| RBAC sample (Dashboard/Lead gates + Tele IVRS) | **PASS** | Matrix + tele IVRS |
| SQL aggregate parity (leads total/won) | **PASS** | 500 / 100 |
| API smoke (health/ready/login/JWT/lists/dashboard/export/logout) | **PASS** | Predeploy regression |
| Frontend smoke (page_size ≤200, IVRS wiring) | **PASS** | Code + API aligned |
| Full UI browser E2E every screen | **NOT TESTED** | Manual QA optional |
| Exhaustive every-role × every-module RBAC | **NOT TESTED** | Sample matrix only |
| Production load / 500-user test | **NOT TESTED** | Forbidden by policy; not claimed |

Staging API used for live checks: Waitress `127.0.0.1:8060` + MySQL `:3307` + Redis db5 (restarted with release code).

---

## 7. Environment flags for production (confirm before deploy)

| Variable | Required value |
|----------|----------------|
| `DEBUG` | `0` / False |
| `ALLOW_EAGER_EXPORTS` | `0` |
| `SECRET_KEY` | Production secret (no staging default) |
| `REDIS_URL` | Real Redis if async exports/cache desired |
| Celery worker | Running if exports non-eager |
| `API_MAX_PAGE_SIZE` | `200` (default) |
| `DASHBOARD_CACHE_TTL` | `45`–`120` |

See `docs/ENV_SCALING.md`.

---

## 8. Deployment instructions (do not execute without approval)

1. Get **explicit written approval**.
2. Tag or note commit `17a6b6f`.
3. Backup production DB (§3).
4. Deploy artifact built from `17a6b6f` (frontend build + backend).
5. Apply migrations (§4) in window.
6. Restart API + Celery **once** after code+migrate.
7. Smoke: login, IVRS verify (Tele), lead create, dashboard, export (expect 202 or controlled 503).
8. Monitor errors 30–60 minutes.
9. If failure: rollback code to previous commit; reverse migrations only if indexes cause harm; restore dump only if data integrity incident.

---

## 9. Remaining risks

| Level | Item |
|-------|------|
| High (capacity) | Sustained multi-user SLO not proven beyond ~20 on Phase 3 staging |
| Medium | Index build time/locks on large production tables |
| Medium | Export tasks queue even if worker is down — monitor Celery |
| Low | Full RBAC matrix / full UI E2E not automated |
| Low | Local junk files still on disk (untracked) — do not copy to prod |

---

## 10. Status summary

| Area | Status |
|------|--------|
| Clean release commit | **PASS** |
| Version recorded | **PASS** |
| Backup/rollback docs | **PASS** (prepared; not executed) |
| Migration plan | **PASS** (prepared; not executed) |
| IVRS FE/BE consistency | **PASS** |
| Regression / RBAC / API / FE smoke | **PASS** / sample RBAC **PASS** / full matrix **NOT TESTED** |
| Production deploy | **NOT EXECUTED** |

---

## Verdict

# READY FOR APPROVAL

Awaiting **separate explicit production deployment approval**.  
No production deploy, restart, migration, or data change has been performed.
