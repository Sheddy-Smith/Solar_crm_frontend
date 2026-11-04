# Malwa Solar CRM — Phase 2 Final Verification Report

**Verified:** 2026-11-04 (inspection only; load tests not re-run)  
**Scope:** Local staging artifacts + live checks on `127.0.0.1:8050`  
**Production:** untouched (no deploy, restart, migrations, env changes, or prod load)

---

## Evidence inventory (on disk)

| Artifact | Path | Timestamp (local) | Verdict |
|----------|------|-------------------|---------|
| JWT mint | `scripts/staging_locust_results/minted_tokens.json` | 13:43:29 | **81** tokens; sample `staging.admin@local.test` has `access` |
| Failure probes | `…/phase2_failure_tests.json` | 13:43:31 | Executed; health/ready/burst/export auth OK |
| Locust summary | `…/phase2_ramp_summary.json` | 13:47:58 | Present; matches CSV Aggregated rows |
| Locust CSVs | `phase2_{20,40,60,100,200,300,500}_*.csv` | 13:43:34–13:47:58 | Present for 7 levels |
| Waitress stderr | `scripts/_staging_api_phase2_err.log` | continuous | Serving + queue-depth spam (~211 KB) |
| Narrative report | `docs/PHASE2_SCALE_REPORT.md` | earlier | Implementation + claim rules |

**Not present as recorded metrics:** dedicated CPU%/RAM time-series, Gunicorn worker restart counters, Redis ops/sec, MySQL connection graphs.

---

## 1–2. Health / readiness (then + now)

### During Phase 2 probe run (`phase2_failure_tests.json`)

| Check | Result |
|-------|--------|
| `GET /api/v1/health/` | 200 `{"status":"ok"}` |
| `GET /api/v1/ready/` | 200 `database=ok`, `redis=ok` |
| Burst 100× health | 100/100 success in 1.351s |
| `POST /reports/export-leads/` unauth | 401 (auth gate OK) |

### Live verification (this inspection)

| Check | Result |
|-------|--------|
| Health | 200 `{"status":"ok"}` |
| Ready | 200 `database=ok`, `redis=ok` |
| Memurai Redis ping | `True` |
| Port 8050 listener | Python PID **17516** (started 13:43:10); related PID 23632 |
| Current RSS (PID 17516) | ~321 MB WorkingSet; cumulative CPU ~471s (post-load residual, not a ramp timeseries) |

**API remained available after the Locust campaign** (still serving now). During the **500-user** window it did **not** stay fully available — see failures below (`ConnectionRefusedError`).

---

## 3. JWT minting

- File: `minted_tokens.json` (23 236 bytes)
- Count: **81** (`staging.*` users)
- Used by Locust to avoid login storms (`STAGING_TOKENS_FILE`)

---

## 4. Failure / recovery outcomes

### Automated probes (executed)

| Case | Outcome |
|------|---------|
| Health liveness | Pass |
| Ready with Redis | Pass |
| High-volume health burst | Pass |
| Export endpoint auth gate | Pass (401) |

### Recovery behaviors with evidence

| Scenario | Status | Evidence |
|----------|--------|----------|
| Redis unavailable (dead port `6399` in isolated Django process) | **Pass (soft degrade)** | `/health/` 200; `/ready/` 200 with `checks.redis=error` when `READY_REQUIRE_REDIS` unset |
| Redis service stop (Memurai) | **Incomplete** | `Stop-Service Memurai` did not stop service (remained Running / no elevation) |
| MySQL unavailable | **Not executed** | Staging Locust used SQLite; no MySQL kill test |
| Worker crash under load | **Partial / observed** | At 300–500 users: mass `ConnectionRefusedError` — accept queue / process saturation; process later still up |
| External API / SMTP timeout | **Unit-level only** | Circuit breaker tests open→half_open→closed; live SMTP blackhole not run |
| Celery export smoke | **Pass (eager)** | Task ids returned during Phase 2 session (not re-run here) |

`phase2_failure_tests.json` still lists Redis/MySQL/worker/SMTP as **manual_scenarios** — those were not fully operator-executed against the live Waitress process.

---

## 5–7. Locust ramp — concurrency & latency

**Stack under test:** Waitress `--threads=16` + SQLite `staging_local.sqlite3` + Memurai Redis `127.0.0.1:6379/1`  
**Duration:** 35s per level · host `http://127.0.0.1:8050`  
**SLO used in summary:** broken if fail% ≥ 5 **or** p95 ≥ 3000 ms

| Users | Requests | Failures | Fail% | Avg ms | P50 | P95 | P99 | RPS | Exit | Broken |
|------:|---------:|---------:|------:|-------:|----:|----:|----:|----:|-----:|:------:|
| 20 | 896 | 0 | 0 | 117 | 65 | 390 | 730 | 26.1 | 0 | no |
| 40 | 893 | 0 | 0 | 801 | 560 | 2700 | 4000 | 25.9 | 0 | no |
| 60 | 820 | 0 | 0 | 1661 | 1500 | **3600** | 5100 | 23.9 | 0 | **yes** |
| 100 | 796 | 0 | 0 | 3230 | 3200 | 5600 | 6700 | 23.1 | 0 | yes |
| 200 | 780 | 0 | 0 | 3324 | 3300 | 5400 | 6400 | 22.8 | 0 | yes |
| 300 | 754 | 83 | **11.0** | 3683 | 3500 | 6400 | 8000 | 22.7 | 1 | yes |
| 500 | 3156 | 2682 | **85.0** | 2632 | 2000 | 5700 | 14000 | 92.1* | 1 | yes |
| 750 | — | — | — | — | — | — | — | — | — | **skipped** |
| 1000 | — | — | — | — | — | — | — | — | — | **skipped** |

