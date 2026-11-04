# Malwa Solar CRM — Phase 3 Production-Like Staging Validation

**Date:** 2026-11-04  
**Scope:** Isolated local staging only. **No production deploy, restart, DB changes, load tests, VPS upgrade, or config changes.**

---

## 1. Actual infrastructure configuration

| Layer | Configuration |
|-------|----------------|
| App | Django WSGI via **Waitress** `127.0.0.1:8060`, `--threads=4`, `--backlog=2048` |
| Why not Gunicorn | Native Windows: `ModuleNotFoundError: fcntl`. Linux script: `scripts/start_phase3_gunicorn.sh` |
| MySQL | Isolated **mysqld 8.0.45** datadir `c:\Malwa_Solar_CRM\.staging-mysql`, **port 3307** |
| Database | `malwa_crm_staging` / user `malwa_staging` (local-only password) |
| Redis | **Memurai** `127.0.0.1:6379` DB **5** |
| Settings | `malwa_solar.settings.staging_mysql` |
| Seed | 81 staging users / 500 anonymized leads |
| Hostinger / prod MySQL80 :3306 | **Not used for staging writes** |
| Prior SQLite API :8050 | Left running; Phase 3 used **8060** |

Proposed SLOs (applied):

| Metric | Target |
|--------|--------|
| P95 normal API | ≤ **2000 ms** |
| P99 normal API | ≤ **5000 ms** |
| Failure rate (incl. connect fails) | ≤ **1%** |
| Server 5xx | ≤ 1% (none observed as HTTP 5xx strings) |
| Worker crashes | none uncontrolled |
| Data integrity | no corruption / lost successful writes |

Heavy report/export endpoints are treated as a separate class (Celery/async).

---

## 2. Bottleneck root causes (not “just add threads”)

See also `docs/PHASE3_BOTTLENECK_ANALYSIS.md`.

| Phase 2 symptom | Root cause validated in Phase 3 |
|-----------------|----------------------------------|
| Waitress queue depth 86 | In-flight load ≫ thread pool → queueing → latency |
| ConnectionRefused @300/500 | Accept-path collapse after saturation (still occurs with MySQL) |
| Dashboard latency | Unified dashboard multi-service fan-out + cold cache |
| DB connection pressure | **Not primary** here: MySQL `Threads_connected` max **6** under Locust |
| SQLite confounder | Removed: MySQL held **0 failures through 200 users** (Phase 2 SQLite failed earlier) |

**Host RAM** peaked at **99.8%** during the ramp (monitor) — memory pressure is a first-class limiter on this machine, independent of worker count.

Slow log (staging MySQL): a few `UPDATE leads_lead` (Locust remark patches) at **1.0–2.5 s** query time under saturation — row updates waiting behind worker/CPU contention, not missing indexes on PK updates.

---

## 3. Failure / recovery drills

| Drill | Result | Evidence |
|-------|--------|----------|
| Baseline health/ready | Pass | `failure_drills.json` |
| Redis Memurai Stop-Service | **Blocked** (access denied / no elevation) | `failure_drills.json` |
| Redis soft-fail (prior dead-port) | Pass: ready `redis:error`, health 200 | Phase 2 verification |
| **Staging MySQL kill :3307** | **Pass:** ready **503** `database:error`; recovered to ready in **~1 s** after restart | `mysql_drill_strict.json` |
| SMTP circuit open/recover | Pass | `failure_drills.json` / unit path |
| Gunicorn worker kill | **Not run** (Gunicorn unavailable on Windows) | deferred to Linux |
| Data integrity after MySQL restart | Ready recovered; API still serving; Locust writes persisted (slow log shows UPDATEs) | live checks |

---

## 4. Locust results (sustained 90 s / level)

Host: `http://127.0.0.1:8060` · tokens: 81 · workflows: auth-minted, health, me, leads, projects, follow-ups, surveys, dashboard, reports, lead PATCH.

