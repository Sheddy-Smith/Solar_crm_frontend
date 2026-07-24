# Malwa Solar CRM — Full Deployment Guide (poer.in)

**Last verified:** 17 July 2026  
**Status:** Live (Frontend + Backend + DB + API connected)  
**Purpose:** Starting-to-end record of everything used for production on Hostinger VPS — domains, DNS, passwords, keys, paths, how traffic flows, and how to maintain it.

> **SECURITY WARNING**  
> This file contains live passwords, DB credentials, Django `SECRET_KEY`, API keys, and SSH key names.  
> Keep it private. Do **not** commit it to a public GitHub repo. Prefer storing a copy offline / in a password manager.

---

## 1. What was the goal?

Deploy **Malwa Solar CRM** on a custom domain so the team can use it from the internet:

| Piece | Public URL |
|-------|------------|
| Website (React SPA) | https://poer.in |
| Same site (www) | https://www.poer.in |
| Backend API (Django) | https://api.poer.in |
| API base path used by frontend | https://api.poer.in/api/v1 |

Portals on the home page:

1. **CRM Operations** — main CRM  
2. **Tele Executive** — telecaller portal  

---

## 2. Accounts & ownership (who owns what)

### 2.1 Domain

| Item | Value |
|------|--------|
| Domain | `poer.in` |
| Registrar / DNS panel | Hostinger hPanel → Domains → **DNS / Nameservers** |
| Nameservers (as used) | `ns1.dns-parking.com`, `ns2.dns-parking.com` |
| Email associated (lab) | Domain used with lab / Hostinger account that owns `poer.in` |

### 2.2 GitHub (production / lab)

| Item | Value |
|------|--------|
| GitHub user | `sheddysmithlab-dot` |
| Frontend repo | https://github.com/sheddysmithlab-dot/solar_crm_frontend |
| Backend repo | https://github.com/sheddysmithlab-dot/solar_crm_backend |
| SSH host alias (local PC) | `github.com-lab` |
| SSH private key (local) | `~/.ssh/id_ed25519_lab` |

### 2.3 GitHub (dev / testing — not this live site)

| Item | Value |
|------|--------|
| Dev GitHub | Sheddy-Smith / 822 account |
| Monorepo (dev) | `Solar_crm_frontend` (and related) |
| SSH key | `~/.ssh/id_ed25519_822` |
| Typical hosts | Vercel + Render for testing |

### 2.4 Local folders on Windows PC

| Role | Path |
|------|------|
| Dev monorepo | `C:\Malwa_Solar_CRM` |
| Prod frontend checkout | `C:\Malwa_Solar_CRM_PROD\malwa-crm-frontend` |
| Prod backend checkout | `C:\Malwa_Solar_CRM_PROD\malwa-crm-backend` |
| Sync script | `C:\Malwa_Solar_CRM\scripts\sync-to-lab.ps1` |
| Lab config | `C:\Malwa_Solar_CRM\scripts\lab-repos.config.ps1` |

---

## 3. VPS (server) — full detail

### 3.1 Hostinger VPS identity

| Item | Value |
|------|--------|
| Provider | Hostinger |
| Panel | https://hpanel.hostinger.com → **VPS** → **Manage** |
| Hostname | `srv1831231.hstgr.cloud` |
| Public IPv4 | **`200.97.171.119`** |
| Location | India — Mumbai 2 |
| Plan | **KVM 1** |
| OS | **Ubuntu 24.04 LTS** |
| CPU | 1 vCore |
| RAM | 4 GB (~3.8 Gi visible) |
| Disk | 50 GB (~48G filesystem; ~4.8G used at verify time) |
| Bandwidth | 4 TB |
| Plan expiry (panel) | 2027-07-15 |
| SSH user | `root` |
| SSH command | `ssh root@200.97.171.119` |
| SSH key used from PC | `C:\Users\<you>\.ssh\id_ed25519_lab` |

