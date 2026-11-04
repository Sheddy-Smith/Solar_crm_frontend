# Malwa Solar CRM — Final Code Quality & Deployment Readiness Audit

**Date:** 2026-11-04  
**Scope:** Local scalability changes only (Phase 2/3 + query optimizations).  
**Production:** Not modified. No deploy, restart, migration, DB write, or load test against production.  
**Verdict:** Local changes are **backward-compatible and safe to keep on the isolated staging stack**. They are **not** a claim of 500+ concurrent capacity. Explicit approval is required before any production change.

---

## Executive summary

| Area | Result |
|------|--------|
| Isolated staging API smoke (login → CRUD lists → stats → dashboard → export) | **PASS** |
| Unit tests (capacity / circuit / scale foundations) | **PASS** (7/7) |
| Lead stats aggregates vs independent SQL | **PASS** |
| Pending-flow fast counts vs full path (seeded staging) | **PASS** |
| Pagination hard cap `max_page_size=200` | **PASS** |
| Export refuses silent eager success when `ALLOW_EAGER_EXPORTS=0` | **PASS** (code + unit path) |
| Cache stampede lock + Redis exception fallback | **PASS** (code review + live cache hit) |
| Frontend AbortSignal + no POST-after-401 retry | **PASS** (code review) |
| Security defaults for production settings module | **PASS** with notes |
| Sustained 500-user SLO | **FAIL** (Phase 3 evidence: SLO only at 20 users) |
| Full UI E2E / every module RBAC matrix | **NOT TESTED** |
| Binary file upload/download round-trip | **NOT TESTED** this pass |

**Do not deploy to production without explicit approval.** Remaining medium issues below should be reviewed first for production env flags (`ALLOW_EAGER_EXPORTS=0`, Redis+worker, index migrations offline window).

---

## Evidence artifacts

| Artifact | Path |
|----------|------|
| API smoke | `scripts/phase3_results/code_quality_api_checks.json` |
| DB / cache checks | `scripts/phase3_results/code_quality_db_checks.json` |
| Phase 3 capacity | `docs/PHASE3_FINAL_VERIFICATION.md` |
| Env guidance | `docs/ENV_SCALING.md` |
| Scale deliverables | `docs/SCALE_500_FINAL_DELIVERABLES.md` |

**Staging process note:** Waitress on `127.0.0.1:8060` was already running against MySQL `:3307` / Memurai db5. Live smoke validates response shapes and auth. Aggregate/pending correctness was also verified in-process against current working-tree code on the staging DB.

---

## 1. Regression testing

| Case | Classification | Evidence |
|------|----------------|----------|
| Health `/health/` | **PASS** | 200 `{status: ok}` |
| Ready `/ready/` | **PASS** | 200 `database:ok`, `redis:ok` (no secrets) |
| Login | **PASS** | access + refresh tokens |
| JWT refresh | **PASS** | 200 with `access` (+ `refresh` keys present) |
| `/users/me/` | **PASS** | `staging.admin@local.test` |
| Leads list | **PASS** | paginated; count hint 500 |
| Lead search / filters | **PASS** | list endpoint with search params 200 |
| Lead PATCH persistence | **PASS** | remarks `quality-audit-ping` persisted on lead 500 |
| Follow-ups list | **PASS** | 200 |
| Projects list | **PASS** | 200; count hint 232 |
| Site surveys list | **PASS** | 200; count hint 166 |
| Quotations list | **PASS** | 200 (empty dataset OK) |
| Leads stats shape | **PASS** | keys include `total`, `won`, `overdue`, `today_followups`, period fields |
| Dashboard unified shape | **PASS** | `overview`, `sales`, `projects`, `finance`, `alerts`, `reports`, `filters` |
| Reports dashboard | **PASS** | 200 |
| Export leads (queued) | **PASS** | 202 `{task_id, status: queued}` with Redis/Celery non-eager on staging |
| Unauthenticated export | **PASS** | 401 |
| Logout | **NOT TESTED** | Client-side token clear; no dedicated API call exercised |
| Customer duplicate detection | **NOT TESTED** | Code path unchanged by scale pass; no dedicated smoke |
| File upload / download | **NOT TESTED** | No binary round-trip this pass |
| Full RBAC matrix (every role × module) | **NOT TESTED** | Module permission still on Dashboard/Reports; only unauth + admin smoke |
| Frontend visual widgets / empty states | **NOT TESTED** | Code review only (see §5) |
| API ↔ FE response format compatibility | **PASS** | List/stats/dashboard keys match existing FE expectations; no breaking renames observed |

Unit tests:

