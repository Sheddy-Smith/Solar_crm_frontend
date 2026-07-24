# VPS Dual-App Separation — Malwa (poer.in) + Aitrads (api.aitrads.in)

**Updated:** 17 July 2026  
**VPS:** `200.97.171.119` / `srv1831231.hstgr.cloud`

## Problem (before)

Both apps tried to own **ports 80 + 443** via Caddy:

| Deploy | Effect |
|--------|--------|
| Aitrads Caddy rebuild | Overwrote routes → **poer.in / api.poer.in broke** |
| Malwa Caddyfile patch | Overwrote Aitrads routes → **api.aitrads.in broke** |

## Solution (now)

**One shared edge proxy** owns public 80/443.  
Apps stay separate and never publish 80/443 themselves.

```
Internet :80/:443
        │
        ▼
 /docker/shared-edge  (container: shared-edge)
        │
        ├── api.aitrads.in  →  crypto-ai-trads-backend:8000  (Docker network)
        ├── poer.in / www   →  host 127/docker0 :8080        (malwa-frontend)
        └── api.poer.in     →  host :8001                    (malwa-gunicorn)
```

---

## Folder layout on VPS

| Path | Belongs to | Role |
|------|------------|------|
| `/docker/shared-edge/` | **Shared (do not delete)** | Public HTTPS + hostname routing |
| `/docker/crypto-ai-trads/` | Aitrads | Backend (+ optional internal caddy, **no host 80/443**) |
| `/docker/malwa-frontend/` | Malwa Solar | Frontend container on **:8080** |
| `/var/www/malwa-crm/backend/` | Malwa Solar | Django + gunicorn on **:8001** |

### Shared edge files

- `/docker/shared-edge/Caddyfile`
- `/docker/shared-edge/docker-compose.yml`
- `/docker/shared-edge/README.txt`

---

## Domains

| Domain | App | Upstream |
|--------|-----|----------|
| `https://api.aitrads.in` | Aitrads API | `crypto-ai-trads-backend-1:8000` |
| `https://poer.in` | Malwa frontend | `:8080` |
| `https://www.poer.in` | Malwa frontend | `:8080` |
| `https://api.poer.in` | Malwa API | `:8001` |

`aitrads.in` website (if any) stays on Hostinger File Manager / other hosting — not this VPS edge.

---

## Rules (important)

1. **Never** map `80:80` / `443:443` in `crypto-ai-trads` compose again.  
2. **Never** put poer routes inside `/docker/crypto-ai-trads/Caddyfile`.  
3. Domain routing changes → edit **only** `/docker/shared-edge/Caddyfile`, then:
   ```bash
   cd /docker/shared-edge && docker compose up -d --force-recreate
   ```
4. Malwa frontend stays on **8080**; API on **8001**.

---

## How to redeploy each app safely

### Aitrads only

```bash
cd /docker/crypto-ai-trads
docker compose up -d backend --build
# Do NOT publish caddy to host 80/443
curl -s https://api.aitrads.in/health
```

### Malwa frontend only

```bash
cd /docker/malwa-frontend
docker compose build --build-arg VITE_API_URL=https://api.poer.in/api/v1
docker compose up -d
curl -sI https://poer.in | head
```

### Malwa backend only

```bash
systemctl restart malwa-gunicorn
curl -sI https://api.poer.in/api/v1/ | head
```

### Shared edge (SSL / routing)

```bash
cd /docker/shared-edge
docker compose up -d --force-recreate
docker logs shared-edge --tail 50
```

---

## Verify both live

```bash
curl -s -o /dev/null -w "poer=%{http_code}\n" https://poer.in/
curl -s -o /dev/null -w "api_poer=%{http_code}\n" https://api.poer.in/api/v1/
curl -s -o /dev/null -w "api_aitrads=%{http_code}\n" https://api.aitrads.in/health
curl -s https://api.aitrads.in/health
```

Expected:

- `poer=200`
- `api_poer=401` (no token — OK)
- `api_aitrads=200` and `{"status":"ok"}`

---

## Malwa login (current)

| Field | Value |
|-------|--------|
| URL | https://poer.in |
| Email | `Ecomalwa@poer.in` |
| Password | `M@lw@_822` |

---

## Why this won’t fight anymore

- Aitrads deploy rebuilds **their** containers only — no public ports.
- Malwa deploy rebuilds **frontend/gunicorn** only — no public ports.
- Only `shared-edge` listens on 80/443 and routes by **hostname**.

If someone accidentally starts old `crypto-ai-trads` caddy with host ports, it will fail with “port already in use” or steal traffic — then stop it:

```bash
cd /docker/crypto-ai-trads && docker compose stop caddy
cd /docker/shared-edge && docker compose up -d
```
