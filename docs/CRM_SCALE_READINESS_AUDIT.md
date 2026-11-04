# Malwa Solar CRM — Performance Optimization & 300–500 Concurrent Users Readiness

**Production URL:** https://crm.ecomalwa.com/  
**Report date:** 4 Nov 2026  
**Scope:** Audit + implementation plan + local crash-load results  
**Safety:** No production code/config deploy, no prod DB writes, no prod stress traffic in this phase

---

## Status legend

| Label | Meaning |
|---|---|
| **Verified** | Live VPS/config/journal or production API evidence |
| **Local load-test** | Ran on `127.0.0.1` Waitress + SQLite only |
| **Theoretical** | Estimate / architecture recommendation |
| **Pending** | Needs staging environment or approval |

---

## Executive snapshot

| Metric | Value | Label |
|---|---|---|
| Current practical capacity | ~30–40 active users | Verified + theoretical |
| Current VPS max if carefully tuned | ~60–80 active users | Theoretical |
| Local multi-user cliff (`/users/me/`) | OK to 150; fails at 200 | Local load-test |
| Staging 300 / 500 concurrent | Not run | Pending |
| 40+ devices per account | JWT allows; shared user throttle blocks | Local load-test |
| Hard prod blocker | Hostinger MySQL `max_connections_per_hour = 500` | Verified (error 1226) |

**Final objective:** 300–500 concurrent active users and 40–100 devices per account — **not achievable on current 1 CPU + Hostinger MySQL hourly cap** without infra upgrade + staging validation.

---

## Phase 1 — Deep technical audit

### 1. Gunicorn worker/thread configuration — Verified

- Production service: sync WSGI (`malwa_solar.wsgi`), worker class `gthread`
- systemd: `WEB_CONCURRENCY=3`
- Effective in-flight capacity roughly **~6–9** concurrent requests (3 workers × threads)
- Local WIP (not deployed): defaults `5 × 3` in `gunicorn.conf.py`

**Bottleneck:** Too few parallel handlers for CRM bursts.  
**Fix (after approval):** Tune only after DB move / monitoring; do not blindly raise on 1 CPU with remote MySQL.

### 2. CPU and RAM utilization — Verified

- VPS: **1 CPU**, **~3.8 GB RAM**, **0 swap**
- Idle load typically low (~0.2–0.4); headroom for spikes is small

**Bottleneck:** Hardware ceiling for 300–500 users.  
**Fix:** Upgrade to **4 vCPU / 8–16 GB** before scale target.

### 3. Django sync / async handling — Verified

- Production now serves **sync WSGI** (correct for ORM + `CONN_MAX_AGE`)
- Earlier ASGI/Uvicorn path orphaned persistent DB connections and contributed to MySQL hourly connection burn
- Media ranged responses have ASGI-aware code paths; WSGI still works

**Recommendation:** Stay on sync WSGI for request/ORM traffic.

### 4–5. DB connection pooling / `CONN_MAX_AGE` — Verified

- `DB_CONN_MAX_AGE=300` on production `.env`
- Health checks enabled for MySQL/Postgres engines in settings
- **No real pooler** (no PgBouncer/ProxySQL); Django persistent connections only

**Bottleneck:** Hostinger shared MySQL **500 connections per hour** per DB user — verified:

```text
django.db.utils.OperationalError: (1226, "User 'u808821982_crm' has exceeded the
'max_connections_per_hour' resource (current value: 500)")
```

**Fix:** Dedicated MySQL/MariaDB on VPS or managed DB **without** hourly connection quota; keep connection reuse.

### 6. Redis — Verified

- Production: `REDIS_URL=disabled`
- Cache/throttle = **LocMem** (per process, not shared across workers)
- Dashboard cache TTL 45s is process-local when Redis is off
- Settings already support Redis + Celery broker when `REDIS_URL` is set

**Fix:** Add Redis for shared cache, rate-limit counters, Celery broker.

### 7–9. Slow queries / N+1 / indexes — Code review

- Many viewsets use `select_related` / `prefetch_related` (good baseline)
- **Dashboard fan-out** in `apps/dashboard/services.py` → `build_unified_dashboard`:
  - reports + lead analytics + project KPI + accounts + inventory + AMC
  - plus multiple separate `Project.objects.filter(...).count()` calls
- FE dashboard also fires multiple API calls (stats, follow-ups, recent leads, unified/reports)

**Fix:** Single aggregate query for project summary; longer shared cache via Redis; FE request coalesce.