```
manage.py test malwa_solar.tests_capacity_limits
                 malwa_solar.tests_circuit_and_export
                 malwa_solar.tests_scale_foundations
→ Ran 7 tests in 0.023s — OK
```

---

## 2. Database safety

| Check | Classification | Notes |
|-------|----------------|-------|
| Lead stats `total` / `won` / `new` vs raw SQL | **PASS** | `stats_match_*`: true on staging seed |
| Pending-flow fast vs full (work_orders, quotations, installation, invoices) | **PASS** | Exact match 100/100 each |
| Pending approx (dispatch / materials / delayed) | **PASS** | 0/0 aligned on seed |
| Aggregate ORM correctness (leads analytics / project KPI) | **PASS** | Reviewed; Count/Q filters preserve prior semantics |
| Overdue / today follow-up filters | **PASS** (logic) | Date filters retained; list slices capped `[:200]` for widget payloads — **totals still from aggregates**, not slice |
| Pagination boundaries | **PASS** | Requested `page_size=5000` → **200 rows** returned |
| Index migrations additive only | **PASS** | `0022_lead_followup_query_indexes`, `0035_project_status_list_indexes` — `AddIndex` only, no data rewrite |
| Silent exclusion of soft-deleted rows | **PASS** | Existing `is_deleted` filters retained on hot paths |
| Report totals vs SQL (full reports module) | **NOT TESTED** | Lead stats verified; full finance/OM report SQL not re-run |
| Production migration dry-run | **NOT TESTED** | Intentionally skipped (no prod access) |

**Risk note:** Large-table `AddIndex` on production MySQL can lock/slow writes depending on version/online DDL. Schedule a maintenance window; migrations are still **non-destructive**.

---

## 3. Cache correctness

| Check | Classification | Notes |
|-------|----------------|-------|
| Key includes filter params | **PASS** | `unified_dashboard:{md5(sorted params)}` |
| Key includes user id | **NOT APPLICABLE / MEDIUM watch** | `cache_key_has_user: false`. Payload is global CRM aggregates; endpoint gated by `HasModulePermission` (`Dashboard` / `can_view`). **Safe today**; must add user/role to key if dashboard becomes scoped |
| Stampede lock | **PASS** | `cache.add(lock_key)`; waiters poll ~3s then rebuild; lock TTL `min(30, CACHE_TTL)` |
| Lock/cache exception → degrade | **PASS** | `try/except` around get/set/add/delete; never 500 on Redis deserialize/conn issues |
| Redis failure fallback (IGNORE_EXCEPTIONS) | **PASS** | `django-redis` + manual try/except; throttles Soft* classes |
| Write-triggered invalidation | **MEDIUM** | No explicit delete of dashboard payload after CRM writes; freshness = TTL (env `DASHBOARD_CACHE_TTL`, default 45–60s). Acceptable for aggregates; not for per-user sensitive slices |
| Cross-user sensitive bleed | **PASS** (current design) | Global aggregates only; auth required |
| Live cache effectiveness | **PASS** | Unified dashboard ~61 ms cold / ~16 ms warm (same bytes) |

---

## 4. Celery export safety

| Check | Classification | Notes |
|-------|----------------|-------|
| Non-eager queue returns 202 + `task_id` | **PASS** | Live staging |
| Eager + `ALLOW_EAGER_EXPORTS=0` → 503 `status: unavailable` | **PASS** | `base.ALLOW_EAGER_EXPORTS` default **False**; `_refuse_eager_heavy_export()` |
| Eager + `ALLOW_EAGER_EXPORTS=1` (dev/staging defaults) | **PASS** (by design) | Local-only convenience; **must be 0 in production** |
| Task status endpoint | **PASS** (code) | `export-status/<task_id>` → running/done/unknown |
| Error reporting in task | **PASS** (code) | Status cache + logging; import/thumbnail return `status: error` reasons |
| Duplicate submit | **PASS** (partial) | New Celery task id each POST; file path keyed by task id (idempotent per task). No client-side single-flight |
| Broker/Redis unavailable without eager refuse | **MEDIUM** | If `CELERY_TASK_ALWAYS_EAGER=False` but broker down, `.delay()` may raise → 500 unless middleware catches. Prefer ready-check + worker health before advertise exports |
| Silent success when not queued | **PASS** | Refused path returns 503, not 200/202 fake success |

---

## 5. Frontend reliability