Example SSH from PowerShell:

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519_lab root@200.97.171.119
```

### 3.2 What else already runs on this VPS

This VPS is **shared** with another Docker project:

| Project | Role |
|---------|------|
| `crypto-ai-trads` | Existing app; its **Caddy** container owns ports **80** and **443** |
| `malwa-frontend` | Malwa CRM frontend container on host port **8080** |
| Host systemd `malwa-gunicorn` | Malwa CRM Django API on port **8001** |
| Host PostgreSQL + Redis | Database + cache for Malwa CRM |

**Important:** Because Caddy already uses 80/443, Malwa CRM is **not** a second nginx on those ports. Instead:

- Caddy terminates HTTPS for `poer.in` / `www` / `api.poer.in`
- Then reverse-proxies to frontend `:8080` and API `:8001`

---

## 4. DNS records (final working state)

Managed in Hostinger → Domains → `poer.in` → **DNS / Nameservers** → Manage DNS records.

| Type | Name | Content (Value) | TTL | Meaning |
|------|------|-----------------|-----|---------|
| A | `@` | `200.97.171.119` | 300 | `poer.in` → VPS |
| A | `www` | `200.97.171.119` | 300 | `www.poer.in` → VPS |
| A | `api` | `200.97.171.119` | 300 | `api.poer.in` → VPS |
| A | `ftp` | `82.112.239.175` | 1800 | Unrelated Hostinger default — leave alone |

### What was removed (old / broken for VPS)

These pointed to Hostinger CDN and blocked VPS hosting:

- **ALIAS** `@` → `poer.in.cdn.hstgr.net` → **deleted**
- **CNAME** `www` → `www.poer.in.cdn.hstgr.net` → **deleted**

### How to verify DNS

```powershell
Resolve-DnsName poer.in -Type A
Resolve-DnsName www.poer.in -Type A
Resolve-DnsName api.poer.in -Type A
```

All three should show **`200.97.171.119`**.

---

## 5. SSL / HTTPS certificates

Caddy (Let's Encrypt) auto-issues certificates.

| Hostname | Issuer | Status (verified 17 Jul 2026) |
|----------|--------|-------------------------------|
| `poer.in` | Let's Encrypt | Valid (~3 months) |
| `www.poer.in` | Let's Encrypt | Valid |
| `api.poer.in` | Let's Encrypt | Valid |

Caddy ACME email configured as: `admin@poer.in`

Certificates renew automatically via Caddy as long as DNS keeps pointing to this VPS and ports 80/443 stay open.

---

## 6. Website / product detail

| Item | Value |
|------|--------|
| Brand | Malwa Solar Energy — CRM SYSTEM |
| Product name | Malwa Solar CRM |
| Frontend stack | React + Vite |
| Backend stack | Django 4.2 + Django REST Framework + SimpleJWT |
| DB | PostgreSQL |
| Cache | Redis |
| Process manager (API) | Gunicorn (systemd) |
| Edge / reverse proxy | Caddy (Docker, shared with crypto-ai-trads) |
| Frontend runtime | Docker → nginx alpine serving static `dist/` |

### Public entry points

| URL | What you see |
|-----|----------------|
| https://poer.in | Portal chooser (CRM / Tele) |
| https://poer.in/dashboard | Same SPA routes |
| https://api.poer.in/api/v1/ | JSON API (401 without JWT — expected) |
| https://api.poer.in/api/v1/auth/login/ | Login endpoint (POST JSON) |

---

## 7. Login credentials (application)

| Item | Value |
|------|--------|
| Admin email | `admin@poer.in` |
| Admin password | `Admin@Poer2026!` |
| Role | Super Admin |
| Staff / superuser flags | Yes |

**Change this password after first login** (Settings / user admin).

Login API (for testing):

```bash
curl -X POST https://api.poer.in/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@poer.in","password":"Admin@Poer2026!"}'
```

Successful response includes:

- `access` JWT  
- `refresh` JWT  
- `user` object (`email`, `role_name`, etc.)

---

## 8. Database credentials

| Item | Value |
|------|--------|
| Engine | PostgreSQL (localhost on VPS) |
| Listen | `127.0.0.1:5432` |
| Database name | `malwa_crm` |
| DB user | `malwa` |
| DB password | `MalwaCrm_Poer_2026!` |
| Connection URL | `postgres://malwa:MalwaCrm_Poer_2026!@127.0.0.1:5432/malwa_crm` |
| Tables (approx) | ~102 public tables |

Redis:

| Item | Value |
|------|--------|
| URL | `redis://127.0.0.1:6379/0` |
| Ping | `PONG` |

---

## 9. Backend environment variables (live `.env`)

**File on VPS:** `/var/www/malwa-crm/backend/.env`

