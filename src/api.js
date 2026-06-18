const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

const TOKEN_KEY = 'malwa_access';
const REFRESH_KEY = 'malwa_refresh';

export const tokenStore = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access, refresh) => {
    if (access) localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = tokenStore.getAccess();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const doFetch = (hdrs) =>
    fetch(`${API_BASE}${path}`, {
      method,
      headers: hdrs,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch(headers);

  if (res.status === 401 && auth) {
    const refreshToken = tokenStore.getRefresh();
    if (refreshToken) {
      const rRes = await fetch(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (rRes.ok) {
        const { access } = await rRes.json();
        tokenStore.set(access, null);
        headers['Authorization'] = `Bearer ${access}`;
        res = await doFetch(headers);
      } else {
        tokenStore.clear();
        window.dispatchEvent(new Event('auth:logout'));
        return null;
      }
    } else {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:logout'));
      return null;
    }
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.detail || data.message || Object.values(data).flat().join(' ') || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email, password) => {
    const data = await request('/auth/login/', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    if (data?.access) tokenStore.set(data.access, data.refresh);
    return data;
  },
  me: () => request('/users/me/'),
  logout: () => tokenStore.clear(),
};

// ─── Leads ───────────────────────────────────────────────────────────────────

export const leadApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/leads/${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('/leads/', { method: 'POST', body: data }),
  get: (id) => request(`/leads/${id}/`),
  update: (id, data) => request(`/leads/${id}/`, { method: 'PATCH', body: data }),
  updateStatus: (id, status) =>
    request(`/leads/${id}/update_status/`, { method: 'POST', body: { status } }),
  assign: (id, userId) =>
    request(`/leads/${id}/assign/`, { method: 'POST', body: { assigned_to: userId } }),
  stats: () => request('/leads/stats/'),
  todayFollowUps: () => request('/leads/today_followups/'),
  overdue: () => request('/leads/overdue/'),
  recent: () => request('/leads/recent/'),
};

export const analyticsApi = {
  leads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/leads/analytics/${qs ? '?' + qs : ''}`);
  },
};

export const inventoryApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/inventory/items/${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('/inventory/items/', { method: 'POST', body: data }),
  summary: () => request('/inventory/items/summary/'),
  movements: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/inventory/movements/${qs ? '?' + qs : ''}`);
  },
  createMovement: (data) => request('/inventory/movements/', { method: 'POST', body: data }),
  warehouses: () => request('/inventory/warehouses/'),
};

export const accountsModuleApi = {
  chartOfAccounts: () => request('/accounts/chart-of-accounts/'),
  transactions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/accounts/transactions/${qs ? '?' + qs : ''}`);
  },
  summary: () => request('/accounts/transactions/summary/'),
};

// ─── Follow-ups ──────────────────────────────────────────────────────────────

export const followUpApi = {
  list: (leadId) => request(`/follow-ups/?lead=${leadId}`),
  create: (data) => request('/follow-ups/', { method: 'POST', body: data }),
  update: (id, data) => request(`/follow-ups/${id}/`, { method: 'PATCH', body: data }),
};

// ─── Admin Approvals ─────────────────────────────────────────────────────────

export const approvalApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin-approvals/${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('/admin-approvals/', { method: 'POST', body: data }),
  approve: (id, reason = '') =>
    request(`/admin-approvals/${id}/approve/`, { method: 'POST', body: { reason } }),
  reject: (id, reason = '') =>
    request(`/admin-approvals/${id}/reject/`, { method: 'POST', body: { reason } }),
};

// ─── Quotations ──────────────────────────────────────────────────────────────

export const quotationApi = {
  list: (leadId) => request(`/quotations/?lead=${leadId}`),
  create: (data) => request('/quotations/', { method: 'POST', body: data }),
  update: (id, data) => request(`/quotations/${id}/`, { method: 'PATCH', body: data }),
};

// ─── Projects ────────────────────────────────────────────────────────────────

export const projectApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/projects/${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('/projects/', { method: 'POST', body: data }),
  get: (id) => request(`/projects/${id}/`),
  update: (id, data) => request(`/projects/${id}/`, { method: 'PATCH', body: data }),
  updateProgress: (id, progress) =>
    request(`/projects/${id}/update_progress/`, { method: 'POST', body: { progress_percent: progress } }),
  summary: () => request('/projects/summary/'),
};

// ─── Work Orders ─────────────────────────────────────────────────────────────

export const workOrderApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/work-orders/${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('/work-orders/', { method: 'POST', body: data }),
  update: (id, data) => request(`/work-orders/${id}/`, { method: 'PATCH', body: data }),
};
