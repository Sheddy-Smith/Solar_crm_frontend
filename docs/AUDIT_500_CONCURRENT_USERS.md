# Malwa Solar CRM — Complete Performance Audit (500+ readiness)

**Date:** 2026-11-04  
**Method:** Full codebase inspection + Phase 2/3 staging Locust evidence  
**Production:** not modified  

**Capacity verdict (evidence-based):** Staging MySQL + Waitress 4 threads met P95≤2s SLO only at **~20** concurrent users; collapse ~**500**. **Do not claim 500+ capacity.**

---

## Architecture readiness (today)

| Capability | Status |
|------------|--------|
| Env-based config (workers, Redis, DB timeouts, throttles) | Ready |
| `/health/` + `/ready/` | Ready |
| Redis fail-open cache + Safe* throttles | Ready (needs Redis for multi-instance) |
| Celery export/import tasks | Partial (eager when Redis off) |
| Progressive home dashboard (FE) | Ready |
| Unified Insights dashboard | **Bottleneck** (monolith) |
| Index migrations 0022 / 0035 | In repo (prod apply needs approval) |
| Gunicorn on Windows staging | Blocked (`fcntl`); Linux script exists |
| Multi-instance shared throttle/cache | Requires `REDIS_URL` |

---

## Prioritized bottlenecks

### Critical

| # | Issue | Files | Fix direction | Done? |
|---|-------|-------|---------------|-------|
| 1 | Unified dashboard sync fan-out | `apps/dashboard/services.py` | Cache stampede lock; reduce nested work | Partial |
| 2 | `pending_counts_global` materializes lists | `apps/om/pending_flow.py` | Fast Count/Exists path | **Implementing** |
| 3 | `lead_analytics` loads all rows to Python | `apps/leads/analytics_service.py` | SQL group-by / bounded range | **Implementing** |
| 4 | `project_kpi_analytics` loads all projects | `apps/projects/kpi_service.py` | DB aggregates + `is_deleted` | **Implementing** |
| 5 | Worker pool ≪ load (validated) | gunicorn / Waitress | Infra + fix CPU hogs first | Partial |

### High

| # | Issue | Files | Done? |
|---|-------|-------|-------|
| 6 | Project list over-prefetch | `apps/projects/views.py` | **Implementing** |
| 7 | Lead stats 10× COUNT | `apps/leads/views.py` | **Implementing** |
| 8 | Unpaginated overdue/today actions | `apps/leads/views.py` | Cap |
| 9 | FE `page_size=1000` | `src/App.jsx`, `api.js` | Align ≤200 |
| 10–12 | Accounts/inventory hot path; eager Celery | services / reports | Cache / 503 if no broker |
| 13 | JWT refresh + blacklist under load | settings + `api.js` | Document / rate-limit |

### Medium / Low

AbortSignal passthrough, `authApi.me` on every page, pipeline annotations, survey photo prefetch, unwired thumbnail task, media JWT query strings, throttle tuning — see audit agent detail.

---

## Staging evidence (do not confuse with production)

- Phase 2: SQLite + Waitress + Memurai → sustainable ~40 (looser SLO)
- Phase 3: MySQL :3307 + Memurai + Waitress 4t → SLO @20; 0 fails through 200; collapse @500
- SQLite / Waitress / fakeredis ≠ Hostinger MySQL + Gunicorn + Redis capacity

---

## Out of scope until approval

Production deploy, restart, migrations, Redis enable on VPS, worker increases, Hostinger DB changes.
