# Malwa Solar CRM — Final Release Checklist

**Date:** 2026-11-04 (gates section updated same day)  
**Code package verdict:** **READY FOR APPROVAL** (review / schedule only)  
**Go-live verdict:** **NOT READY TO DEPLOY** — Gates 1, 2, 3 are still **NOT DONE**  
**Production actions in this package:** **None** (no deploy, restart, migration, or DB write).  
**Capacity:** Do **not** claim 500+ concurrent users. Phase 3 SLO evidence remains ~20 users on isolated Waitress staging.

---

## Recommendation (current)

**Abhi production deploy mat karo.**

Teeno mandatory gates ko **ek-ek karke** close karo, har gate ke baad is checklist mein evidence update karo (path, SHA256, window time, worker PID/alert screenshot, export `queued`→`done` task id).  
Gates 1–3 sab **PASS** hone ke baad hi **alag se** explicit production deployment approval lo.

| Decision now | Status |
|--------------|--------|
| Production deploy | **DO NOT DEPLOY** |
| Next milestone | **Gates 1, 2, 3 — all PASS** |
| After that | Separate explicit production deployment approval |

---

## Hard pre-deploy gates (mandatory — all currently NOT DONE)

These are **not** optional reminders. Deploy must wait until each is completed and recorded in the evidence table below.

| # | Gate | Required action | Status |
|---|------|-----------------|--------|
| 1 | Database backup | **Actual** production backup create + **isolated DB** par restore dry-run | **NOT DONE** |
| 2 | Index migration | Maintenance window schedule + rollback rehearse | **NOT DONE** |
| 3 | Celery monitoring | Worker health monitoring + alert + export `queued` → `done` verification | **NOT DONE** |

### Gate-specific rules (important)

| Gate | Rule |
|------|------|
| **1** | Sirf backup **command ready** hona **sufficient nahi**. Actual production dump + isolated restore dry-run dono zaroori. Dump path, size, SHA256, restore host, and post-restore smoke (table counts / login) record karo. |
| **2** | Window booked + rollback rehearsed (`migrate leads 0021` / `migrate projects 0034` or named `DROP INDEX`) before any prod migrate. |
| **3** | **Redis healthy ≠ worker healthy.** `/ready/` redis ok hone se Celery worker alive prove nahi hota. Worker process + alert required; one export must reach status `done` (not stop at 202 `queued`). |

### Evidence log (fill when closing each gate)

| Gate | Closed at | Evidence | Closed by |
|------|-----------|----------|-----------|
| 1 | _pending_ | Dump path / SHA256 / restore host / smoke notes: _TBD_ | _TBD_ |
| 2 | _pending_ | Window (IST): _TBD_ · Rollback rehearse notes: _TBD_ | _TBD_ |
| 3 | _pending_ | Worker unit/PID · alert channel · export task_id `queued`→`done`: _TBD_ | _TBD_ |

### Explicit non-claims / coverage gaps

| Item | Status |
|------|--------|
| Full UI E2E (every screen / modal / Tele + CRM) | **NOT TESTED** |
| Exhaustive RBAC matrix (every role × every module × CRUD) | **NOT TESTED** (sample matrix only) |
| 500+ concurrent-user capacity | **NOT PROVEN** — do not claim |

Until gates 1–3 are **PASS**, production deploy remains blocked even if the code package is approved for review.

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

## 3. Production DB backup checklist (Gate 1 — create + restore dry-run)

