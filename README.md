# Malwa Solar CRM

Full-stack CRM for solar EPC operations: leads, projects, workforce, accounts, inventory, O&M, AMC, and liaisoning.

## Stack

- **Frontend:** React 19 + Vite 8 (`src/App.jsx`, `src/api.js`)
- **Backend:** Django 4.2 + Django REST Framework (`backend/`)
- **Database:** PostgreSQL (production) / SQLite (local dev)

## Quick start (local)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # edit SECRET_KEY, DATABASE_URL as needed
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API base: `http://127.0.0.1:8000/api/v1/`

### Frontend

```bash
npm install
copy .env.example .env          # optional: VITE_GOOGLE_MAPS_API_KEY
npm run dev
```

App: `http://127.0.0.1:5173/` (Vite proxies `/api/v1` to Django)

## Tests & quality

```bash
# Backend
cd backend && python manage.py test

# Frontend
npm run build
npm run lint
```

CI runs on push/PR via `.github/workflows/ci.yml`.

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `SECRET_KEY` | backend `.env` | Django secret |
| `DATABASE_URL` | backend `.env` | Postgres connection |
| `FIELD_ENCRYPTION_KEY` | backend `.env` | Fernet key for sensitive fields (Aadhaar) |
| `VITE_API_URL` | frontend `.env` | API base (required in production builds) |
| `VITE_GOOGLE_MAPS_API_KEY` | frontend `.env` | Maps on site survey |

See `backend/.env.example` and `.env.example` for the full list.

## Project layout

```
backend/apps/     Django apps (accounts, leads, projects, workforce, …)
src/              React SPA
BUGS.md           Tracked issues and fix status
```

## Deployment

See `render.yaml` for Render.com blueprint (web + static + Postgres).
