# Malwa Solar CRM — Deployment Detail

---

## 🔹 Short Summary (Smart Overview)

- **Frontend** (React + Vite) → **Vercel** pe deployed → `https://solar-crm-frontend-bay.vercel.app`
- **Backend** (Django REST API) → **Render** pe deployed (Free tier) → `https://solar-crm-frontend-0vcw.onrender.com`
- **Database** → **Neon** (managed PostgreSQL, free tier)
- **Cache/Queue** → **Upstash** (managed Redis, free tier, Mumbai region)
- Frontend backend ko `VITE_API_URL` env var ke through call karta hai (build-time inject hota hai Vite mein).
- Backend ke `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` env vars mein hi Vercel ka domain whitelist hona chahiye, warna login "Failed to fetch" deta hai.
- Render free tier pe **Shell access nahi milta**, isliye `createsuperuser` jaisa command Render pe nahi chal sakta — local machine se directly Neon DB se connect karke chalana padta hai.
- Render free instance inactivity pe **sleep ho jata hai**, pehli request 50+ second le sakti hai.

```
React + Vite  ──▶  Vercel  ──▶  Django REST API  ──▶  Render
                                                          │
                                                          ├── PostgreSQL → Neon
                                                          └── Redis → Upstash
```

---

## 🔹 Detailed Documentation

### 1. Project Architecture

| Layer | Tech | Hosting | URL |
|---|---|---|---|
| Frontend | React 19 + Vite + Tailwind | Vercel | `https://solar-crm-frontend-bay.vercel.app` |
| Backend API | Django + DRF + SimpleJWT | Render (Free Web Service) | `https://solar-crm-frontend-0vcw.onrender.com/api/v1/` |
| Database | PostgreSQL | Neon (project: `Malwa Solar CRM`, branch: `production`) | internal — `DATABASE_URL` env var ke through |
| Cache | Redis | Upstash (`malwa-solar-crm`, AWS Mumbai `ap-south-1`) | internal — `REDIS_URL` env var ke through |

**Note:** Render service ka naam dashboard pe `Solar_crm_frontend` dikhta hai (legacy naming, GitHub repo name se aaya), lekin **ye actually backend Django API hai**, frontend nahi. Isse confuse mat hona.

---

### 2. Repo Structure (relevant deployment files)

- `render.yaml` — Render "Blueprint" config (root dir: `backend`, build/start commands, env var keys). Render dashboard se manually create kiya gaya service hai, isliye ye file sirf **documentation/reference** ki tarah kaam karti hai — jab tak Render service mein "Sync from render.yaml" on na ho, file edit karne se live service automatically update nahi hota. Live values change karne ke liye Render dashboard ke **Environment** tab mein hi jaake edit karna padta hai.
- `RENDER_ENV.md` — sab env vars ki human-readable list (Render ke liye aur Vercel ke liye), copy-paste reference.
- `backend/Procfile` — purane Koyeb deployment ka leftover start command format; Render isse use nahi karta (Render apna `startCommand` `render.yaml` se leta hai), harmless hai.
- `backend/malwa_solar/settings/base.py` — common settings, env-driven (`DATABASE_URL`, `REDIS_URL`, `CORS_ALLOWED_ORIGINS`, `ALLOWED_HOSTS`).
- `backend/malwa_solar/settings/production.py` — production-only hardening (`SECURE_SSL_REDIRECT`, `CSRF_TRUSTED_ORIGINS`, JSON-only API renderer, Whitenoise static storage).
- `vercel.json` — Vercel build config (`buildCommand`, `outputDirectory`, SPA rewrites). `VITE_API_URL` yahan set nahi hota — wo Vercel dashboard ke Environment Variables mein manually set karna padta hai (build-time var hai).

---

### 3. Backend (Render) — Build & Start

**Root directory:** `backend`

```bash
# Build command
pip install -r requirements.txt && python manage.py collectstatic --noinput

# Start command
python manage.py migrate --noinput && gunicorn malwa_solar.wsgi:application --bind 0.0.0.0:$PORT --workers 2
```

⚠️ Migrate command start command mein hona zaroori hai — sirf `gunicorn ...` likhne se migrations nahi chalti, aur login par 500 aata hai.

**Render Environment Variables (live):**

| KEY | Purpose |
|---|---|
| `DJANGO_SETTINGS_MODULE` | `malwa_solar.settings.production` |
| `PYTHON_VERSION` | `3.12.8` |
| `DEBUG` | `False` |
| `SECRET_KEY` | Render-generated, random |
| `ALLOWED_HOSTS` | `solar-crm-frontend-0vcw.onrender.com,.onrender.com` |
| `DATABASE_URL` | Neon Postgres pooler connection string (`sslmode=require&channel_binding=require`) |
| `REDIS_URL` | Upstash Redis (`rediss://...`, TLS) |
| `CORS_ALLOWED_ORIGINS` | Vercel production domain + Vercel preview domain + localhost (dev) |
| `CSRF_TRUSTED_ORIGINS` | Render domain + Vercel production + Vercel preview domain |

---

### 4. Frontend (Vercel) — Build

**Environment Variable (Vercel dashboard, Production scope):**

