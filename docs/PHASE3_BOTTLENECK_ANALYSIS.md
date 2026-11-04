# Phase 3 — Bottleneck root-cause analysis (from Phase 2 evidence + code)

## Observed symptoms (Phase 2 Waitress + SQLite + Memurai)

| Symptom | Evidence |
|---------|----------|
| Waitress queue depth → 86 | `_staging_api_phase2_err.log` (4992 samples; max 86) |
| ConnectionRefusedError @300/500 | `phase2_300/500_failures.csv` |
| 11% fail @300; 85% @500 | `phase2_ramp_summary.json` |
| Dashboard / reports latency | Endpoint p95: `reports_dashboard`, `dashboard_unified` highest pre-collapse |

## Causal chain (not “need more threads”)

```
Concurrent Locust users
  → more in-flight HTTP than Waitress threads (16)
    → Waitress task queue grows (depth 86)
      → request wait time ↑ (p95 breaks at 60 users)
        → sockets held / backlog pressure
          → OS refuses new accepts (WinError 10061) at 300–500
```

Raising threads alone shifts the cliff right until **DB lock / CPU / GIL / Redis** becomes the next bottleneck. On SQLite, write serialization amplifies queueing under mixed read/write Locust tasks (`lead_patch_remark`).

## Dashboard latency

`build_unified_dashboard()` sequentially calls:

- `reports_dashboard` (multi-aggregate across leads/payments/inventory/projects/OM/AMC)
- `lead_analytics`
- `project_kpi_analytics`
- `accounts_dashboard_summary`
- `inventory_summary`
- `amc_dashboard_summary`
- `_om_alerts` → another dashboard_summary
- Project status aggregate

Cache TTL (`DASHBOARD_CACHE_TTL`, default 45s) helps **repeat** identical params but Locust still cold-misses and stampede-risks under many unique sessions. This is **query fan-out**, not missing an index alone.

## Connection pressure

- Phase 2 SQLite: `CONN_MAX_AGE=0` → connect-per-request overhead + lock contention.
- Production Hostinger: `max_connections_per_hour` historically capped ~500 — more Gunicorn workers without Redis/pooling burns quota.
- Phase 3 staging MySQL: `CONN_MAX_AGE=60`, `max_connections=200` on isolated instance — measure `Threads_connected` under Locust.

## ConnectionRefused ≠ Django 5xx

Failure CSVs show **no 429 / classic 5xx strings**. Collapse is **accept-path** failure after queue saturation, so HTTP error budgets understate app-level distress until connections succeed again.

## Implications for Phase 3

1. Validate on **MySQL + Redis** so SQLite lock is removed as confounder.
2. Cap concurrency to match worker capacity (≈ threads, or workers×threads on Gunicorn Linux).
3. Keep heavy dashboard/export off the hot path (cache + Celery) — do not “fix” solely by `WEB_CONCURRENCY++`.
4. Monitor queue depth / Threads_connected / Redis ops alongside Locust p95.