```env
DJANGO_SETTINGS_MODULE=malwa_solar.settings.production
SECRET_KEY=malwa-solar-dev-secret-key-2024-change-in-production-xK9mP2qR7nL4wJ8vB5cT
DEBUG=False
ALLOWED_HOSTS=api.poer.in,poer.in,www.poer.in,200.97.171.119,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://poer.in,https://www.poer.in,http://poer.in,http://www.poer.in
CSRF_TRUSTED_ORIGINS=https://poer.in,https://www.poer.in,https://api.poer.in
DATABASE_URL=postgres://malwa:MalwaCrm_Poer_2026!@127.0.0.1:5432/malwa_crm
REDIS_URL=redis://127.0.0.1:6379/0
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=Malwa Solar CRM <your@gmail.com>
MEDIA_ROOT=/var/www/malwa_solar/media
GOOLGLE_MAPS_API_KEY=AIzaSyB4SpBWq_0CnPhUvi6OUiM_9l5GRk4Fd1E
```

### Notes on keys

| Key | Meaning |
|-----|---------|
| `SECRET_KEY` | Django crypto signing key — **should be rotated** to a long random value for stronger production security |
| `GOOLGLE_MAPS_API_KEY` | Google Maps key (note the typo in the env var name: `GOOLGLE_...`) — replace if this key is restricted/expired |
| Email vars | Still placeholders (`your@gmail.com`) — email notifications will not work until real SMTP is set |
| `DEBUG=False` | Production mode |

**Production settings module:** `malwa_solar.settings.production`  
**TLS note:** `SECURE_SSL_REDIRECT` was set to `False` on the server because HTTPS terminates at Caddy (avoids redirect loops / broken proxy).

---

## 10. Frontend ↔ API connection

Frontend is built with Vite env:

| Build arg / env | Value |
|-----------------|--------|
| `VITE_API_URL` | `https://api.poer.in/api/v1` |

This is baked into the JS bundle at **build time** (not changeable without rebuild).

Verified inside container assets: strings contain `https://api.poer.in/api/v1`.

CORS verified:

- Preflight `OPTIONS` → `200`
- `Access-Control-Allow-Origin: https://poer.in`

---

## 11. How traffic flows (architecture)

```
Internet user
    │
    ▼
DNS: poer.in / www / api  →  200.97.171.119
    │
    ▼
Caddy container (ports 80 + 443)
  • HTTPS + Let's Encrypt
  • Routes by hostname:
        poer.in / www.poer.in  →  host 172.17.0.1:8080  →  Docker malwa-frontend (nginx)
        api.poer.in            →  host 172.17.0.1:8001  →  Gunicorn (Django)
    │
    ├─ Frontend serves React SPA (static files)
    │     browser JS calls https://api.poer.in/api/v1/...
    │
    └─ Backend Django
          ├─ PostgreSQL 127.0.0.1:5432 / malwa_crm
          └─ Redis 127.0.0.1:6379/0
```

### Caddyfile (relevant Malwa parts)

Path on VPS: `/docker/crypto-ai-trads/Caddyfile`

```caddy
{
	email admin@poer.in
}

# ... existing crypto-ai-trads {$VPS_HOST} block ...

poer.in, www.poer.in {
	reverse_proxy 172.17.0.1:8080
}

api.poer.in {
	reverse_proxy 172.17.0.1:8001 {
		header_up X-Forwarded-Proto {scheme}
		header_up X-Real-IP {remote_host}
		header_up Host {host}
	}
}
```

---

## 12. Paths & services on the VPS

### 12.1 Important directories

| Path | What |
|------|------|
| `/var/www/malwa-crm/backend` | Django project + `.venv` + `.env` |
| `/var/www/malwa-crm/frontend` | Older frontend tree (Docker image is what serves live now) |
| `/var/www/malwa-crm/logs` | Logs folder |
| `/var/www/malwa-crm/run` | Runtime folder |
| `/docker/malwa-frontend` | Frontend Docker compose project |
| `/docker/crypto-ai-trads` | Shared Caddy + other app |
| `/etc/systemd/system/malwa-gunicorn.service` | API service unit |

### 12.2 Systemd — Gunicorn

| Item | Value |
|------|--------|
| Unit | `malwa-gunicorn.service` |
| User | `malwa` |
| Workdir | `/var/www/malwa-crm/backend` |
| Bind | `0.0.0.0:8001` (needed so Docker/Caddy can reach it) |
| Workers | 2 |
| Timeout | 120s |
| Command | `.venv/bin/gunicorn malwa_solar.wsgi:application --bind 0.0.0.0:8001 --workers 2 --timeout 120` |