| Users | Req | Fail% | Avg | P50 | P95 | P99 | RPS | SLO |
|------:|-----:|------:|----:|----:|----:|----:|----:|:---:|
| 20 | 1710 | 0 | 409 | 360 | **940** | 1400 | 19.2 | **PASS** |
| 40 | 1644 | 0 | 1487 | 1500 | **2300** | 2700 | 18.5 | FAIL p95 |
| 60 | 1725 | 0 | 2336 | 2300 | 3500 | 4000 | 19.6 | FAIL |
| 100 | 2370 | 0 | 2898 | 2900 | 3800 | 4400 | 26.7 | FAIL |
| 200 | 2383 | 0 | 2921 | 2900 | 3800 | 4300 | 26.9 | FAIL |
| 300 | 2036 | **2.9** | 3534 | 3500 | 4900 | 5200 | 23.4 | FAIL |
| 500 | 7275 | **73.8** | 2356 | 2000 | 3900 | 4400 | 93.7* | FAIL / collapse |
| 750 | — | — | — | — | — | — | — | skipped (SLO) |
| 1000 | — | — | — | — | — | — | — | skipped (SLO) |

\*High RPS at 500 dominated by fast connection failures.

**429:** 0 · **HTTP 5xx strings:** 0 · Failures: `ConnectionRefusedError` + `CatchResponseError('0')`.

Raw: `scripts/phase3_results/phase3_ramp_summary.json`

### vs Phase 2 (SQLite)

| | Phase 2 SQLite | Phase 3 MySQL |
|--|----------------|---------------|
| 0-failure band | through ~200 short runs, cliff ~300 | **through 200 sustained 90s** |
| Collapse @500 | ~85% | ~74% |
| SLO p95≤2s | ~20–40 (looser prior SLO) | **only 20** under 2s/5s/1% SLO |

MySQL removed SQLite lock as a confounder; **thread-pool / host resource limits remain**.

---

## 5. CPU / RAM / MySQL / Redis (monitor)

File: `scripts/phase3_results/resource_timeseries.jsonl` (924 samples @ 2s) → `resource_summary.json`

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
| MySQL Slow_queries counter | 0 | 0 | 0* |

\*Server status counter stayed 0 in samples; slow log file still captured a few long UPDATEs (see §2).

---

## 6. Maximum sustainable concurrent users (this stack)

| Definition | Value |
|------------|------:|
| Meets Phase 3 SLO (p95≤2s, p99≤5s, err≤1%) | **20** |
| Zero hard failures (latency may miss SLO) | **200** |
| Error cliff | **~300** |
| Collapse | **500** |
| **500+ readiness** | **No** |

Do **not** claim production 500+ capacity from this run.

---

## 7. Remaining blockers

1. **Gunicorn not runnable on this Windows host** — need Linux staging VM for true prod-like workers.
2. **1 vCPU-class / RAM exhaustion** on the test machine (RAM → 99.8%).
3. **Waitress 4 threads** intentionally mirrors small VPS; cannot prove multi-worker Gunicorn behavior.
4. **Memurai stop** requires elevated permissions.
5. Production Hostinger **MySQL hourly connection quota** + **Redis disabled** unchanged (out of scope).
6. Unified dashboard fan-out still expensive under cold cache.
7. No multi-instance / LB staging.

---

## 8. Recommended next steps (await approval)

1. Stand up **Linux** staging (or WSL once healthy) and run `scripts/start_phase3_gunicorn.sh` with MySQL:3307 + Redis.
2. Re-Locust 20→500 with `WEB_CONCURRENCY=2` `GUNICORN_THREADS=2`, then carefully raise only with headroom.
3. Elevate Memurai stop/start drill; keep MySQL interrupt on **3307 only**.
4. Optimize dashboard: stronger cache stampede protection / split widgets (FE already progressive).
5. Keep Celery exports off request threads with a real worker process under load.
6. **Production:** separate explicit approval only — no deploy from this phase.

---

## 9. Rollback / safety

- Staging MySQL datadir is local (`.staging-mysql`); stop with taskkill on that mysqld only.
- Phase 3 API: stop Waitress PID on **8060**.
- Production Hostinger MySQL80 and VPS: **untouched**.
