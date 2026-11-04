"""Locust CRM flows against LOCAL staging only (default http://127.0.0.1:8050)."""
from __future__ import annotations

import os
import random

from locust import HttpUser, between, events, task

PASSWORD = os.environ.get('STAGING_PASSWORD', 'StagingLoad@123')
USER_COUNT = int(os.environ.get('STAGING_LOCUST_USERS', '80'))
_TOKEN_PATH = os.environ.get(
    'STAGING_TOKENS_FILE',
    os.path.join(os.path.dirname(__file__), 'staging_locust_results', 'minted_tokens.json'),
)
_MINTED = None


def _load_minted():
    global _MINTED
    if _MINTED is not None:
        return _MINTED
    try:
        import json
        with open(_TOKEN_PATH, encoding='utf-8') as fh:
            _MINTED = json.load(fh)
    except Exception:
        _MINTED = []
    return _MINTED


class CrmStagingUser(HttpUser):
    wait_time = between(0.2, 1.0)
    host = os.environ.get('STAGING_HOST', 'http://127.0.0.1:8050')

    def on_start(self):
        minted = _load_minted()
        self._lead_ids = []
        self._survey_ids = []
        if minted:
            row = random.choice(minted)
            self.token = row.get('access')
            self.headers = {'Authorization': f'Bearer {self.token}'} if self.token else {}
            return
        idx = random.randint(1, USER_COUNT)
        email = 'staging.admin@local.test' if idx == 1 and random.random() < 0.05 else f'staging.user{idx:03d}@local.test'
        with self.client.post(
            '/api/v1/auth/login/',
            json={'email': email, 'password': PASSWORD},
            name='auth_login',
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f'login {resp.status_code}')
                self.token = None
                return
            data = resp.json()
            self.token = data.get('access')
            resp.success()
        self.headers = {'Authorization': f'Bearer {self.token}'} if self.token else {}

    def _auth(self):
        return self.headers if getattr(self, 'token', None) else None

    @task(5)
    def health(self):
        self.client.get('/api/v1/health/', name='health')

    @task(8)
    def me(self):
        if not self._auth():
            return
        self.client.get('/api/v1/users/me/', headers=self.headers, name='users_me')

    @task(10)
    def leads_list(self):
        if not self._auth():
            return
        with self.client.get(
            '/api/v1/leads/?page=1',
            headers=self.headers,
            name='leads_list',
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(str(resp.status_code))
                return
            payload = resp.json()
            rows = payload if isinstance(payload, list) else payload.get('results') or []
            self._lead_ids = [r.get('id') for r in rows if r.get('id')][:20]
            resp.success()

    @task(6)
    def lead_detail(self):
        if not self._auth() or not self._lead_ids:
            return
        lead_id = random.choice(self._lead_ids)
        self.client.get(f'/api/v1/leads/{lead_id}/', headers=self.headers, name='lead_detail')

    @task(4)
    def lead_search(self):
        if not self._auth():
            return
        q = random.choice(['Customer', 'STG', 'Indore', '8'])
        self.client.get(f'/api/v1/leads/?search={q}', headers=self.headers, name='leads_search')

    @task(4)
    def followups(self):
        if not self._auth():
            return
        self.client.get('/api/v1/follow-ups/?page=1', headers=self.headers, name='followups_list')

    @task(5)
    def site_surveys(self):
        if not self._auth():
            return
        with self.client.get(
            '/api/v1/site-surveys/?page=1',
            headers=self.headers,
            name='site_surveys_list',
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(str(resp.status_code))
                return
            payload = resp.json()
            rows = payload if isinstance(payload, list) else payload.get('results') or []
            self._survey_ids = [r.get('id') for r in rows if r.get('id')][:20]
            resp.success()

    @task(3)
    def site_survey_detail(self):
        if not self._auth() or not self._survey_ids:
            return
        sid = random.choice(self._survey_ids)
        self.client.get(f'/api/v1/site-surveys/{sid}/', headers=self.headers, name='site_survey_detail')

    @task(3)
    def dashboard_unified(self):
        if not self._auth():
            return
        self.client.get('/api/v1/dashboard/unified/', headers=self.headers, name='dashboard_unified')

    @task(2)
    def lead_stats(self):
        if not self._auth():
            return
        self.client.get('/api/v1/leads/stats/?period=month', headers=self.headers, name='leads_stats')

    @task(3)
    def projects_list(self):
        if not self._auth():
            return
        self.client.get('/api/v1/projects/?page=1', headers=self.headers, name='projects_list')

    @task(2)
    def reports_dashboard(self):
        if not self._auth():
            return
        self.client.get('/api/v1/reports/dashboard/', headers=self.headers, name='reports_dashboard')

    @task(1)
    def ready(self):
        self.client.get('/api/v1/ready/', name='ready')

    @task(1)
    def followup_write(self):
        """Light write path — only when a lead id is known; skips on failure."""
        if not self._auth() or not self._lead_ids:
            return
        lead_id = random.choice(self._lead_ids)
        # Idempotent-ish remark patch; Locust should not spam create storms.
        self.client.patch(
            f'/api/v1/leads/{lead_id}/',
            json={'remarks': f'locust-ping-{random.randint(1, 9999)}'},
            headers=self.headers,
            name='lead_patch_remark',
        )


@events.quitting.add_listener
def _(environment, **_kwargs):
    stats = environment.stats
    total = stats.total
    print(
        f"LOCUST_SUMMARY requests={total.num_requests} fails={total.num_failures} "
        f"avg={total.avg_response_time:.0f}ms p95={total.get_response_time_percentile(0.95):.0f}ms "
        f"rps={total.total_rps:.1f}",
        flush=True,
    )
