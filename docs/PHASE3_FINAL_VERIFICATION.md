# Malwa Solar CRM — Phase 3 Final Evidence Verification

**Verified:** 2026-11-04 (artifact + live inspection; Locust **not** re-run)  
**Production:** untouched (no deploy, restart, DB changes, or prod load tests)  
**Staging API:** left running on `127.0.0.1:8060`

---

## Executive decision

| Question | Answer |
|----------|--------|
| Did Phase 3 set up isolated MySQL + real Redis + load evidence? | **Yes (partial stack)** |
| Did Phase 3 run **Gunicorn**? | **No — Waitress only** (Gunicorn blocked on Windows `fcntl`) |
| Does Phase 3 prove **500+ concurrent-user readiness**? | **No** |
| Max users meeting Phase 3 SLO (p95≤2s, p99≤5s, err≤1%) | **20** |
| Zero hard-failure band (latency may miss SLO) | **200** |
| Collapse | **500** (~74% failures, mostly connection refused) |

**Overall Phase 3 classification: Partially successful**  
(MySQL/Redis/Locust/evidence strong; Gunicorn + full Redis/worker kill drills incomplete.)

---

## Classification matrix

| Area | Status | Notes |
|------|--------|-------|
| Isolated MySQL `:3307` connectivity | **Verified successful** | `mysqld is alive`; app user `malwa_staging` |
| Schema / migrations | **Verified successful** | 161 migrations; 500 leads; 81 staging users |
| App uses MySQL not SQLite | **Verified successful** | `ENGINE=django.db.backends.mysql`, `NAME=malwa_crm_staging`, `PORT=3307` |
| Independent staging credentials/data | **Verified successful** | Dedicated datadir `.staging-mysql`; not Hostinger; not `:3306` |
| Indexes / EXPLAIN | **Verified successful** | `lead_del_status_created_idx` → `type=ref`, `Using index` |
| Real Redis (not fakeredis) | **Verified successful** | Memurai `C:/Program Files/Memurai/memurai.exe`, redis_version 8.2.5, db5 |
| Shared cache + throttle aliases | **Verified successful** | Both `django_redis.cache.RedisCache` → `redis://127.0.0.1:6379/5` |
| Redis live stop/start drill | **Failed / not completed** | `Stop-Service Memurai` access denied (`failure_drills.json`) |
| Redis soft-fail fallback | **Partially successful** | Prior dead-port / IGNORE_EXCEPTIONS path; live Memurai kill not done |
| Gunicorn as Phase 3 server | **Failed (blocked)** | `_gunicorn_win_err.log`: `No module named 'fcntl'`; actual server = Waitress |
| Waitress workers/threads | **Verified successful** | `--threads=4`; PIDs 9224/9896; monitor threads 6–8 |
| Gunicorn worker kill drill | **Not tested** | Explicitly deferred in `failure_drills.json` |
| MySQL interrupt → ready 503 → recover | **Verified successful** | `mysql_drill_strict.json` |
| SMTP circuit open/recover | **Verified successful** | Unit-style circuit in drills |
| CPU/RAM under Locust | **Verified successful** (recorded) | See resource summary |
| Locust 20–500 sustained 90s | **Verified successful** | CSV Aggregated rows **match** JSON summary |
| Locust 750/1000 | **Not tested** (skipped by policy after SLO fail) | |
| 500+ readiness | **Failed / not proven** | Collapse at 500; Gunicorn not in path |

---

## 1. MySQL verification

| Check | Evidence |
|-------|----------|
| Alive | `mysqladmin …:3307 ping` → `mysqld is alive` |
| DB / port / version | `malwa_crm_staging` · port **3307** · MySQL **8.0.45** |
| App credentials | User `malwa_staging` connects; isolated from Hostinger |
| Migrations | `django_migrations` count **161** |
| Seed data | **500** leads · **81** `staging.*` users |
| `max_connections` | **200** |
| Live `Threads_connected` (now) | **3** |
| During Locust (monitor) | connected min/avg/max **2 / 5.0 / 6** — not connection exhaustion |
| Slow_queries status | **0** in STATUS; slow log file size 4884 bytes (few long UPDATEs under load earlier) |
| EXPLAIN (list hot path) | `key=lead_del_status_created_idx`, Extra=`Using index` |
| Not SQLite | Django `vendor=mysql`; ENGINE `django.db.backends.mysql` |