| Check | Classification | Notes |
|-------|----------------|-------|
| AbortSignal wiring | **PASS** | `src/api.js` merges external `signal` with timeout controller |
| No auto-retry of non-idempotent POST after 401 | **PASS** | Only GET/HEAD/OPTIONS refresh+retry |
| Pagination maximum 200 (API) | **PASS** | `API_MAX_PAGE_SIZE` default 200; enforced server-side |
| App.jsx page_size literals | **PASS** | Core App paths use `page_size: 200` |
| Other modules still request 500/1000/2000 | **MEDIUM** | ~45 literals outside App (accounts, inventory, OM, etc.). Harmless: API caps at 200; may surprise FE expecting full sets |
| Dashboard partial failure | **PASS** (code) | Backend OM/alerts sections catch+log; FE `.catch` notifies without hard crash |
| Loading / error / empty states | **NOT TESTED** | Manual UI pass not run |

---

## 6. Security and configuration

| Check | Classification | Notes |
|-------|----------------|-------|
| `SECRET_KEY` required in base | **PASS** | `env('SECRET_KEY')` — no empty default in base |
| Staging-only default secret | **PASS** (staging) | `staging_local` default marked not-for-production |
| Production `DEBUG` | **PASS** | `production.py` → `DEBUG = False` |
| CORS credentials + allowlist | **PASS** | Env-driven `CORS_ALLOWED_ORIGINS` |
| CSRF (production) | **PASS** | `CSRF_COOKIE_SECURE`, `CSRF_TRUSTED_ORIGINS` env |
| Throttling + Redis soft-fail | **PASS** | Safe throttle classes; `IGNORE_EXCEPTIONS=True` |
| File upload memory limit | **PASS** | `FILE_UPLOAD_MAX_MEMORY_SIZE = 10MB` |
| API permissions on scaled endpoints | **PASS** | Dashboard / Reports still `HasModulePermission` |
| Health/ready secret leakage | **PASS** | Status strings only (`ok` / `error`) |
| `ALLOW_EAGER_EXPORTS` prod default | **PASS** | `False` in base; ensure prod env does not override to `1` |
| Observability request logging | **PASS** | Opt-in via env; no body/secret logging by design |

---

## 7. Performance regression (isolated staging only)

**No production load tests. No 500+ capacity claim.**

| Metric | Before (Phase 3 Locust baseline) | After (this audit spot-check) |
|--------|----------------------------------|-------------------------------|
| Unified dashboard latency | Phase 3: SLO met only at **20** users; collapse at higher concurrency | Spot: ~61 ms / ~16 ms (single admin, cached) |
| Lead stats | — | ~25 ms single request |
| Query count | Reduced on pending/stats/list lean QS (code) | **NOT TESTED** with Django Debug toolbar this pass |
| P50/P95/P99 multi-user | See Phase 3 tables | **NOT RETESTED** after latest query opts |
| Error rate @20 | Phase 3 within SLO | **NOT RETESTED** |
| Error rate @500 | Phase 3 fail / connection errors | Still **FAIL** historically |
| Memory | Host ~saturated in Phase 3 | **NOT RETESTED** |
| Cache hit | Warm dashboard faster | Observed warm ~4× faster |

**Capacity conclusion unchanged:** Max users meeting Phase 3 SLO (p95≤2s, p99≤5s, err≤1%) = **20** on Waitress+local MySQL+Memurai. Do not market or deploy as 500-ready.

---

## 8. Findings by severity

### Critical
*None identified for correctness of the local change set under isolated staging.*

### High
| ID | Finding | Status |
|----|---------|--------|
| H1 | Sustained multi-user SLO beyond ~20 users not met on staging evidence | **FAIL** (capacity — deploy gating, not a code correctness bug) |
| H2 | Index migrations not applied/verified on production | **NOT TESTED** (blocked by policy) — must be planned |

### Medium
| ID | Finding | Status |
|----|---------|--------|
| M1 | Dashboard cache lacks user/permission digest (OK while global) | **PASS** with watch item |
| M2 | No write-time dashboard cache bust (TTL staleness ≤ ~45–60s) | **PASS** with product acceptance |
| M3 | FE modules still request `page_size` > 200 (~45 literals) | **MEDIUM** — API safe; UX may truncate |
| M4 | Export `.delay()` without broker can 500 if eager refuse not active | **MEDIUM** — set Redis+worker or keep eager refuse |
| M5 | Live Waitress process may predate some late query edits | **MEDIUM** — restart staging API before trusting live timings for latest code |

### Low
| ID | Finding | Status |
|----|---------|--------|
| L1 | Logout / duplicate-customer / file binary paths not smoke-tested | **NOT TESTED** |
| L2 | Full reports SQL parity beyond leads stats | **NOT TESTED** |

---

## 9. Exact list of files changed (scalability / quality worktree)