\*High RPS at 500 is dominated by fast-fail connection errors, not successful work.

CSV Aggregated rows were re-parsed and **match** `phase2_ramp_summary.json`.

### 429 / 5xx / timeouts

From `phase2_*_failures.csv`:

| Class | Observed? |
|-------|-----------|
| **429** | **None** recorded |
| Classic **5xx** body/status strings | **None** recorded |
| Client **timeouts** (ReadTimeout etc.) | **None** as named class |
| **Connection refused** (WinError 10061) | Dominant at 300 (56) and 500 (1853) |
| `CatchResponseError('0')` | 27 @300; 829 @500 (status 0 / failed response handling on list endpoints) |

So the cliff is **accept/connect collapse**, not rate-limit 429s or clean Django 500 pages.

### Slowest endpoints (pre-collapse, 0 failures)

At 40–200 users, heaviest p95: `reports_dashboard`, `projects_list`, `site_surveys_list`, `dashboard_unified`.

---

## 8. CPU / RAM / worker behavior

| Signal | Recorded? | What we have |
|--------|-----------|--------------|
| Host CPU% during ramp | No | — |
| Host RAM during ramp | No | Post-hoc WorkingSet ~321 MB for API PID |
| Waitress queue depth | **Yes** (`_staging_api_phase2_err.log`) | **max depth 86**; 4992 log samples; still ~83 near end of log |
| Worker restarts | No explicit counter | Single Waitress process model (not multi-Gunicorn workers) |

Interpretation: thread pool saturated → deep task queue → latency climb → at 300+ connection refusals under spawn pressure.

---

## 9. Redis / DB recovery (summary)

- **Redis soft-fail path:** verified with dead broker URL in process; ready reports `redis: error` without taking health down.
- **Live Memurai kill:** not successfully performed.
- **MySQL kill:** N/A for this Locust stack (SQLite); dedicated staging MySQL DB never created (root password missing).

---

## 10. API availability throughout tests

| Window | Available? |
|--------|------------|
| Mint + failure probes (13:43) | Yes |
| Locust 20–200 | Yes (0 connection failures in CSVs) |
| Locust 300 | Partially — 83 failures, mostly connection refused |
| Locust 500 | **No** (majority connection refused) |
| After ramp / now | **Yes** — health/ready 200 |

---

## Confirmed bottlenecks

1. **Waitress 16-thread + SQLite** concurrency ceiling (queue depth → latency → refuse).
2. Heavy aggregate endpoints (`reports_dashboard`, `dashboard_unified`, list scans) drive p95 early.
3. **Not production-like DB** — SQLite write/lock behavior skews results vs MySQL.
4. **No multi-worker Gunicorn** on this Windows host.
5. Production path still constrained by Hostinger MySQL hourly connection limits (infra, not retested here).

---

## Does staging demonstrate 500+ concurrent-user readiness?

### **No.**

Evidence against:

- At **500** Locust users: **85%** failures, mostly connection refused.
- First SLO break at **60** (p95).
- Sustainable band on this stack: **~40** concurrent users (0% errors, p95 &lt; 3s).
- Stack ≠ target (MySQL + Gunicorn + sized Redis + Linux).
- 750/1000 **never run** (skipped after collapse).

Do **not** claim 500+ capacity from these artifacts.

---

## Remaining incomplete tests

1. Isolated **MySQL** staging DB + Locust on MySQL.
2. **Gunicorn** multi-worker ramp (Linux/staging VM).
3. Live **Memurai stop/start** recovery against Waitress.
4. Live **DB stop/start** recovery.
5. Intentional **worker kill** under moderate load.
6. Live **SMTP/external** circuit under load.
7. Non-eager **Celery worker** under export/import load.
8. Host **CPU/RAM/DB conn/Redis** telemetry during ramp.
9. Sustained soak (minutes+) at 40 users.
10. Same-account multi-device throttle validation with shared Redis under controlled 429 expectations.

---

## Recommended next steps (await approval)

1. Provide `STAGING_MYSQL_ROOT_PASSWORD` → create `malwa_crm_staging` → migrate/seed → re-Locust on MySQL+Memurai.
2. Prefer Linux staging VM with Gunicorn (`WEB_CONCURRENCY`/`GUNICORN_THREADS` from `docs/ENV_SCALING.md`).
3. Re-run ramp 20→1000 only after MySQL+Gunicorn baseline; instrument CPU/RAM/DB/Redis.
4. Complete Redis/DB/worker kill recovery checklist with elevated service control.
5. **Production:** no changes until separate explicit approval; indexes `0022`/`0035` not for Hostinger until approved.

---

## Rollback / safety note

Verification was **read-only** against local staging. Staging API was **not restarted** for this report. Production was not contacted.