Useful commands:

```bash
systemctl status malwa-gunicorn
systemctl restart malwa-gunicorn
journalctl -u malwa-gunicorn -n 50 --no-pager
```

### 12.3 Docker — Frontend

| Item | Value |
|------|--------|
| Container name | `malwa-frontend` |
| Host port | `8080` → container `80` |
| Compose path | `/docker/malwa-frontend/docker-compose.yml` |
| Image build | Node 20 build → nginx alpine |

Rebuild example:

```bash
cd /docker/malwa-frontend
docker compose build --build-arg VITE_API_URL=https://api.poer.in/api/v1
docker compose up -d
```

### 12.4 Port map (quick)

| Port | Listener | Purpose |
|------|----------|---------|
| 80 / 443 | Caddy | Public HTTP/HTTPS |
| 8080 | malwa-frontend | CRM UI (internal via Caddy) |
| 8001 | gunicorn | CRM API (internal via Caddy) |
| 5432 | postgres | DB (localhost) |
| 6379 | redis | Cache (localhost) |

Firewall note: host firewall rules were adjusted so `:8001` is not freely usable from the public internet; prefer always using `https://api.poer.in`.

---

## 13. Deployment timeline (starting → end)

This is the journey in plain language.

### Phase A — Prepare code & GitHub (lab)

1. Split / sync production code into lab repos:
   - `sheddysmithlab-dot/solar_crm_frontend`
   - `sheddysmithlab-dot/solar_crm_backend`
2. Local prod folders under `C:\Malwa_Solar_CRM_PROD\...`
3. SSH keys configured: `id_ed25519_lab` → GitHub lab + VPS

### Phase B — Buy / identify infrastructure

1. Domain **`poer.in`** on Hostinger DNS
2. VPS **`srv1831231.hstgr.cloud`** / IP **`200.97.171.119`** (Ubuntu 24.04, KVM 1)
3. Discovered existing Docker app **crypto-ai-trads** already bound to 80/443 via Caddy

### Phase C — First complex attempt (then simplified)

Earlier attempt installed host nginx + full stack; user asked to **simplify**:

1. Frontend first  
2. Backend next  
3. Connect them  

### Phase D — Frontend live

1. Added `Dockerfile` + `docker-compose.yml` + nginx conf to frontend repo
2. Built/ran container **`malwa-frontend`** on **`:8080`**
3. Temporary test URL: `http://200.97.171.119:8080`
4. Updated Caddy so `poer.in` / `www.poer.in` → `:8080`
5. User set DNS A records for `@` and `www` → VPS IP
6. Let's Encrypt issued certs → **https://poer.in** worked (portal page)

### Phase E — Backend live + API domain

1. Confirmed host already had:
   - PostgreSQL + Redis
   - Code at `/var/www/malwa-crm/backend`
   - `malwa-gunicorn` on port 8001
2. Fixed proxy issues:
   - `SECURE_SSL_REDIRECT=False` behind Caddy
   - Gunicorn bind changed from `127.0.0.1:8001` → `0.0.0.0:8001` (so Docker bridge can connect)
3. Caddy route added: `api.poer.in` → `:8001`
4. User added DNS A record **`api` → 200.97.171.119**
5. SSL issued for `api.poer.in`
6. Login + CORS verified end-to-end

### Phase F — Verification (all green)

| Check | Result |
|-------|--------|
| https://poer.in | 200 |
| https://www.poer.in | 200 |
| https://api.poer.in/api/v1/ | 401 (auth required — OK) |
| Login API | 200 + JWT |
| CORS from poer.in | Allow-Origin OK |
| Postgres `malwa_crm` | OK, admin user present |
| Redis | PONG |
| Frontend build API URL | `https://api.poer.in/api/v1` |

---

## 14. SSH keys cheat sheet

| Key file | Used for |
|----------|----------|
| `~/.ssh/id_ed25519_lab` | Lab GitHub (`github.com-lab`) + this Hostinger VPS |
| `~/.ssh/id_ed25519_822` | Dev GitHub / older Hostinger host `139.59.64.36` |

`~/.ssh/config` excerpt:

```
Host github.com-lab
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_lab
  IdentitiesOnly yes
```

---

## 15. Useful maintenance commands

### Check services

