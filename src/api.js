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
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (auth) {
    const token = tokenStore.getAccess();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const doFetch = (hdrs) =>
    fetch(`${API_BASE}${path}`, {
      method,
      headers: hdrs,
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
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
        const refreshData = await rRes.json();
        tokenStore.set(refreshData.access, refreshData.refresh || null);
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

export const userApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/users/${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('/users/', { method: 'POST', body: data }),
  update: (id, data) => request(`/users/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/users/${id}/`, { method: 'DELETE' }),
  toggleActive: (id) => request(`/users/${id}/toggle_active/`, { method: 'POST' }),
  changePassword: (id, data) => request(`/users/${id}/change_password/`, { method: 'POST', body: data }),
};

// ─── Roles & Permissions ──────────────────────────────────────────────────────

export const roleApi = {
  list: () => request('/roles/'),
  create: (data) => request('/roles/', { method: 'POST', body: data }),
  update: (id, data) => request(`/roles/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/roles/${id}/`, { method: 'DELETE' }),
  getPermissions: (id) => request(`/roles/${id}/permissions/`),
  setPermissions: (id, permissions) => request(`/roles/${id}/permissions/`, { method: 'PUT', body: permissions }),
};

export const branchApi = {
  list: () => request('/branches/'),
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
  delete: (id) => request(`/leads/${id}/`, { method: 'DELETE' }),
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
  delete: (id) => request(`/admin-approvals/${id}/`, { method: 'DELETE' }),
};

// ─── Quotations ──────────────────────────────────────────────────────────────

export const quotationApi = {
  list: (leadId) => request(`/quotations/?lead=${leadId}`),
  listAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/quotations/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/quotations/${id}/`),
  create: (data) => request('/quotations/', { method: 'POST', body: data }),
  update: (id, data) => request(`/quotations/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/quotations/${id}/`, { method: 'DELETE' }),
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
  uploadImage: (id, file) => {
    const formData = new FormData();
    formData.append('project_image', file);
    return request(`/projects/${id}/`, { method: 'PATCH', body: formData });
  },
  updateProgress: (id, progress) =>
    request(`/projects/${id}/update_progress/`, { method: 'POST', body: { progress_percent: progress } }),
  summary: () => request('/projects/summary/'),
  getSystemConfig: (id) => request(`/projects/${id}/system_config/`),
  saveSystemConfig: (id, data) => request(`/projects/${id}/system_config/`, { method: 'PUT', body: data }),
  getSiteSurvey: (id) => request(`/projects/${id}/site_survey/`),
  saveSiteSurvey: (id, data) => request(`/projects/${id}/site_survey/`, { method: 'PUT', body: data }),
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

// ─── Project Activities ───────────────────────────────────────────────────────

export const projectActivityApi = {
  list: (projectId) => request(`/project-activities/?project=${projectId}`),
  create: (data) => request('/project-activities/', { method: 'POST', body: data }),
  update: (id, data) => request(`/project-activities/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-activities/${id}/`, { method: 'DELETE' }),
};

// ─── Project Notes ─────────────────────────────────────────────────────────────

export const projectNoteApi = {
  list: (projectId) => request(`/project-notes/?project=${projectId}`),
  create: (data) => request('/project-notes/', { method: 'POST', body: data }),
  update: (id, data) => request(`/project-notes/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-notes/${id}/`, { method: 'DELETE' }),
};

// ─── Project Documents ─────────────────────────────────────────────────────────

export const projectDocumentApi = {
  list: (projectId) => request(`/project-documents/?project=${projectId}`),
  create: (formData) => request('/project-documents/', { method: 'POST', body: formData }),
  delete: (id) => request(`/project-documents/${id}/`, { method: 'DELETE' }),
};

// ─── Project Expenses ───────────────────────────────────────────────────────────

export const projectExpenseApi = {
  list: (projectId) => request(`/project-expenses/?project=${projectId}`),
  create: (data) => request('/project-expenses/', { method: 'POST', body: data }),
  delete: (id) => request(`/project-expenses/${id}/`, { method: 'DELETE' }),
};

// ─── Project Payments ───────────────────────────────────────────────────────────

export const projectPaymentApi = {
  list: (projectId) => request(`/project-payments/?project=${projectId}`),
  create: (data) => request('/project-payments/', { method: 'POST', body: data }),
  delete: (id) => request(`/project-payments/${id}/`, { method: 'DELETE' }),
};

// ─── Project Team Members ──────────────────────────────────────────────────────

export const projectTeamApi = {
  list: (projectId) => request(`/project-team-members/?project=${projectId}`),
  create: (data) => request('/project-team-members/', { method: 'POST', body: data }),
  update: (id, data) => request(`/project-team-members/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-team-members/${id}/`, { method: 'DELETE' }),
};

// ─── Project Milestones (Timeline) ─────────────────────────────────────────────

export const projectMilestoneApi = {
  list: (projectId) => request(`/project-milestones/?project=${projectId}`),
  create: (data) => request('/project-milestones/', { method: 'POST', body: data }),
  update: (id, data) => request(`/project-milestones/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-milestones/${id}/`, { method: 'DELETE' }),
};

// ─── Project Checklist Items (Site Survey + Installation) ─────────────────────

export const projectChecklistApi = {
  list: (projectId, phase) => request(`/project-checklist-items/?project=${projectId}${phase ? `&phase=${phase}` : ''}`),
  create: (data) => request('/project-checklist-items/', { method: 'POST', body: data }),
  update: (id, data) => request(`/project-checklist-items/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-checklist-items/${id}/`, { method: 'DELETE' }),
};

// ─── Installation Materials ─────────────────────────────────────────────────────

export const installationMaterialApi = {
  list: (projectId) => request(`/installation-materials/?project=${projectId}`),
  create: (data) => request('/installation-materials/', { method: 'POST', body: data }),
  update: (id, data) => request(`/installation-materials/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/installation-materials/${id}/`, { method: 'DELETE' }),
};
