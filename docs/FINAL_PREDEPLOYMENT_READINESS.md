# Malwa Solar CRM — Final Pre-Deployment Readiness

**Date:** 2026-11-04  
**Production:** Untouched (no deploy, restart, migration, DB write, or load test).  
**Capacity claim:** None. This report does **not** claim 500+ concurrent-user capacity.  
**Stop condition:** Staging verification complete — waiting for **separate explicit production deployment approval**.

---

## Verdict

Medium-risk audit items (cache invalidation, FE `page_size` alignment, Celery broker-down safety, missing regressions) are addressed and verified on **isolated staging** (`127.0.0.1:8060` + MySQL `:3307` + Memurai db5).

| Gate | Result |
|------|--------|
| Predeploy API regression (21 cases) | **PASS** (0 failures) |
| Unit tests (hardening + scale foundations) | **PASS** |
| SQL aggregate parity (leads total/won) | **PASS** |
| RBAC sample matrix (6 cells) | **PASS** |
| Broker-down → 503 `queued:false` + recovery | **PASS** |
| File upload/download | **PASS** |
| Logout refresh blacklist | **PASS** |
| Production deploy | **BLOCKED** — awaiting approval |

---

## Exact version tested

| Field | Value |
|-------|-------|
| Git HEAD | `03ec5d3e5c7ad9bdd2770322975e083c8b2af9cf` |
| Describe | `03ec5d3-dirty` |
| Dirty worktree | **Yes** (hardening + prior scale changes uncommitted) |
| Staging API | Waitress `127.0.0.1:8060`, settings `malwa_solar.settings.staging_mysql` |
| Restart | Isolated staging API **restarted** for this pass (production not restarted) |

Evidence:

- `scripts/phase3_results/predeploy_regression.json`
- `scripts/phase3_results/predeploy_broker_recovery.json`
- `scripts/phase3_results/predeploy_db_rbac_broker.json`
- `scripts/phase3_results/predeploy_code_version.txt`

---

## A. Dashboard cache invalidation

| Check | Classification | Notes |
|-------|----------------|-------|
| Identify write ops affecting aggregates | **PASS** | Signals on Lead, FollowUp, Quotation, Project, SiteSurvey, WorkOrder, ProjectPayment, Payment |
| Targeted invalidation | **PASS** | Generation counter `unified_dashboard:gen` bumped; all filter keys miss next read |
| Cross-user leakage prevention | **PASS** | Cache scope `crm_global_v1`; payload is org-wide aggregates; access still gated by `Dashboard:can_view`. Key uses `shared` fingerprint (not per-user) **because builder ignores `request.user`** — no private rows cached |
| After lead/project/follow-up updates | **PASS** | Unit: lead create bumps gen. Staging: lead PATCH → dashboard 200 (~128–138 ms rebuild) |
| TTL fallback | **PASS** (documented) | `DASHBOARD_CACHE_TTL` (staging 60s) remains a safety net for modules not on the watch list (inventory/AMC/OM churn). Stale window without a watched write ≤ TTL |

**TTL consistency guarantee:** After any watched CRM write, the next dashboard read rebuilds. Unwatched writes may remain stale up to TTL seconds. This is acceptable for aggregate dashboards; do not cache user-private data under the global scope.

---

## B. Frontend pagination alignment

| Check | Classification | Notes |
|-------|----------------|-------|
| Search `page_size` > 200 | **PASS** | 18 frontend files updated; **0** remaining literals > 200 |
| Cap aligned with API | **PASS** | API `API_MAX_PAGE_SIZE` default 200; FE requests ≤ 200 |
| Lists still paginate | **PASS** | Staging: leads/projects return 200 rows; surveys 166 (full set under cap) |
| Records beyond 200 | **PASS** (accepted) | Server already capped; FE no longer pretends to fetch 1000–2500. Use filters / next page for the rest |

---

## C. Celery broker-down behavior

| Check | Classification | Notes |
|-------|----------------|-------|
| Broker unavailable on submit | **PASS** | `_queue_or_503` catches exceptions → **503** `{status: unavailable, queued: false}` — **no `task_id`** |
| Never fake success | **PASS** | Unit + staging in-process probe |
| Duplicate submit safety | **PASS** | 45s dedupe key returns same `task_id` with `deduped: true` (live staging) |
| Broker recovery | **PASS** | Subsequent successful `.delay()` returns 202 with new task id |
| Eager refuse still works | **PASS** | `ALLOW_EAGER_EXPORTS=0` + eager → 503 |

---

## D. Missing regression tests

| Case | Classification | Evidence |
|------|----------------|----------|
| File upload/download | **PASS** | Site-survey photo slot upload 201; PNG download 69 bytes |
| RBAC matrix (sample) | **PASS** | NoPerm/DashOnly/LeadView × dashboard & leads (6/6) |
| Full every-role × every-module matrix | **NOT TESTED** | Sample covers critical gates; exhaustive matrix remains optional follow-up |
| Logout + token invalidation | **PASS** | `POST /auth/logout/` blacklists refresh; refresh → 401 `Token is blacklisted` |
| Duplicate mobile search | **PASS** | Search by existing mobile returns ≥1 hit |
| Duplicate IVRS create rejected | **PASS** | 400 `ivrs_number already exists` |
| Existing-customer basic prefill UX | **NOT TESTED** | FE blur flow unchanged; API search path verified |