**Indexes:** Soft-delete / status fields often `db_index=True`. Full missing-index list needs staging `EXPLAIN` on real data volumes — **Pending**.

### 10–11. Dashboard latency / repeated API calls — Code review

- Unified dashboard FE timeout raised to 120s in `api.js`; normal APIs abort at **20s** (“Request timed out. Please try again.”)
- Repeated polls / multi-endpoint dashboard loads amplify backend load

**Fix:** Coalesce FE fetches; cache; reduce poll frequency on background tabs.

### 12. Rate limits — Verified (prod baseline) + Local WIP

| Scope | Prod audit baseline | Local WIP (not deployed) |
|---|---|---|
| login | 10/min | 40/min |
| anon | 100/min | 200/min |
| user | 300/min | 750/min |

- Throttles are fail-open safe wrappers (`SafeAnonRateThrottle` / `SafeUserRateThrottle`)
- **User bucket is shared across all devices** of the same account

### 13. Session / JWT — Verified

- JWT access 8h, refresh 7d, rotate + blacklist
- **No soft device-count login ban** (good for multi-device requirement)
- Each login issues its own refresh token family

### 14. File uploads — Code review

- Media served via secured media views; large uploads compete with the same small worker pool
- No Celery offload for heavy post-processing

### 15. Background tasks — Verified

- No active `shared_task` / Celery usage found in backend
- Without Redis, Celery broker falls back to `memory://` (not production-safe for workers)

**Fix:** Redis + Celery for mail, exports, OM alerts, heavy reports.

---

## Phase 1 bottleneck table

| # | Area | Evidence | Impact | Recommended solution | Label |
|---|---|---|---|---|---|
| 1 | MySQL 500 conn/hour | Error 1226 in journal | Whole API/login dies for the hour | Move DB off Hostinger hourly cap | Verified |
| 2 | 1 CPU / 4GB | `nproc`, `free -h` | Cannot host 300–500 users | 4 vCPU / 8GB+ | Verified |
| 3 | Gunicorn ~3 workers | systemd unit | ~6 in-flight requests | Tune after DB/Redis; monitor RAM/CPU | Verified |
| 4 | Redis disabled | `.env` | No shared cache/throttle | Add Redis | Verified |
| 5 | Dashboard fan-out | `build_unified_dashboard` | Slow/expensive reads | Aggregate + cache + FE coalesce | Code review |
| 6 | Shared user rpm | Local 429 @ 80 same JWT | 40+ devices throttle each other | Raise rpm only after capacity; optional per-jti read limits | Local load-test |
| 7 | No Celery | No tasks found | Heavy work blocks workers | Redis + Celery | Verified |
| 8 | ASGI history | Prior outage pattern | Connection churn | Keep sync WSGI | Verified |

---

## Phase 2 — Current VPS optimization plan (approval required)

Goal: squeeze safe max from **current** 1 CPU / 4GB (~60–80 theoretical), without killing MySQL quota.

1. Keep **sync WSGI** + `CONN_MAX_AGE` (already on).
2. Do **not** blindly raise workers on 1 CPU while DB is Hostinger remote.
3. Add **Redis** on VPS (cache + throttle) — biggest soft win.
4. Optimize dashboard aggregates + FE coalesce.
5. Identify hot indexes via staging `EXPLAIN` (not prod write).
6. Evaluate Celery only after Redis exists.
7. Monitor CPU/RSS before any worker change.

**Rollback:** previous systemd unit + `.env` knobs; Redis behind `REDIS_URL` flag.

---

## Phase 3 — Device & rate-limit plan (approval required)

Requirements:

- Allow **40+ devices** per account (no login device ban) — already true for JWT
- Keep brute-force protection on login / IP
- Understand shared per-user throttle

**Impact math (theoretical):**

- At `user = 300/min`, 40 devices → ~7.5 req/min/device average before throttle
- Active CRM (lists + polls) easily exceeds that → 429 storms

**Plan:**

1. Verify backend capacity first (Phase 2 / staging).
2. Then consider raising user rpm (local WIP used 750/min as experiment only).
3. Keep login stricter (IP + login scope); do not open login to unlimited.
4. Optional later: per-device (`jti`) buckets for **read** APIs only.

---

## Phase 4 — Staging load testing plan (pending)

**Do not run on production.**

Need:

- Isolated staging API + **copy/anonymized DB**
- Locust/k6 scenarios:

| Test | Concurrent users |
|---|---:|
| 1 | 20 |
| 2 | 40 |
| 3 | 60 |
| 4 | 80 |
| 5 | 100 |
| 6 | 200 |
| 7 | 300 |
| 8 | 500 |

