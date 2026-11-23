# Malwa Solar CRM — Category-wise Microservices Audit & Target Map

**Date:** 2026-11-23  
**Current architecture:** Modular **monolith** (NOT microservices)  
**Target:** Domain microservices (one deployable service per major category)  
**Status:** Phases 0–5 **scaffolded** (2026-11-23) — see `services/README.md`  
**Runtime model:** Strangler microservices (process + gateway per category; **shared DB** until Phase 5+ data split)

---

## 1. Direct answer

| Question | Answer |
|----------|--------|
| Is this project using microservices today? | **No** |
| What is it? | **Modular monolith** — one Django process, one `/api/v1/`, one shared DB |
| What does “microservices in each category” mean here? | Split each domain category into its **own service** (own deploy, own API, own data boundary) with a shared **API Gateway + Auth** |

```
TODAY (monolith)                    TARGET (microservices)
─────────────────                   ──────────────────────
React SPA                           React SPA
   │                                   │
   ▼                                   ▼
Django /api/v1/*  ───► MySQL        API Gateway
   (all apps)                          │
                        ┌──────────────┼──────────────┐
                        ▼              ▼              ▼
                     auth-svc      leads-svc     projects-svc …
                        │              │              │
                        └────── DB per service / events ──┘
```

---

## 2. Category-wise audit (as-is)

| # | Category (CRM domain) | Django app(s) | Models (approx) | API prefix | Microservice today? | Coupling / notes |
|---|----------------------|---------------|-----------------|------------|---------------------|------------------|
| 1 | **Identity & Access** | `accounts` | ~5 | `/users/`, `/roles/`, `/branches/`, auth JWT | No — shared kernel | Every module imports User/Role/permissions |
| 2 | **Leads & Quotations** | `leads` | ~12 | `/leads/`, `/quotations/`, follow-ups | No | Cross-writes MaterialPlan / project cost (sync debt) |
| 3 | **Projects / BOM / Materials** | `projects` | ~21 | `/projects/`, BOM, work orders | No | Heavy FKs to Lead, Inventory, Accounts |
| 4 | **Inventory** | `inventory` | ~4 | `/inventory/` | No | Stock movements tied to project dispatch |
| 5 | **Finance / Accounts** | `accounts_module` | ~29 | `/accounts/` | No | Largest finance surface; invoices ↔ payments ↔ inventory |
| 6 | **Workforce / HR** | `workforce` | ~6 | `/workforce/` | No | Attendance, employees; User overlap |
| 7 | **Liaisoning (L&C)** | `liaisoning` | ~13 | `/liaison/` | No | Project-scoped docs + encrypted credentials |
| 8 | **O&M** | `om` | ~18 | `/om/` | No | Plants, tickets, maintenance; project link |
| 9 | **AMC** | `amc` | ~7 | `/amc/` | No | Contracts / renewals |
| 10 | **Daily Tasks** | `daily_tasks` | ~2 | `/daily-tasks/` | No | Staff assignments; notifications |
| 11 | **Notifications** | `notifications` | ~2 | `/notifications/` | No | Cross-cutting — should stay a platform service |
| 12 | **CRM Settings / Org** | `crm_settings` | ~17 | `/settings/` | No | Org snapshot used CRM-wide |
| 13 | **Dashboard / Insights** | `dashboard` | 0 (aggregates) | `/dashboard/` | No | Reads many modules — becomes BFF or query service |
| 14 | **Reports** | `reports` | 0 | `/reports/` | No | Export/async jobs — good Celery/worker candidate |
| 15 | **Frontend shell** | `src/App.jsx` + pages | — | Hostinger static | No | One SPA talking to one API |

**Shared infrastructure (not a “category product”, but required platform):**

| Platform piece | Today | Target microservice / component |
|----------------|-------|----------------------------------|
| Auth (JWT) | Inside Django monolith | `auth-service` (issue/validate tokens) |
| Media uploads | Django media view | `media-service` or S3 + signed URLs |
| Cache / async | Redis + Celery (optional) | Shared Redis + per-service workers |
| DB | Single MySQL | **DB-per-service** (or schema-per-service first) |
| Deploy | 1× VPS API + Hostinger FE | N× services + gateway |

---

## 3. Target microservices map (each category)