### Modified (tracked)
```
.dockerignore
.gitignore
backend/apps/accounts/views.py
backend/apps/dashboard/services.py
backend/apps/leads/analytics_service.py
backend/apps/leads/views.py
backend/apps/om/pending_flow.py
backend/apps/projects/kpi_service.py
backend/apps/projects/views.py
backend/apps/reports/services.py
backend/apps/reports/views.py
backend/gunicorn.conf.py
backend/malwa_solar/__init__.py
backend/malwa_solar/asgi.py
backend/malwa_solar/keepalive.py
backend/malwa_solar/pagination.py
backend/malwa_solar/settings/base.py
backend/malwa_solar/settings/development.py
backend/malwa_solar/throttling.py
backend/malwa_solar/urls.py
backend/malwa_solar/wsgi.py
src/App.jsx
src/api.js
src/hooks/usePwaInstall.js
src/index.css
src/lib/appUpdate.js
src/lib/pwaInstall.js
```

### Added (untracked — scale/staging core)
```
backend/apps/accounts/management/commands/seed_staging_anonymized.py
backend/apps/leads/migrations/0022_lead_followup_query_indexes.py
backend/apps/projects/migrations/0035_project_status_list_indexes.py
backend/apps/reports/tasks.py
backend/malwa_solar/celery.py
backend/malwa_solar/circuit_breaker.py
backend/malwa_solar/health.py
backend/malwa_solar/http_client.py
backend/malwa_solar/mail.py
backend/malwa_solar/middleware_observability.py
backend/malwa_solar/settings/staging_local.py
backend/malwa_solar/settings/staging_mysql.py
backend/malwa_solar/tests_capacity_limits.py
backend/malwa_solar/tests_circuit_and_export.py
backend/malwa_solar/tests_scale_foundations.py
docker-compose.staging.yml
docs/AUDIT_500_CONCURRENT_USERS.md
docs/CRM_SCALE_READINESS_AUDIT.md
docs/ENV_SCALING.md
docs/PHASE2_*.md
docs/PHASE3_*.md
docs/SCALE_500_FINAL_DELIVERABLES.md
docs/FINAL_CODE_QUALITY_AUDIT.md
scripts/setup_staging_mysql.ps1
scripts/start_phase3_staging_api.py
scripts/start_local_staging_api.py
scripts/locustfile_staging.py
scripts/run_phase3_*.py
scripts/run_code_quality_api_checks.py
scripts/mint_staging_tokens.py
… (additional phase2/3 harness scripts under scripts/)
```

Unrelated local junk (`_tmp_*`, `_vite.*`, postman dumps) should **not** ship to production.

---

## 10. Rollback instructions

### Local / staging code
1. `git checkout --` the modified tracked files listed above (or discard the feature branch).
2. Remove untracked scale modules if desired (`celery.py`, `health.py`, staging settings, new migrations **only if never applied**).
3. Restart Waitress / stop Locust / leave MySQL `:3307` as-is or drop `malwa_crm_staging` if disposable.

### If index migrations were applied on a DB
```sql
-- MySQL example (names from migrations)
ALTER TABLE leads_lead DROP INDEX lead_del_status_created_idx;
ALTER TABLE leads_lead DROP INDEX lead_del_assignee_created_idx;
ALTER TABLE leads_lead DROP INDEX lead_del_next_followup_idx;
ALTER TABLE leads_followup DROP INDEX followup_del_status_sched_idx;
ALTER TABLE projects_project DROP INDEX project_del_status_created_idx;
ALTER TABLE projects_sitesurvey DROP INDEX survey_status_date_idx;
```
Or reverse with Django: `migrate leads 0021` / `migrate projects 0034` on **that** database only.

### Production (only if someone deployed despite hold)
1. Revert env: `REDIS_URL` / worker / concurrency per prior systemd unit (`docs/ENV_SCALING.md` Rollback).
2. Redeploy previous release artifact; restart API once.
3. Do **not** force-drop indexes under load without a window.
4. `/health/` remains independent of Redis; set `READY_REQUIRE_REDIS=0` if Redis rolled back.

---

## 11. Deployment readiness checklist (gates)

| Gate | Status |
|------|--------|
| Code quality on isolated staging | **Ready for review** |
| Explicit human approval | **Required — waiting** |
| Production env: `DEBUG=0`, `ALLOW_EAGER_EXPORTS=0`, real `SECRET_KEY` | Confirm before deploy |
| Redis + Celery worker if async exports enabled | Confirm before deploy |
| Index migrations maintenance window | Plan before apply |
| Load test on production-like Linux+Gunicorn+MySQL | Still required before any 100+ concurrent claim |
| Production deploy / restart / migration | **Blocked** |

---

## 12. Stop condition

Audit complete. **No production actions taken.**  
Awaiting **explicit approval** before any production deployment, migration, restart, or VPS change.
