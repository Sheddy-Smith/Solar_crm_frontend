# Environment-based scaling (no business-logic rewrite)

Production deploy of these values requires **explicit approval**. Defaults are conservative.

## Core

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | MySQL/Postgres DSN | `mysql://user:***@host:3306/db` |
| `DB_CONN_MAX_AGE` | Persistent connections (sec) | `300` |
| `DB_CONNECT_TIMEOUT` | MySQL connect timeout | `10` |
| `DB_READ_TIMEOUT` / `DB_WRITE_TIMEOUT` | Query timeouts | `30` |
| `REDIS_URL` | Shared cache/throttle/Celery | `redis://127.0.0.1:6379/0` or `disabled` |
| `WEB_CONCURRENCY` | Gunicorn workers | see sizes below |
| `GUNICORN_THREADS` | Threads per sync worker | `2`–`4` |
| `GUNICORN_TIMEOUT` | Worker soft timeout | `120` |
| `THROTTLE_LOGIN` / `THROTTLE_ANON` / `THROTTLE_USER` | DRF rates | `40/min`, `200/min`, `750/min` |
| `API_PAGE_SIZE` / `API_MAX_PAGE_SIZE` | Pagination | `100` / `200` |
| `DASHBOARD_CACHE_TTL` | Unified dashboard cache sec | `45`–`120` |
| `READY_REQUIRE_REDIS` | `/api/v1/ready/` fails if Redis down | `0` or `1` |
| `FORWARDED_ALLOW_IPS` | Proxy trust | `127.0.0.1,::1` |
| `ALLOW_EAGER_EXPORTS` | Allow inline Celery exports without Redis | `0` in prod; `1` local only |
| `OBSERVABILITY_REQUEST_LOG` | Log request method/path/status/ms | `0` or `1` |
| `CELERY_TASK_SOFT_TIME_LIMIT` / `CELERY_TASK_TIME_LIMIT` | Task timeouts (sec) | `120` / `180` |

## Size examples

### Current VPS — 1 vCPU / 4GB (Hostinger MySQL hourly cap)

```
WEB_CONCURRENCY=2
GUNICORN_THREADS=2
DB_CONN_MAX_AGE=300
REDIS_URL=disabled
READY_REQUIRE_REDIS=0
THROTTLE_USER=300/min
```

Do **not** raise workers while `max_connections_per_hour` is 500.

### Future — 4 vCPU / 8GB + Redis + dedicated MySQL

```
WEB_CONCURRENCY=6
GUNICORN_THREADS=2
REDIS_URL=redis://redis:6379/0
READY_REQUIRE_REDIS=1
DB_CONN_MAX_AGE=120
THROTTLE_USER=1200/min
```

### Future — 8 vCPU / 16GB multi-instance

```
WEB_CONCURRENCY=4
GUNICORN_THREADS=2
REDIS_URL=redis://redis:6379/0
READY_REQUIRE_REDIS=1
```

Run 2–3 API instances behind Caddy/Nginx LB; keep worker count modest per instance.

## Rollback

1. Revert `REDIS_URL=disabled` and restart API.
2. Restore previous `WEB_CONCURRENCY` in systemd unit.
3. `/api/v1/health/` remains available even if `/ready/` fails.

## 500+ concurrent users

Not claimed until Locust sustained ≥500 on **staging MySQL + Gunicorn + real Redis** meets SLO.
SQLite / Waitress / fakeredis results are diagnostic only.
