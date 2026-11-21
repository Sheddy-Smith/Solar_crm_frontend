# Web Push (OS lockscreen / banner notifications)

Malwa Solar CRM uses **standard Web Push (VAPID)** on the existing PWA / Android TWA. No Capacitor rewrite.

## Server setup

1. Install dependency: `pip install pywebpush==2.0.3` (in `requirements.txt`).
2. Generate keys:

```bash
cd backend
python manage.py generate_vapid_keys
```

3. Put keys in `backend/.env` (never commit private key):

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:noreply@malwasolar.com
```

4. Migrate: `python manage.py migrate notifications`
5. Restart API + Celery worker. For due Daily Task reminders, also run Celery Beat (schedule in `CELERY_BEAT_SCHEDULE`) or cron:

```bash
python manage.py shell -c "from apps.notifications.tasks import notify_due_daily_tasks; notify_due_daily_tasks()"
```

## Client behavior

- After login, CRM requests notification permission once and stores the PushSubscription.
- Settings → Notification → **Push Alerts** (default ON) enables/disables device push.
- Service worker (`public/sw.js`) shows the OS banner and opens the deep link on tap.
- Vite **dev** unregisters the SW (HMR). Phone testing needs production build / installed PWA or TWA APK on HTTPS.

## Test push

```bash
python manage.py send_test_push --email user@example.com --via-notify
```

User must have already Allowed notifications in the installed CRM app.