---

## E. Latest-code staging verification

| Step | Classification | Result |
|------|----------------|--------|
| Restart isolated staging API | **PASS** | Waitress restarted on `:8060` only |
| Code version recorded | **PASS** | `03ec5d3-dirty` |
| API smoke / regression | **PASS** | 21/21 |
| Unit tests | **PASS** | ExportBrokerSafety (3), capacity (2), circuit (2), foundations (3), DashboardCache (3), Logout (1) |
| Dashboard SQL comparison | **PASS** | ORM total 500 / won 100 == SQL |
| FE/BE compatibility | **PASS** | List/stats/dashboard/export/logout shapes OK; `page_size` aligned |
| Timings after restart | **PASS** | Dashboard cold ~15–143 ms, warm ~15 ms; leads list ~59 ms; projects ~627 ms; surveys ~257 ms |

---

## Tests executed

```text
# Unit (development settings / SQLite test DB)
manage.py test malwa_solar.tests_predeploy_hardening.ExportBrokerSafetyTests \
               malwa_solar.tests_capacity_limits \
               malwa_solar.tests_circuit_and_export \
               malwa_solar.tests_scale_foundations
→ OK (10)

manage.py test malwa_solar.tests_predeploy_hardening.DashboardCacheInvalidationTests \
               malwa_solar.tests_predeploy_hardening.LogoutBlacklistTests --keepdb
→ OK (4)

# Staging live
python scripts/run_predeploy_regression.py
→ fail_count=0 (21 cases)

# Staging in-process
SQL stats + RBAC matrix + broker down/recovery probes
→ PASS
```

---

## Files changed (this hardening pass)

### Backend
- `backend/apps/dashboard/services.py` — generation-based invalidation, scoped cache keys
- `backend/apps/dashboard/signals.py` — **new** write watchers
- `backend/apps/dashboard/apps.py` — connect signals in `ready()`
- `backend/apps/dashboard/views.py` — leakage notes / shared cache policy
- `backend/apps/reports/views.py` — broker-safe queue, dedupe, never fake 202
- `backend/apps/accounts/views.py` — `LogoutView` (refresh blacklist)
- `backend/apps/accounts/urls.py` — `auth/logout/`
- `backend/apps/leads/models.py` — Meta indexes aligned with migration 0022
- `backend/apps/projects/models.py` — Meta indexes aligned with migration 0035
- `backend/malwa_solar/settings/base.py` — `DashboardConfig` path
- `backend/malwa_solar/tests_predeploy_hardening.py` — **new**
- `backend/malwa_solar/tests_scale_foundations.py` — max page_size assert ≤ 200

### Frontend
- `src/api.js` — logout blacklist call; `page_size` defaults ≤ 200
- 17 JSX modules — `page_size` capped at 200 (accounts, inventory, OM, projects, tele, etc.)

### Scripts / docs
- `scripts/run_predeploy_regression.py` — **new**
- `docs/FINAL_PREDEPLOYMENT_READINESS.md` — this file

---

## Remaining risks

| Severity | Risk | Mitigation |
|----------|------|------------|
| High (capacity) | Sustained SLO still only proven ~20 users on Phase 3 Waitress staging | Do not claim 500+; size prod separately |
| Medium | Index migrations need a maintenance window on production MySQL | Apply only with explicit approval |
| Medium | Unwatched modules (inventory/AMC/OM) can stale dashboard ≤ TTL | Accept TTL or extend signal watch list |
| Medium | Export queues to Redis even if **worker** is down (task sits pending) | Run Celery worker in prod; monitor queue depth |
| Low | Exhaustive RBAC matrix not fully enumerated | Sample matrix PASS; expand if needed |
| Low | Dirty git tree — deploy must package exact files listed | Commit/tag before production package |

---

## Rollback instructions

### Code
1. Revert hardening files (dashboard services/signals, reports views, accounts logout, FE page_size, api logout).
2. Restart **only** the environment being rolled back.

### Cache
- Harmless: generation key ages out; or `DEL unified_dashboard:gen` on Redis.

### Auth logout
- Removing `LogoutView` returns FE to local token clear only (prior behavior). Blacklisted tokens remain blacklisted until expiry.

### Indexes
- If migrations were applied on a DB and must reverse: `migrate leads 0021` / `migrate projects 0034` on **that** DB only (never production without approval).

### Production
- **Do not** apply any of the above to production without a new explicit approval.

---

## Production deployment approval checklist (not executed)

- [ ] Explicit written approval for production deploy
- [ ] `DEBUG=0`, `ALLOW_EAGER_EXPORTS=0`, real `SECRET_KEY`
- [ ] Redis + Celery worker if async exports enabled
- [ ] Index migration window scheduled
- [ ] Package from a clean tagged commit (resolve dirty tree)
- [ ] No 500+ capacity marketing based on this report

---

**Status: READY FOR REVIEW — awaiting separate explicit production deployment approval.**
