# Render — complete environment variables

Copy each KEY / VALUE into Render → Web Service → Environment.

Replace `YOUR_NEON_PASSWORD` and `YOUR_UPSTASH_PASSWORD` with real values from Neon/Upstash dashboards (Show password).

---

## Required

| KEY | VALUE |
|-----|--------|
| `DJANGO_SETTINGS_MODULE` | `malwa_solar.settings.production` |
| `PYTHON_VERSION` | `3.12.8` |
| `DEBUG` | `False` |
| `SECRET_KEY` | *(generate below — 50+ chars, unique)* |
| `ALLOWED_HOSTS` | `solar-crm-frontend-0vcw.onrender.com,.onrender.com` |
| `DATABASE_URL` | `postgresql://neondb_owner:YOUR_NEON_PASSWORD@ep-late-cloud-ah7j13zo-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| `REDIS_URL` | `rediss://default:YOUR_UPSTASH_PASSWORD@intimate-seahorse-103953.upstash.io:6379` |
| `CORS_ALLOWED_ORIGINS` | `https://solar-crm-frontend-bay.vercel.app,https://solar-crm-frontend-1gv4z1tdr-sheddy-smiths-projects.vercel.app,http://localhost:5173` |
| `CSRF_TRUSTED_ORIGINS` | `https://solar-crm-frontend-0vcw.onrender.com,https://solar-crm-frontend-bay.vercel.app,https://solar-crm-frontend-1gv4z1tdr-sheddy-smiths-projects.vercel.app` |

> ⚠️ `...1gv4z1tdr-sheddy-smiths-projects.vercel.app` jaisa hash wala URL Vercel ka **per-deployment preview URL** hai — har naye deploy pe badal jata hai. Testing ke liye hamesha stable `https://solar-crm-frontend-bay.vercel.app` use karo; preview URL sirf is waqt allow kiya gaya hai taaki current deploy turant test ho sake.

Generate `SECRET_KEY` (local terminal):

```powershell
cd C:\Malwa_Solar_CRM\backend
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## Optional (email — leave empty if not using)

| KEY | VALUE |
|-----|--------|
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_HOST_USER` | *(your email)* |
| `EMAIL_HOST_PASSWORD` | *(app password)* |
| `DEFAULT_FROM_EMAIL` | `Malwa Solar CRM <noreply@malwasolar.com>` |

Do **not** set `MEDIA_ROOT` on Render — ephemeral disk; uploads won't persist without S3.

---

## Render build & start commands

**Root directory:** `backend`

**Build command:**

```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput
```

**Start command:**

```bash
python manage.py migrate --noinput && gunicorn malwa_solar.wsgi:application --bind 0.0.0.0:$PORT --workers 2
```

> ⚠️ Render dashboard mein agar sirf `gunicorn malwa_solar.wsgi:application` hai to **migrate nahi chalti** → login par **500** aata hai. Upar wala start command use karo.

---

## Vercel (frontend)

| KEY | VALUE |
|-----|--------|
| `VITE_API_URL` | `https://solar-crm-frontend-0vcw.onrender.com/api/v1` |

After saving → **Redeploy** Vercel (env vars apply at build time).

---

## After deploy

1. Open `https://solar-crm-frontend-0vcw.onrender.com/api/v1/` → should show JSON (401), not 500.
2. Render **Shell**: `python manage.py createsuperuser`
3. Login at `https://solar-crm-frontend-bay.vercel.app`