```bash
systemctl is-active malwa-gunicorn postgresql redis-server
docker ps
curl -I https://poer.in
curl -I https://api.poer.in/api/v1/
```

### Restart API

```bash
systemctl restart malwa-gunicorn
```

### Restart frontend container

```bash
cd /docker/malwa-frontend && docker compose restart
```

### Reload Caddy after Caddyfile edit

```bash
cd /docker/crypto-ai-trads
docker compose build caddy
docker compose up -d --no-deps caddy --force-recreate
```

### Django management (on VPS)

```bash
sudo -u malwa bash -lc 'cd /var/www/malwa-crm/backend && . .venv/bin/activate && export DJANGO_SETTINGS_MODULE=malwa_solar.settings.production && python manage.py migrate'
```

### Create / reset admin password

```bash
sudo -u malwa bash -lc 'cd /var/www/malwa-crm/backend && . .venv/bin/activate && export DJANGO_SETTINGS_MODULE=malwa_solar.settings.production && python manage.py shell -c "
from django.contrib.auth import get_user_model
u = get_user_model().objects.get(email=\"admin@poer.in\")
u.set_password(\"NEW_PASSWORD_HERE\")
u.save()
print(\"ok\")
"'
```

---

## 16. How to update code later (simple recipe)

### Frontend update

1. Push changes to `sheddysmithlab-dot/solar_crm_frontend`  
2. On VPS:

```bash
cd /docker/malwa-frontend
# pull latest / copy files as you usually sync
docker compose build --build-arg VITE_API_URL=https://api.poer.in/api/v1
docker compose up -d
```

### Backend update

1. Push to `sheddysmithlab-dot/solar_crm_backend`  
2. Sync files into `/var/www/malwa-crm/backend`  
3. Then:

```bash
sudo -u malwa bash -lc 'cd /var/www/malwa-crm/backend && . .venv/bin/activate && pip install -r requirements.txt && export DJANGO_SETTINGS_MODULE=malwa_solar.settings.production && python manage.py migrate && python manage.py collectstatic --noinput'
systemctl restart malwa-gunicorn
```

---

## 17. Known leftovers / recommended next hardening

| Item | Current | Recommendation |
|------|---------|----------------|
| Django `SECRET_KEY` | Dev-looking string still in prod | Generate a new long random secret and restart gunicorn |
| Email SMTP | Placeholder | Set real Gmail app password or transactional email |
| Google Maps key | Present (`GOOLGLE_MAPS_API_KEY` typo) | Confirm key works; fix env var name in code if needed |
| Admin password | Shared in this doc | Change immediately after handoff |
| Media path | `MEDIA_ROOT=/var/www/malwa_solar/media` | Ensure folder exists + permissions for uploads |
| Shared VPS with crypto-ai-trads | Same Caddy | Avoid editing Caddyfile without keeping both apps' blocks |

---

## 18. Quick reference card (print / save)

```
Domain:        poer.in
Website:       https://poer.in
API:           https://api.poer.in/api/v1
VPS IP:        200.97.171.119
VPS host:      srv1831231.hstgr.cloud
SSH:           ssh -i ~/.ssh/id_ed25519_lab root@200.97.171.119

Admin login:   admin@poer.in / Admin@Poer2026!
DB:            malwa_crm / user malwa / MalwaCrm_Poer_2026!
Redis:         redis://127.0.0.1:6379/0

Frontend:      Docker malwa-frontend :8080
Backend:       systemd malwa-gunicorn :8001
Proxy/SSL:     Docker Caddy :80/:443

GitHub FE:     sheddysmithlab-dot/solar_crm_frontend
GitHub BE:     sheddysmithlab-dot/solar_crm_backend
```

---

## 19. Glossary (simple meanings)

| Term | Meaning |
|------|---------|
| DNS A record | Maps a name (`poer.in`) to an IP (`200.97.171.119`) |
| Caddy | Reverse proxy that also gets free HTTPS certificates |
| Gunicorn | Runs Django app as a production web server |
| JWT | Login token stored in browser; sent as `Authorization: Bearer ...` |
| CORS | Browser security rule — API must allow `https://poer.in` origin |
| `VITE_API_URL` | Frontend build-time setting for backend base URL |
| VPS | Virtual private server — your always-on Ubuntu machine at Hostinger |

---

*End of document — Malwa Solar CRM production deployment on poer.in / Hostinger VPS.*