Simulate: login, dashboard, leads list/detail/search, follow-ups, site survey list/detail, reports.  
Separate read vs write; writes only on staging dummy data.

Measure: avg / p95 / p99, RPS, errors, timeouts, CPU, RAM, DB connections, slow queries, Redis.

**Status:** Staging env not created → **Pending**.

---

## Phase 5 — Future architecture (theoretical)

### Target: 300–500 concurrent users

- API: **4 vCPU / 8–16 GB**, Gunicorn ~(2×CPU)+1 workers, 2–4 threads
- DB: dedicated MySQL/MariaDB or managed (no 500/hour cap)
- Redis: cache + throttle + Celery broker
- Celery workers for background jobs
- Caddy/Nginx keepalives/timeouts tuned
- Monitoring + automated backups

**Est. monthly cost (INR ballpark):** ₹2,500–6,000 (confirm Hostinger/SKU pricing)

### Future: 500–1000

- Split API / DB / Redis hosts
- Read replica for reports/dashboard
- Horizontal API replicas + load balancer
- Object storage + CDN for media/FE
- APM + slow-query pipeline  
**Est. monthly:** ₹8,000–20,000+

---

## Phase 6 — Final answers

| # | Question | Answer | Label |
|---|---|---|---|
| 1 | Current verified capacity | ~30–40 active users practical; hard MySQL 500 conn/hour | Verified + theoretical |
| 2 | Staging after optimize | Not run — no staging | Pending |
| 3 | 300 concurrent | Not on current prod; local partial survived lighter auth to 150, failed 200 | Pending / local partial |
| 4 | 500 concurrent | Not on current prod; local health showed errors near 500 | Pending / local partial |
| 5 | 40+ devices / account | Allowed by JWT; shared user throttle + capacity block practical use | Local load-test |
| 6 | Bottlenecks | MySQL hourly cap, 1 CPU, no Redis, dashboard fan-out, shared user rpm | Verified |
| 7 | Required upgrade | DB without hourly cap + 4 vCPU/8GB + Redis (+ Celery) | Theoretical |
| 8 | Cost | ~₹2.5k–6k/mo for 300–500 path (estimate) | Theoretical |
| 9 | Recommended prod architecture | WSGI API + dedicated MySQL + Redis + Celery + Caddy + monitoring | Theoretical |

---

## Local crash-load results (not production)

Environment: Windows Waitress `--threads=15`, SQLite `local_loadtest.sqlite3`, `127.0.0.1:8040` only.

### A) Health GET (no DB)

Fail rule used: error ≥ 1% or p95 ≥ 800 ms → first trigger around **80** concurrency.

| Concurrency | p95 (ms) | Error % |
|---:|---:|---:|
| 10 | 22 | 0 |
| 20 | 30 | 0 |
| 40 | 56 | 0 |
| 60 | 715 | 0 |
| 80 | 994 | 0 |
| 100 | 3063 | 3.2 |
| 200 | 369 | 0 |
| 300 | 1139 | 0 |
| 500 | 1645 | 1.84 |

Artifact: `scripts/_local_crash_health_cliff.json`

### B) Multi-user authenticated `/api/v1/users/me/` (200 JWTs)

| Concurrency | p95 (ms) | Error % | Notes |
|---:|---:|---:|---|
| 20–100 | ≤1058 | 0 | OK |
| 150 | 2173 | 0 | Latency rising |
| **200** | **3865** | **7.17** | **Cliff (timeouts)** |

Artifact: `scripts/_local_crash_multiuser_results.json`

### C) Single-account device storm (same JWT)

- Broke at concurrency **80** with **HTTP 429** (shared per-user throttle)
- At 100–500: essentially 100% 429 / timeouts

Artifact: `scripts/_local_crash_auth_results.json`

**Caveat:** Local Waitress + SQLite ≠ Hostinger MySQL production. Local numbers bound process capacity only.

---

## Next approval gates

1. **Approve staging** (isolated API + anonymized DB) before Locust 20→500.
2. **Approve** whether local throttle/gunicorn WIP may be committed (still **not** deployed).
3. **Approve** infra upgrade (dedicated DB + Redis + larger VPS) before 300–500 target.

---

## Related files

- Canvas UI version: `.cursor` project canvases `crm-scale-readiness-audit.canvas.tsx`
- Local harness: `scripts/local_crash_load_test.py`, `scripts/local_multiuser_crash_load.py`
- Local results JSON under `scripts/_local_crash_*.json`