**Status today:** **NOT DONE** (instructions only; no production dump taken).  
Execute **only after explicit production approval**, on the production host. Gate 1 fails until restore dry-run succeeds.

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
sha256sum "/root/backups/malwa_crm_pre_release_${TS}.sql.gz"
```

4. Record: dump path, size, SHA256, MySQL version, app commit currently running.
5. Optional: filesystem snapshot / Hostinger panel backup if available.
6. **Required:** restore dry-run on a **non-production** MySQL instance (empty schema → import → `SHOW TABLE STATUS` / lead count / admin login against restored DB). Dump alone without restore proof does **not** close Gate 1.
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

### Safe production plan (Gate 2 — window + rollback ready)
**Status today:** **NOT DONE** (plan documented; window not booked; rollback not rehearsed on prod).

1. Complete Gate 1 (backup + restore dry-run) first.
2. Book a **maintenance window** (prefer low traffic). MySQL 8 online DDL usually allows concurrent DML; still expect brief metadata locks — communicate possible short slowdowns on lead/project list.
3. Confirm rollback is ready **before** migrate: reverse migrate commands tested in staging; index names listed for emergency `DROP INDEX`.
4. Deploy order: **backup → deploy code → migrate (in window) → restart workers/API**.
5. Run migrate plan then apply:

```bash
cd /var/www/<crm>/backend
.venv/bin/python manage.py showmigrations leads projects | tee /tmp/mig_before.txt
.venv/bin/python manage.py migrate leads 0022 --plan
.venv/bin/python manage.py migrate projects 0035 --plan
.venv/bin/python manage.py migrate leads 0022
.venv/bin/python manage.py migrate projects 0035
.venv/bin/python manage.py showmigrations leads projects | tee /tmp/mig_after.txt
```

6. Verify indexes exist (`SHOW INDEX FROM leads_lead` / `projects_project`).
7. Smoke login + leads list + dashboard.

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

## 8. Celery worker health (Gate 3)

**Status today:** **NOT DONE**.

| Check | Why it matters |
|-------|----------------|
| Worker process running under supervisor/systemd | Without a worker, `export-leads` can still return **202 queued** while tasks never finish |
| Broker (Redis) reachable | `/ready/` may show redis ok while worker is dead — monitor **worker**, not only Redis |
| Alert on worker exit / queue depth growth | Pending exports look “successful” to the client until timeout/unknown status |
| Pre-deploy probe | Submit one staging/prod-approved test export; confirm status reaches `done` (or refuse with 503 if eager blocked) |

Do not enable user-facing heavy exports in production until Gate 3 is green.

---

## 9. Deployment instructions (blocked until Gates 1–3 PASS)

1. Get **explicit written approval**.
2. Close **Gate 1** (real backup + restore dry-run).
3. Close **Gate 2** (window booked + rollback rehearsed).
4. Close **Gate 3** (Celery worker healthy + monitored).
5. Tag or note commit `17a6b6f`.
6. Deploy artifact built from `17a6b6f` (frontend build + backend).
7. Apply migrations (§4) inside the window.
8. Restart API + Celery **once** after code+migrate.
9. Smoke: login, IVRS verify (Tele), lead create, dashboard, export end-to-end (`queued` → `done`).
10. Monitor errors + Celery 30–60 minutes.
11. If failure: rollback code to previous commit; reverse migrations only if indexes cause harm; restore dump only if data integrity incident.

---

## 10. Remaining risks

| Level | Item |
|-------|------|
| **Blocker until done** | Gate 1 backup + restore dry-run not executed |
| **Blocker until done** | Gate 2 migration window + rollback not ready |
| **Blocker until done** | Gate 3 Celery worker monitoring not confirmed |
| High (capacity) | 500+ concurrent users **not proven**; SLO only ~20 on Phase 3 Waitress staging |
| Medium | Index build time/locks on large production tables |
| Medium | Export 202 with worker down ⇒ indefinite pending |
| Low | Full UI E2E **NOT TESTED** |
| Low | Exhaustive RBAC matrix **NOT TESTED** (sample only) |
| Low | Local junk files still on disk (untracked) — do not copy to prod |

---

## 11. Status summary

| Area | Status |
|------|--------|
| Clean release commit | **PASS** |
| Version recorded | **PASS** |
| Gate 1 — prod backup + restore dry-run | **NOT DONE** |
| Gate 2 — migration window + rollback ready | **NOT DONE** |
| Gate 3 — Celery worker health monitor | **NOT DONE** |
| IVRS FE/BE consistency | **PASS** |
| Isolated regression / API / FE smoke | **PASS** |
| Sample RBAC | **PASS** |
| Full UI E2E | **NOT TESTED** |
| Exhaustive RBAC matrix | **NOT TESTED** |
| 500+ capacity | **NOT PROVEN** |
| Production deploy | **NOT EXECUTED** |

---

## Verdict

| Decision | Status |
|----------|--------|
| Code package ready for human review / scheduling | **READY FOR APPROVAL** |
| Production go-live **right now** | **NOT READY TO DEPLOY** |
| Gate 1 / 2 / 3 | **NOT DONE** / **NOT DONE** / **NOT DONE** |
| Next milestone | Close Gates **1 → 2 → 3** with evidence in this file |
| After all gates PASS | Request **separate explicit** production deployment approval |

**Recommendation reiterated:** Do not deploy to production until Gates 1, 2, and 3 are all **PASS**.  
No production deploy, restart, migration, or data change has been performed in this packaging work.  
Do not claim 500+ concurrent-user capacity. Full UI E2E and exhaustive RBAC remain **NOT TESTED**.