```
VITE_API_URL = https://solar-crm-frontend-0vcw.onrender.com/api/v1
```

- Yeh **build-time** variable hai (Vite env vars JS bundle mein bake ho jaate hain). Isliye value change karne ke baad **Redeploy** zaroori hai — sirf env var save karne se purana build update nahi hota.
- Code mein fallback: agar `VITE_API_URL` missing ho to production build `http://localhost:8000/api/v1` pe fallback karta hai (`src/api.js:3`), jo browser se kabhi reachable nahi hota — isi se "Failed to fetch" error aata hai agar env var galti se miss ho jaye.

---

### 5. Issues Jo Mile Aur Kaise Fix Hue

#### Issue 1 — Production API par GET request 500 deta tha
- **Karan:** DRF ka browsable HTML renderer production mein static CSS dhoondta hai, jo `ManifestStaticFilesStorage` ke saath nahi milta → 500.
- **Fix** (commit `8008421`):
  - `DEFAULT_RENDERER_CLASSES` ko sirf `JSONRenderer` tak limit kiya (production settings).
  - `STATICFILES_STORAGE` ko `CompressedManifestStaticFilesStorage` se `CompressedStaticFilesStorage` mein badla — strict manifest lookup hata diya.

#### Issue 2 — Login par "Failed to fetch"
- **Karan:** Vercel ka deployment URL ek **preview/per-deploy hash URL** tha (`solar-crm-frontend-1gv4z1tdr-sheddy-smiths-projects.vercel.app`), jo Render ke `CORS_ALLOWED_ORIGINS` mein whitelist nahi tha → browser ka CORS preflight (`OPTIONS`) reject ho gaya → fetch fail.
- **Fix:** `CORS_ALLOWED_ORIGINS` aur `CSRF_TRUSTED_ORIGINS` (Render Environment tab + `render.yaml`/`RENDER_ENV.md` docs) mein preview URL bhi add kiya.
- **Long-term advice:** testing hamesha stable production URL (`solar-crm-frontend-bay.vercel.app`) pe karo, preview hash URL har deploy pe badalta hai.

#### Issue 3 — Login par "No active account found with the given credentials"
- **Karan:** Production (Neon) database khali tha — koi superuser nahi tha. Render free tier pe **Shell access disabled** hai (paid feature), isliye `python manage.py createsuperuser` Render pe directly chalana possible nahi tha.
- **Fix:** Local machine se `DATABASE_URL` env var ko temporarily Neon ke production connection string se override karke, `createsuperuser --noinput` (with `DJANGO_SUPERUSER_EMAIL` / `DJANGO_SUPERUSER_PASSWORD` / `DJANGO_SUPERUSER_NAME` env vars) directly production DB mein chalaya — custom `User` model hai jiska `USERNAME_FIELD = 'email'` aur `REQUIRED_FIELDS = ['name']` hai (`backend/apps/accounts/models.py`).

---

### 6. Free-Tier Limitations (yaad rakhne wali baatein)

- **Render Free Web Service:**
  - Inactivity pe spin down ho jata hai — pehli request 50+ second le sakti hai.
  - **Shell access nahi milta** (upgrade required) — koi bhi one-off management command local se Neon DB ko directly target karke chalana padta hai.
  - **One-Off Jobs** feature bhi paid hai.
- **Vercel:** har push/PR pe naya preview deployment URL banta hai — agar testing usi URL pe ho rahi hai to backend ke CORS list mein bhi wahi add karna padega (temporary), warna production stable URL use karo.
- **Neon / Upstash free tier:** connection limits aur storage caps hain (abhi Cost dikha raha `$0.00`, usage minimal hai) — scale badhne par upgrade dekhna hoga.

---

### 7. Quick Reference Commands

**Local se production DB mein superuser banane ke liye** (PowerShell, backend folder se):

```powershell
$env:DATABASE_URL = "<Render Environment tab se DATABASE_URL copy karo>"
$env:DJANGO_SUPERUSER_EMAIL = "admin@malwasolar.com"
$env:DJANGO_SUPERUSER_PASSWORD = "<password>"
$env:DJANGO_SUPERUSER_NAME = "Admin"
python manage.py createsuperuser --noinput
```

**SECRET_KEY generate karne ke liye:**

```powershell
cd C:\Malwa_Solar_CRM\backend
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**Deploy verify karne ke liye:**

1. `https://solar-crm-frontend-0vcw.onrender.com/api/v1/` open karo → JSON `{"detail":"..."}` (401) aana chahiye, HTML 500 nahi.
2. Render → Events tab → latest deploy `live` status check karo.
3. Frontend pe login try karo (stable Vercel URL se).

---

### 8. Security Note

- `RENDER_ENV.md` aur Render dashboard screenshots mein actual DB/Redis passwords expose ho sakte hain agar share kiye jaayen — kaam complete hone ke baad Neon aur Upstash dashboard se password **rotate/reset** karna best practice hai, especially agar koi screenshot kahin save/share hua ho.
- `.env` file (local) **kabhi commit nahi karni** — already `.gitignore` mein honi chahiye, verify kar lo.
