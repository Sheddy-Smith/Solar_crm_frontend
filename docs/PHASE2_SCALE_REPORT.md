# Malwa Solar CRM — Phase 2 Scale Report

**Date:** 2026-11-04  
**Scope:** Local / isolated staging only. **No production deploy, restart, DB writes, migrations, or load tests.**

---

## 1. Files changed (Phase 2)

| Area | Path |
|------|------|
| Progressive dashboard | `src/App.jsx`, `src/api.js` |
| Celery tasks | `backend/apps/reports/tasks.py`, `backend/apps/reports/views.py` |
| Circuit breaker / HTTP | `backend/malwa_solar/circuit_breaker.py`, `http_client.py`, `mail.py`, `keepalive.py` |
| Celery settings | `backend/malwa_solar/settings/base.py`, `celery.py` |
| Indexes | `backend/apps/leads/migrations/0022_*.py`, `backend/apps/projects/migrations/0035_*.py` |
| Staging | `backend/malwa_solar/settings/staging_local.py`, `staging_mysql.py`, `scripts/setup_staging_mysql.ps1`, `docker-compose.staging.yml` |
| Locust / probes | `scripts/locustfile_staging.py`, `run_phase2_locust_ramp.py`, `run_phase2_failure_tests.py` |
| Tests | `backend/malwa_solar/tests_circuit_and_export.py`, `tests_scale_foundations.py` |
| Docs | `docs/ENV_SCALING.md`, this report |

---

## 2. Pending work completed

- Phase 1 foundations reviewed (ready/health, Redis throttle fail-open, Gunicorn env, pagination, DB timeouts).
- Real Celery tasks: CSV/XLSX export, bulk notify, image thumbnail, large CSV import (idempotent + timeouts + retries).
- Progressive dashboard: independent widgets, AbortController, per-widget errors, follow-ups `page_size=100`.
- Circuit breaker for SMTP + outbound HTTP; keepalive uses HTTP client.
- Index migrations applied on **local** MySQL `malwa_solar_local` only; EXPLAIN improved.
- Locust ramp 20→500 (750/1000 skipped after collapse); Memurai Redis + Waitress + SQLite staging.
- Unit tests: **7 OK** (scale foundations + circuit).

---

## 3. Database EXPLAIN results (local MySQL only)

Query: `SELECT id FROM leads_lead WHERE is_deleted=0 AND status='New' ORDER BY created_at DESC LIMIT 100`

| | type | key | Extra |
|--|------|-----|-------|
| **Before** `0022` | ALL | (none useful) | Using where; Using filesort |
| **After** `0022` | ref | `lead_del_status_created_idx` | Using index |

Follow-ups after index: `followup_del_status_sched_idx` / Using index.

**Not applied to production Hostinger.** Isolated `malwa_crm_staging` DB creation blocked (no MySQL root password: set `STAGING_MYSQL_ROOT_PASSWORD` and run `scripts/setup_staging_mysql.ps1`).

---

## 4. Celery task results

| Task | Result |
|------|--------|
| `reports.export_leads_csv` | Smoke OK (eager) → task id returned |
| `reports.bulk_notify_stub` | Smoke OK (eager) |
| Broker | Memurai `redis://127.0.0.1:6379/1`; eager when Redis disabled |
| Safety | `acks_late`, soft/hard time limits, idempotent file/cache keys |

---

## 5. Frontend optimization results

- Critical lead stats load in their own effect with abort.
- Follow-ups / projects / recent leads load independently; one failure does not blank the dashboard.
- Widget error banner when any secondary API fails.
- No infinite retry loop (visibility refresh only; no backoff storm).

---

## 6. Circuit breaker results

- Unit tests: opens after threshold, half-open recovery — **pass**.
- Dead Redis URL: `/health/` → 200; `/ready/` → 200 with `redis: error` (unless `READY_REQUIRE_REDIS=1`).
- Memurai service stop from this session lacked elevation (service stayed Running) — behavior validated via dead-port settings instead.

---

## 7. Staging configuration (realistic vs actual)

| Component | Target | What ran |
|-----------|--------|----------|
| DB | Dedicated MySQL `malwa_crm_staging` | **SQLite** `staging_local.sqlite3` (MySQL root password missing for new DB) |
| Redis | Real Redis | **Memurai** on `127.0.0.1:6379` ✅ |
| App server | Gunicorn | **Waitress** 16 threads (Gunicorn poor on Windows) |
| Data | Anonymized seed | 81 staging users / 500 leads ✅ |
| Settings | `staging_local` / `staging_mysql` | `staging_local` + Memurai |

`staging_mysql.py` refuses non-localhost / Hostinger hosts.

---

## 8. Locust results (Phase 2 ramp)

Host: `http://127.0.0.1:8050` · 35s/level · SLO break: error≥5% **or** p95≥3000ms

| Users | Requests | Fail% | Avg ms | P50 | P95 | P99 | RPS | Broken |
|------:|---------:|------:|-------:|----:|----:|----:|----:|:------:|
| 20 | 896 | 0 | 117 | 65 | 390 | 730 | 26.1 | no |
| 40 | 893 | 0 | 801 | 560 | 2700 | 4000 | 25.9 | no |
| 60 | 820 | 0 | 1661 | 1500 | 3600 | 5100 | 23.9 | **yes** |
| 100 | 796 | 0 | 3230 | 3200 | 5600 | 6700 | 23.1 | yes |
| 200 | 780 | 0 | 3324 | 3300 | 5400 | 6400 | 22.8 | yes |
| 300 | 754 | 11.0 | 3683 | 3500 | 6400 | 8000 | 22.7 | yes |
| 500 | 3156 | 85.0 | 2632 | 2000 | 5700 | 14000 | 92.1 | yes |
| 750 | — | — | — | — | — | — | — | skipped |
| 1000 | — | — | — | — | — | — | — | skipped |

Raw: `scripts/staging_locust_results/phase2_ramp_summary.json`

---

## 9. Maximum sustainable concurrent users (tested)

| Claim type | Value |
|------------|-------|
| **Tested sustainable (this stack)** | **~40 concurrent Locust users** (0% errors, p95 &lt; 3s) |
| First latency break | **60** (p95 3600ms) |
| Error cliff | **~300** (≥5% failures) |
| Collapse | **500** (~85% failures) |
| **500+ production capacity** | **NOT claimed** — needs MySQL+Gunicorn+Redis staging meeting SLO |

Theoretical capacity on larger infra is unknown until retested.

---

## 10. Remaining infrastructure limitations

1. Production VPS ~1 vCPU / shared Hostinger MySQL hourly connection cap.
2. Production Redis still disabled — shared throttle incorrect across workers.
3. No isolated local MySQL staging DB without root password.
4. Windows Waitress ≠ Linux Gunicorn worker model.
5. SQLite write lock under concurrency — not production-like.
6. Celery worker process not co-tested under Locust (eager mode in this run).

---

## 11. Rollback instructions (code / config only — no prod action taken)

1. Revert Phase 2 commits / restore prior `App.jsx` dashboard effects if FE regresses.
2. Leave production `REDIS_URL=disabled` until approved.
3. Do not apply `0022`/`0035` on Hostinger until approved migrate window.
4. Export/import endpoints are additive — disable routes via permission or reverse proxy if needed.
5. Local staging API: stop Waitress PID; Memurai may remain running for other apps.

---

## Approval gate

**Stop here.** No production changes until explicit written approval.
