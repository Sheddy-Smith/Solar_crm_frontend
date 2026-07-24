# Dual GitHub Workflow — Testing (822) → Production (lab)

**Last updated:** 17 July 2026  
**Project home (always code here):** `C:\Malwa_Solar_CRM`

This guide answers:

- Are both GitHub IDs connected?
- How do I push from one folder to both accounts?
- What is `C:\Malwa_Solar_CRM_PROD`?
- If I change the main folder, how does PROD update?
- Exact commands for everyday use

---

## 1. Short answer (read this first)

| Question | Answer |
|----------|--------|
| Dono repos auto-connected hain? | **Nahi.** Alag GitHub accounts = alag remotes. Link automatic nahi hai. |
| Ek hi folder se dono pe push? | **Haan**, lekin **2 steps** se: pehle 822, phir lab promote. |
| Lab repo kahan se push hoti hai? | `C:\Malwa_Solar_CRM_PROD\...` se (split frontend/backend). |
| Main folder me change → PROD auto update? | **Nahi.** Tumhe `promote-to-lab` / `sync-to-lab` chalana padta hai. |
| Har baar kahan code likhun? | **Sirf** `C:\Malwa_Solar_CRM` |

### Flow diagram

```
 YOU CODE HERE
 C:\Malwa_Solar_CRM   (monorepo: frontend + backend/)
         │
         │  Step 1: .\scripts\push-dev.ps1
         ▼
 GitHub 822  →  Sheddy-Smith/Solar_crm_frontend
         │
         │  Render / Vercel auto-deploy (testing)
         ▼
    TEST OK?
         │
         │  Step 2: .\scripts\promote-to-lab.ps1
         │     (copies files → PROD folders → push lab)
         ▼
 C:\Malwa_Solar_CRM_PROD\
   ├─ malwa-crm-frontend  →  sheddysmithlab-dot/solar_crm_frontend
   └─ malwa-crm-backend   →  sheddysmithlab-dot/solar_crm_backend
         │
         ▼
 Client production (poer.in / Hostinger VPS)
```

---

## 2. Two GitHub identities

| Role | Email / account | GitHub user | Purpose |
|------|-----------------|-------------|---------|
| **DEV / testing** | sheddysmith822@gmail.com | **Sheddy-Smith** | Render (and related) testing only |
| **PROD / client** | sheddysmithlab@gmail.com | **sheddysmithlab-dot** | Final client deploy (`poer.in`) |

### Repos

| Account | Repo | What it holds |
|---------|------|----------------|
| 822 | `Sheddy-Smith/Solar_crm_frontend` | **Monorepo** (frontend + `backend/` folder together) |
| lab | `sheddysmithlab-dot/solar_crm_frontend` | Frontend only (for prod) |
| lab | `sheddysmithlab-dot/solar_crm_backend` | Backend only (for prod) |

### SSH keys (already on your PC)

| Host alias | Key file | Used for |
|------------|----------|----------|
| `github.com-822` | `~/.ssh/id_ed25519_822` | Dev GitHub |
| `github.com-lab` | `~/.ssh/id_ed25519_lab` | Lab GitHub + Hostinger VPS |

Test:

```powershell
ssh -T git@github.com-822
ssh -T git@github.com-lab
```

---

## 3. Local folders — what each is

### A) `C:\Malwa_Solar_CRM` ← MAIN PROJECT