| Service name | Owns | Public API (example) | Talks to |
|--------------|------|----------------------|----------|
| `gateway` | Routing, TLS, rate limit | `https://api.crm…/` | all |
| `auth-service` | Users, roles, JWT, branches | `/auth/*`, `/users/*` | — |
| `leads-service` | Leads, follow-ups, quotations | `/leads/*`, `/quotations/*` | auth, projects (events) |
| `projects-service` | Projects, BOM, milestones, material plans | `/projects/*` | auth, leads, inventory |
| `inventory-service` | Items, warehouses, movements | `/inventory/*` | auth, projects |
| `finance-service` | Invoices, payments, ledger | `/finance/*` or `/accounts/*` | auth, projects, inventory |
| `workforce-service` | Employees, attendance | `/workforce/*` | auth |
| `liaison-service` | L&C applications/docs | `/liaison/*` | auth, projects |
| `om-service` | Plants, tickets, maintenance | `/om/*` | auth, projects |
| `amc-service` | AMC contracts | `/amc/*` | auth, om/projects |
| `tasks-service` | Daily / staff tasks | `/daily-tasks/*` | auth, notifications |
| `notifications-service` | In-app + push | `/notifications/*` | all (events) |
| `settings-service` | Company profile, FY, masters | `/settings/*` | auth |
| `insights-service` | Dashboard aggregates | `/dashboard/*` | read models / events |
| `reports-service` | Heavy exports | `/reports/*` | others via APIs |

**Frontend:** stay one SPA initially; `VITE_API_URL` → gateway only (not 14 origins).

---

## 4. Hard blockers (why “split everything tomorrow” fails)

1. **~579+ ForeignKeys** across apps — data is deeply relational in one DB.  
2. **Shared User / permission matrix** — every ViewSet uses `HasModulePermission`.  
3. **Dashboard/Reports** read across domains — need CQRS/events or they stay a BFF on monolith longer.  
4. **Quotation ↔ MaterialPlan auto-sync** — already an independence problem inside the monolith.  
5. **Single FE + single JWT issuer** — must introduce gateway + service-to-service auth first.  
6. **Ops cost** — 14 deploys, 14 health checks, tracing, migrations.

---

## 5. Recommended phases (step-by-step)

### Phase 0 — Foundation (1–2 weeks)
- API Gateway (Caddy/Nginx/Traefik or Kong) in front of current monolith  
- Extract **auth** contract (JWT introspection / shared JWKS)  
- Define **domain events** bus (Redis Streams / RabbitMQ / NATS)  
- “Strangler” rule: new features only behind clear service boundaries  

### Phase 1 — First real service (extract one category)
**Recommended first extract:** `notifications-service` or `settings-service` (smaller, fewer FK cycles)  
**OR business-priority first:** `leads-service` (highest churn) after auth.

### Phase 2 — Core revenue path
`leads` → `projects` → `inventory` → `finance` (in that order; match EPC flow)

### Phase 3 — Field ops
`liaison`, `om`, `amc`, `tasks`, `workforce`

### Phase 4 — Read side
`insights-service` + `reports-service` on event projections

### Phase 5 — Decommission monolith
Monolith becomes empty shell / deleted after traffic fully routed

---

## 6. Per-category readiness score

| Category | Split readiness | Why |
|----------|-----------------|-----|
| Notifications | High | Few models, event-driven already |
| Settings / Org | Medium-High | Read-heavy; many FE consumers of snapshot |
| Daily Tasks | Medium | Small; branch scoping |
| Workforce | Medium | User overlap |
| AMC | Medium | Bounded |
| O&M | Medium-Low | Plant ↔ project |
| Liaisoning | Medium-Low | Project + encrypted secrets |
| Inventory | Low-Medium | Dispatch sync from projects |
| Leads/Quotations | Low | Center of web; sync side-effects |
| Projects/BOM | Low | Hub entity |
| Finance | Low | Most models; money integrity |
| Dashboard/Reports | Low | Cross-aggregate |

---

## 7. What we will NOT do in one shot

- Do not rewrite all 14 apps into 14 repos overnight  
- Do not give each service a separate public URL without a gateway  
- Do not share one DB with free cross-service JOINs and call it “microservices” (that is a distributed monolith)

---

## 8. Implementation completed (scaffold)

| Phase | Deliverable | Location |
|-------|-------------|----------|
| 0 | Shared JWT/events + registry | `services/shared/malwa_shared/` |
| 0 | API Gateway | `services/gateway/Caddyfile` (+ `.docker`) |
| 0–4 | 14 category services | `python services/run_service.py <name>` |
| 0–4 | Compose mesh | `docker-compose.microservices.yml` |
| 5 | Runbook + FE gateway URL | `services/README.md` |

**Still future work (true microservices maturity):** DB-per-service, event-driven write decoupling, remove shared ORM imports, retire monolith process.

### Run locally
```powershell
.\scripts\run-all-microservices.ps1
caddy run --config services/gateway/Caddyfile
# FE: VITE_API_URL=http://127.0.0.1:8080/api/v1
```