Datadir: `c:\Malwa_Solar_CRM\.staging-mysql` (local-only).

---

## 2. Redis verification

| Check | Evidence |
|-------|----------|
| Implementation | **Memurai** (Redis-compatible binary), not fakeredis |
| Ping / version | `True` · `redis_version 8.2.5` |
| Django wiring | `CACHES['default']` + `['throttling']` → `django_redis` @ `/5` |
| Ready probe | Live `/api/v1/ready/` → `"redis": "ok"` |
| During Locust | used ~0.72–0.79 MB; clients 14–18 |
| Service stop drill | **Failed** — cannot open Memurai service (no elevation) |
| Soft-fail when Redis down | Documented/proven in earlier dead-port process test (ready `redis:error`, health 200 when `READY_REQUIRE_REDIS` unset) — **not** re-executed this verification pass |

---

## 3. Gunicorn verification — **not used**

| Check | Result |
|-------|--------|
| Phase 3 intended | Gunicorn WSGI |
| Actual Phase 3 API | **Waitress** `--listen=127.0.0.1:8060 --threads=4 --backlog=2048` |
| Process evidence | PIDs **9224**, **9896** (`api_pid.txt` = 9896) |
| Gunicorn Windows attempt | `_gunicorn_win_err.log`: `ModuleNotFoundError: No module named 'fcntl'` |
| Worker count | N/A (single Waitress process, 4 threads) |
| Graceful multi-worker shutdown | **Not tested** |
| Readiness under MySQL outage | **Verified** via Waitress (503 `not_ready`) |

`phase3_ramp_summary.json` itself records:  
`"stack": "… Waitress (Gunicorn blocked on Windows fcntl)"`.

Linux entrypoint exists but was **not** executed: `scripts/start_phase3_gunicorn.sh`.

---

## 4. Failure drills

| Drill | Artifact | Outcome |
|-------|----------|---------|
| Baseline health/ready | `failure_drills.json` | Pass |
| Redis Stop-Service | `failure_drills.json` | **Fail** (permissions) |
| MySQL kill `:3307` (strict) | `mysql_drill_strict.json` | **Pass** — during: HTTP **503** `database:error`; after ~**1s**: ready again |
| First MySQL drill attempt | `failure_drills.json` `mysql_interrupt_recovery` | Inconclusive in that run (ready stayed ok — likely wrong/racy PID); superseded by strict drill |
| SMTP circuit | `failure_drills.json` | Pass open + recover |
| Gunicorn worker kill | `failure_drills.json` | **Not tested** |
| Data integrity | Indirect | Ready recovered; Locust remark UPDATEs appear in slow log; no corruption evidence |
| Waitress queue under load | `_phase3_api_err.log` | `Task queue depth` spam; also `Service Unavailable: /api/v1/ready/` during MySQL drill |

---

## 5. Locust results (verified against CSVs)

**Host:** `http://127.0.0.1:8060`  
**Duration:** **90 s** per level (sustained, not burst)  
**SLO:** p95 ≤ 2000 ms · p99 ≤ 5000 ms · error ≤ 1%  
**CSV ↔ JSON:** all levels **match** (0 mismatches)