- Yahi **poora project** hai (starting to end).
- Git remote **origin** → 822 monorepo.
- Har feature / bugfix **yahan** likho.
- `backend\` folder isi monorepo ke andar hai.

Check remotes:

```powershell
cd C:\Malwa_Solar_CRM
git remote -v
```

Expected:

```
origin  git@github.com-822:Sheddy-Smith/Solar_crm_frontend.git
```

### B) `C:\Malwa_Solar_CRM_PROD` ← LAB MIRROR (not your coding home)

Isme **split copies** hain:

| Path | Git remote |
|------|------------|
| `...\malwa-crm-frontend` | `git@github.com-lab:sheddysmithlab-dot/solar_crm_frontend.git` |
| `...\malwa-crm-backend` | `git@github.com-lab:sheddysmithlab-dot/solar_crm_backend.git` |

Plus deploy helper scripts / docs.

**Is folder me daily coding mat karo.**  
Yeh sirf **lab push mirror** hai — main folder se copy hota hai jab tum promote chalate ho.

---

## 4. Why PROD folder exists

Lab production needs **two separate repos** (frontend + backend).  
822 testing uses **one monorepo**.

So:

1. Tum monorepo me kaam karte ho (easy).
2. Jab client/prod ready ho, script monorepo ko **tod kar** PROD folders me copy karti hai.
3. Phir PROD folders lab GitHub pe push hote hain.

Isliye:

> `Malwa_Solar_CRM` me change ≠ automatically `Malwa_Solar_CRM_PROD` me update  
> Jab tak tum sync/promote nahi chalate.

---

## 5. Everyday workflow (exact commands)

Open PowerShell:

```powershell
cd C:\Malwa_Solar_CRM
```

### Step 1 — Code + test on 822

```powershell
.\scripts\push-dev.ps1 -Message "Fix: tele follow-up edit"
```

Ye kya karta hai:

1. `C:\Malwa_Solar_CRM` me commit (agar changes hain)
2. Push → **Sheddy-Smith / 822** `origin/main`
3. Render/Vercel testing URL pe build aati hai

Wahan test karo. Confirm hone tak lab touch mat karo.

### Step 2 — After confirm → lab (client)

```powershell
.\scripts\promote-to-lab.ps1 -Message "Release: tele follow-up edit"
```

Script `YES` maangegi. Type exactly:

```text
YES
```

Ye kya karta hai:

1. Monorepo → copy into `Malwa_Solar_CRM_PROD\malwa-crm-frontend`
2. `backend\` → copy into `Malwa_Solar_CRM_PROD\malwa-crm-backend`
3. Dono me git commit
4. Push → **lab** frontend + backend repos

### Optional — sync only (no lab push)

```powershell
.\scripts\sync-to-lab.ps1 -Message "local sync only"
# or
.\scripts\promote-to-lab.ps1 -DryRun -Message "local sync only"
```

### Optional — low-level lab push

```powershell
.\scripts\sync-to-lab.ps1 -Push -Message "Release: ..."
```

---

## 6. Scripts reference

| Script | Purpose |
|--------|---------|
| `scripts\push-dev.ps1` | Main folder → 822 GitHub (testing) |
| `scripts\promote-to-lab.ps1` | Confirm ke baad → PROD copy + lab push |
| `scripts\sync-to-lab.ps1` | Actual copy engine (robocopy + commit/push) |
| `scripts\lab-repos.config.ps1` | Lab usernames + folder paths |
| `scripts\show-dual-account-setup.ps1` | SSH keys / checklist print |

Config (`lab-repos.config.ps1`):

```powershell
$LabGitHubUser = "sheddysmithlab-dot"
$LabFrontendRepo = "solar_crm_frontend"
$LabBackendRepo = "solar_crm_backend"
$MonorepoPath = "C:\Malwa_Solar_CRM"
$ProdFrontendPath = "C:\Malwa_Solar_CRM_PROD\malwa-crm-frontend"
$ProdBackendPath = "C:\Malwa_Solar_CRM_PROD\malwa-crm-backend"
```

---

## 7. What sync copies / skips

### Frontend copy (monorepo root → PROD frontend)

**Copies:** `src`, `public`, package files, docker files if present, etc.

**Skips folders:** `backend`, `node_modules`, `.git`, `dist`, `scripts`, `.cursor`, ...

**Skips files:** `.env`, `.env.local`, secret docs like `DEPLOYMENT_POER_IN_FULL.md`

### Backend copy (`backend\` → PROD backend)

**Copies:** Django apps, settings, requirements, etc.

**Skips:** `.venv`, `__pycache__`, `.env`, `media`, `db.sqlite3`, ...

> Note: PROD me pehle se jo Docker files hain aur monorepo me nahi hain, robocopy unko delete nahi karta (mirror mode nahi). Woh PROD me rehte hain.

---

## 8. After lab push — update live poer.in (VPS)

GitHub lab push **apne aap** Hostinger VPS update nahi karta (abhi auto CI nahi laga).  
Lab push ke baad VPS pe alag se deploy chahiye.

### Frontend on VPS (Docker)

```bash
# SSH
ssh -i ~/.ssh/id_ed25519_lab root@200.97.171.119

cd /docker/malwa-frontend
# pull/copy latest frontend code into this folder, then:
docker compose build --build-arg VITE_API_URL=https://api.poer.in/api/v1
docker compose up -d
```

### Backend on VPS (gunicorn)

```bash
# update files under /var/www/malwa-crm/backend
sudo -u malwa bash -lc 'cd /var/www/malwa-crm/backend && . .venv/bin/activate && pip install -r requirements.txt && export DJANGO_SETTINGS_MODULE=malwa_solar.settings.production && python manage.py migrate && python manage.py collectstatic --noinput'
systemctl restart malwa-gunicorn
```

Live site details / passwords: see `DEPLOYMENT_POER_IN_FULL.md` (private — do not push publicly).

---

## 9. Common mistakes

| Mistake | Result | Fix |
|---------|--------|-----|
| Sirf `Malwa_Solar_CRM` me change, lab promote nahi | Client site / lab repo purana | `promote-to-lab.ps1` chalao |
| Direct `Malwa_Solar_CRM_PROD` me code edit | Main folder se mismatch | Hamesha main folder me edit → promote |
| Pehle lab push, bina 822 test | Client pe bug | Pehle `push-dev.ps1` + Render test |
| Galat SSH key | Permission denied | `github.com-822` vs `github.com-lab` |
| Secrets MD lab frontend me push | Leak risk | Sync already excludes deploy secret docs |

---

## 10. Manual push (if you refuse scripts)

### Dev (822) from main folder

```powershell
cd C:\Malwa_Solar_CRM
git add -A
git commit -m "message"
git push origin main
```

### Lab frontend

```powershell
cd C:\Malwa_Solar_CRM_PROD\malwa-crm-frontend
# (after sync copied files)
git add -A
git commit -m "message"
git push origin main
```

### Lab backend

```powershell
cd C:\Malwa_Solar_CRM_PROD\malwa-crm-backend
git add -A
git commit -m "message"
git push origin main
```

Scripts recommended — kam galti.

---

## 11. Checklist every release

1. [ ] Code only in `C:\Malwa_Solar_CRM`
2. [ ] `.\scripts\push-dev.ps1 -Message "..."`
3. [ ] Render/Vercel pe test OK
4. [ ] `.\scripts\promote-to-lab.ps1 -Message "..."` → type `YES`
5. [ ] Lab GitHub pe commits dikhen
6. [ ] VPS pe frontend/backend deploy (jab live update chahiye)
7. [ ] https://poer.in pe verify

---

## 12. One-line memory

> **Code in `Malwa_Solar_CRM` → push-dev (822 test) → promote-to-lab (PROD copy + lab push) → deploy VPS for poer.in**

Repos IDs ki repos **connected jaisi feel** isliye karti hain kyunki tumhari scripts bridge banati hain — GitHub khud link nahi karta.

---

*Related:* `DEPLOYMENT_POER_IN_FULL.md` (VPS / DNS / passwords — keep private)
