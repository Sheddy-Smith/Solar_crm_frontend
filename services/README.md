# Malwa CRM Microservices (Strangler)

Category-wise **deployable services** in front of the existing Django codebase.

## Honest status

| Layer | Status |
|-------|--------|
| Service slices (14 domains) | **Done** — each runs its own process/port |
| API Gateway (Caddy) | **Done** — routes by URL prefix |
| Shared JWT + events helpers | **Done** |
| Docker Compose mesh | **Done** |
| Separate database per service | **Not yet** — still shared `DATABASE_URL` (Phase 5+) |
| Full event-driven decoupling | **Scaffold only** — `malwa_shared.events` |

This is the industry **strangler-fig** path: process + route isolation first, data ownership later.

## Ports

| Service | Port |
|---------|------|
| gateway | 8080 |
| auth | 8001 |
| notifications | 8002 |
| settings | 8003 |
| leads | 8004 |
| projects | 8005 |
| inventory | 8006 |
| finance | 8007 |
| workforce | 8008 |
| liaison | 8009 |
| om | 8010 |
| amc | 8011 |
| tasks | 8012 |
| insights | 8013 |
| reports | 8014 |
| monolith fallback (optional) | 8000 |

## Run one service

```powershell
cd C:\Malwa_Solar_CRM
$env:PYTHONPATH="$pwd;$pwd\backend;$pwd\services\shared"
python services/run_service.py auth
```

## Run all (Windows)

```powershell
.\scripts\run-all-microservices.ps1
caddy run --config services/gateway/Caddyfile
```

Point FE: `VITE_API_URL=http://127.0.0.1:8080/api/v1`

## Docker

```powershell
docker compose -f docker-compose.microservices.yml up --build
```