| Users | Requests | Failures | Fail% | Avg ms | P50 | P95 | P99 | RPS | 429 | 5xx | Conn refused | Timeouts | SLO |
|------:|---------:|---------:|------:|-------:|----:|----:|----:|----:|----:|----:|-------------:|---------:|:---:|
| 20 | 1710 | 0 | 0 | 409 | 360 | 940 | 1400 | 19.2 | 0 | 0 | 0 | 0 | **PASS** |
| 40 | 1644 | 0 | 0 | 1487 | 1500 | 2300 | 2700 | 18.5 | 0 | 0 | 0 | 0 | FAIL p95 |
| 60 | 1725 | 0 | 0 | 2336 | 2300 | 3500 | 4000 | 19.6 | 0 | 0 | 0 | 0 | FAIL |
| 100 | 2370 | 0 | 0 | 2898 | 2900 | 3800 | 4400 | 26.7 | 0 | 0 | 0 | 0 | FAIL |
| 200 | 2383 | 0 | 0 | 2921 | 2900 | 3800 | 4300 | 26.9 | 0 | 0 | 0 | 0 | FAIL |
| 300 | 2036 | 59 | 2.9 | 3534 | 3500 | 4900 | 5200 | 23.4 | 0 | 0 | 39 | 0 | FAIL |
| 500 | 7275 | 5370 | 73.8 | 2356 | 2000 | 3900 | 4400 | 93.7* | 0 | 0 | 3685 | 0 | COLLAPSE |
| 750 | — | — | — | — | — | — | — | — | — | — | — | — | **Not tested** |
| 1000 | — | — | — | — | — | — | — | — | — | — | — | — | **Not tested** |

\*RPS at 500 inflated by fast-fail connection errors.

Failure modes @300/500: `ConnectionRefusedError (10061)` + `CatchResponseError('0')` — **not** HTTP 429/5xx bodies.

### Resource monitor (Locust window)

Source: `resource_summary.json` (924 samples @ ~2s)

| Metric | Min | Avg | Max |
|--------|----:|----:|----:|
| Host CPU % | 0 | 46.3 | **100** |
| Host RAM % | 56.7 | 76.3 | **99.8** |
| API RSS MB | 102 | 199 | 211 |
| API threads | 6 | 6.4 | 8 |
| Redis used MB | 0.72 | 0.76 | 0.79 |
| Redis clients | 14 | 17 | 18 |
| MySQL Threads_connected | 2 | 5.0 | **6** |
| MySQL Threads_running | 2 | 2.1 | 6 |

---

## 6. Live state at verification time

| Probe | Result |
|-------|--------|
| `GET /api/v1/health/` | 200 `{"status":"ok"}` |
| `GET /api/v1/ready/` | 200 `database=ok`, `redis=ok` |
| Waitress `:8060` | Still running (not restarted for this report) |
| MySQL `:3307` | Alive |
| Memurai Redis | Ping OK |

---

## Does Phase 3 prove 500+ concurrent-user readiness?

### **No.**

Reasons:

1. At **500** users: **73.8%** request failures (connection collapse).
2. Phase 3 SLO only held at **20** users.
3. Server under test was **Waitress**, not production-like **Gunicorn**.
4. **750/1000** never run.
5. Host **RAM peaked at 99.8%** — machine-bound, not a 500+ proof.
6. MySQL connections stayed low (≤6) — bottleneck was app concurrency / host resources, not “need more DB connections alone.”

---

## Remaining gaps before any 500+ claim

1. Linux staging with **Gunicorn** (`scripts/start_phase3_gunicorn.sh`) + same MySQL/Redis.
2. Elevated **Memurai stop/start** recovery drill.
3. Multi-worker kill/recovery under load.
4. Sustained Locust after backend query optimizations (post-Phase-3 code changes not re-load-tested here).
5. Production Hostinger Redis enable + connection quota plan (separate approval).

---

## Artifact index

| Path | Role |
|------|------|
| `scripts/phase3_results/phase3_ramp_summary.json` | Locust summary |
| `scripts/phase3_results/p3_*_stats.csv` | Per-level Locust stats |
| `scripts/phase3_results/p3_*_failures.csv` | Failure taxonomy |
| `scripts/phase3_results/failure_drills.json` | Drill pack |
| `scripts/phase3_results/mysql_drill_strict.json` | Authoritative MySQL recovery |
| `scripts/phase3_results/resource_summary.json` | CPU/RAM/Redis/MySQL |
| `scripts/phase3_results/resource_timeseries.jsonl` | Raw monitor samples |
| `scripts/_phase3_api_err.log` | Waitress queue / ready 503 |
| `scripts/_gunicorn_win_err.log` | Gunicorn fcntl failure |
| `docs/PHASE3_SCALE_VALIDATION_REPORT.md` | Narrative Phase 3 report |

---

## Safety note

Verification was **read-only** against local staging. Staging API on `:8060` was **not** restarted. Production was not contacted.

**Stop for approval** before any production or further disruptive staging changes.
