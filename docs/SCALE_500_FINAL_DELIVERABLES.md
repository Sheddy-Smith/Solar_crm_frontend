# Malwa Solar CRM — High-Traffic / 500+ Readiness Deliverables

**Date:** 2026-11-04  
**Production:** https://crm.ecomalwa.com/ — **not modified** (no deploy, restart, DB writes, migrations, or load tests against prod).

---

## 1. Architecture audit

See [`docs/AUDIT_500_CONCURRENT_USERS.md`](AUDIT_500_CONCURRENT_USERS.md) (full prioritized list with file paths).

Prior evidence: Phase 2/3 reports under `docs/PHASE2_*`, `docs/PHASE3_*`.

---

## 2. Bottlenecks found (summary)

Critical: unified dashboard fan-out; `pending_counts_global` list materialization; lead/project analytics loading rows into Python; worker pool saturation under load.

High: project list over-prefetch; lead stats multi-COUNT; FE `page_size` 1000+; eager Celery exports blocking workers when Redis off.

---

## 3. Files changed (this pass) and why

| File | Why |
|------|-----|
| `apps/om/pending_flow.py` | Fast DB aggregate counts for dashboard |
| `apps/leads/views.py` | Aggregate stats; cap overdue/today lists |
| `apps/leads/analytics_service.py` | Bounded range + aggregate totals + iterator |
| `apps/projects/kpi_service.py` | DB aggregates instead of full materialization |
| `apps/projects/views.py` | Lean list queryset; survey photos on retrieve only |
| `apps/dashboard/services.py` | Cache stampede lock |
| `apps/reports/views.py` | Refuse heavy eager exports (503) unless allowed |
| `malwa_solar/middleware_observability.py` | Optional request timing |
| `malwa_solar/settings/base.py` (+ staging/dev) | Middleware, `ALLOW_EAGER_EXPORTS` |
| `src/api.js` | AbortSignal passthrough; no POST 401 auto-retry |
| `src/App.jsx` | Cap `page_size` to 200 |
| `docs/AUDIT_*`, `ENV_SCALING.md`, this file | Documentation |

Earlier Phase 2/3 foundations remain: health/ready, Safe throttles, Redis fail-open, Celery tasks, circuit breaker, index migrations, progressive home dashboard, Locust scripts.

---

## 4. Database query optimization

- Lead stats: one `aggregate()` for status buckets.
- Pending dashboard counts: `Count`/`Exists` path (`pending_counts_global_fast`).
- Project KPI: `Count`/`Sum`/`Avg` + bounded trend iterator.
- Project/site-survey list: remove unnecessary prefetches.
- Indexes 0022/0035 in repo — **not applied to Hostinger** without approval (applied on local MySQL staging earlier).

---

## 5. Redis integration

- Env `REDIS_URL`; LocMem when disabled.
- Shared `throttling` cache alias; `IGNORE_EXCEPTIONS` / Safe* throttles.
- Dashboard cache + stampede lock.
- Multi-instance **requires** Redis enabled on all API nodes.
- Failures must not 500 the API (documented + implemented).

---

## 6. Background tasks

- Celery tasks: CSV/XLSX export, import, bulk notify, thumbnail stub.
- Idempotent file/cache keys; timeouts; retries on OSError/ConnectionError.
- Without Redis: eager mode; **exports return 503** unless `ALLOW_EAGER_EXPORTS=1`.

---

## 7. Fault tolerance

- `/health/` liveness; `/ready/` DB (+ optional Redis).
- Circuit breakers: SMTP + outbound HTTP.
- Controlled 429 via DRF throttles; 503 on not-ready / export unavailable.
- Graceful widget errors on home dashboard FE.
- Does **not** intentionally crash under load.

---

## 8. Frontend

- Progressive home dashboard + widget errors (Phase 2).
- AbortSignal support in `request()`.
- `page_size` capped to pagination max.
- No infinite retry; no blind POST retry after 401.

---

## 9–11. Env / Gunicorn examples

See [`docs/ENV_SCALING.md`](ENV_SCALING.md) for 1 vCPU / 4–8 vCPU / multi-instance examples.  
Gunicorn: `backend/gunicorn.conf.py` (sync workers, env-driven).  
Linux staging: `scripts/start_phase3_gunicorn.sh`.

---

## 12. Locust

- `scripts/locustfile_staging.py`
- Phase 3 ramp: `scripts/run_phase3_locust_ramp.py`
- Results: `scripts/phase3_results/phase3_ramp_summary.json`

**Environment for Phase 3:** MySQL `:3307` `malwa_crm_staging` + Memurai Redis + Waitress 4 threads on `:8060` (not Gunicorn — Windows `fcntl`).

| Users | Fail% | P95 | SLO (p95≤2s, err≤1%) |
|------:|------:|----:|:---:|
| 20 | 0 | 940 | PASS |
| 40–200 | 0 | ≥2300 | FAIL latency |
| 300 | 2.9 | 4900 | FAIL |
| 500 | 73.8 | — | Collapse |
| 750–1000 | skipped | | |

**Max sustainable under Phase 3 SLO: ~20 concurrent users on that stack.**  
**Zero hard failures through 200** (latency above SLO).  
**500+ not demonstrated.**

---

## 13. Rollback

1. Revert this branch / restore listed files.
2. Leave production `REDIS_URL=disabled` until approved.
3. Do not apply index migrations on Hostinger until approved.
4. Staging: stop Waitress `:8060`; stop mysqld using `.staging-mysql` only (never MySQL80 prod-like host DB).

---

## 14. Remaining risks / infra dependencies

1. Hostinger MySQL hourly connection quota.
2. Production Redis still disabled → LocMem throttles not multi-instance safe.
3. True Gunicorn multi-worker proof needs **Linux** staging.
4. Unified Insights UI still one `dashboardApi.unified()` call (backend cheaper, FE not progressive).
5. Thumbnail Celery task still unwired to uploads.
6. VPS upgrade (CPU/RAM/Redis/dedicated DB) required before 500+ is realistic — app is now **env-scalable**, not magically 500+-capable on 1 vCPU.

---

## Acceptance criteria check

| Criterion | Status |
|-----------|--------|
| Existing functionality preserved | Yes (API shapes kept) |
| No production data loss / changes | Yes |
| No hard dependency on VPS size | Yes (env config) |
| Multi-instance support | Ready **when Redis enabled** |
| Shared cache/throttle | Ready with Redis |
| Dashboard queries optimized | Improved; Insights still heavy |
| Graceful degradation | Partial–good |
| DB failures ≠ uncontrolled crashes | Ready (`/ready/`, timeouts) |
| Background ops off request path | Ready with Redis worker |
| 500+ via realistic staging | **Not met — do not claim** |

**Stop here. Await separate approval before any production deployment.**
