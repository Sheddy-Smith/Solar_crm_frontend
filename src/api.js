// Dev: default `/api/v1` goes through Vite proxy → backend (works on LAN Network URL).
// Set VITE_API_URL only when you need a fixed direct backend URL (same machine only).
// Prod: VITE_API_URL is REQUIRED at build time — fail loudly instead of silently
// pointing every request at localhost.
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
if (!import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  console.error('VITE_API_URL is not set — this production build has no backend URL. Set VITE_API_URL in the build environment.');
}

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

// Media files (uploaded documents/photos) are served behind auth (BUG-047) — the
// backend accepts the JWT access token as a query param since <img>/<a> tags can't
// send an Authorization header. Wrap every media URL rendered in the UI with this.
export function getMediaUrl(url) {
  if (!url) return url;
  const token = tokenStore.getAccess();
  if (!token) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}access=${encodeURIComponent(token)}`;
}

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = tokenStore.getRefresh();
    if (!refreshToken) return null;

    const rRes = await fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!rRes.ok) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:logout'));
      return null;
    }

    const refreshData = await rRes.json();
    tokenStore.set(refreshData.access, refreshData.refresh || null);
    return refreshData.access;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request(path, { method = 'GET', body, auth = true, timeoutMs = 20000 } = {}) {
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (auth) {
    const token = tokenStore.getAccess();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const doFetch = (hdrs) =>
    fetch(`${API_BASE}${path}`, {
      method,
      headers: hdrs,
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });

  try {
    let res = await doFetch(headers);

    if (res.status === 401 && auth) {
      const newAccess = await refreshAccessToken();
      // Throw instead of returning null: callers treat null as "no data",
      // which silently hides the expired session.
      if (!newAccess) throw new Error('Session expired. Please login again.');
      headers['Authorization'] = `Bearer ${newAccess}`;
      res = await doFetch(headers);
    }

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.detail || data.message || Object.values(data).flat().join(' ') || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
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
  create: (data) => request('/branches/', { method: 'POST', body: data }),
  update: (id, data) => request(`/branches/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/branches/${id}/`, { method: 'DELETE' }),
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
  stats: (period, date) => {
    const qs = new URLSearchParams();
    if (period) qs.set('period', period);
    if (date) qs.set('date', date);
    const query = qs.toString();
    return request(`/leads/stats/${query ? '?' + query : ''}`);
  },
  todayFollowUps: () => request('/leads/today_followups/'),
  overdue: () => request('/leads/overdue/'),
  recent: () => request('/leads/recent/'),
  getSiteSurvey: (id) => request(`/leads/${id}/site_survey/`),
  saveSiteSurvey: (id, data) => request(`/leads/${id}/site_survey/`, { method: 'PUT', body: data }),
};

export const leadSurveyPhotoApi = {
  create: (formData) => request('/lead-survey-photos/', { method: 'POST', body: formData }),
  delete: (id) => request(`/lead-survey-photos/${id}/`, { method: 'DELETE' }),
};

export const analyticsApi = {
  leads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/leads/analytics/${qs ? '?' + qs : ''}`);
  },
};

const inventoryCrud = (base) => ({
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/inventory/${base}/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/inventory/${base}/${id}/`),
  create: (data) => request(`/inventory/${base}/`, { method: 'POST', body: data }),
  update: (id, data) => request(`/inventory/${base}/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/inventory/${base}/${id}/`, { method: 'DELETE' }),
});

export const inventoryApi = {
  items: {
    ...inventoryCrud('items'),
    summary: () => request('/inventory/items/summary/'),
    quickAdjust: (id, data) => request(`/inventory/items/${id}/quick-adjust/`, { method: 'POST', body: data }),
  },
  movements: {
    ...inventoryCrud('movements'),
    analytics: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
      ).toString();
      return request(`/inventory/movements/analytics/${qs ? '?' + qs : ''}`);
    },
  },
  categories: inventoryCrud('categories'),
  warehouses: inventoryCrud('warehouses'),
  summary: () => request('/inventory/items/summary/'),
};

const amcCrud = (base) => ({
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/amc/${base}/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/amc/${base}/${id}/`),
  create: (data) => request(`/amc/${base}/`, { method: 'POST', body: data }),
  update: (id, data) => request(`/amc/${base}/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/amc/${base}/${id}/`, { method: 'DELETE' }),
});

export const amcModuleApi = {
  contracts: amcCrud('contracts'),
  warranties: amcCrud('warranties'),
  serviceRequests: amcCrud('service-requests'),
  visits: amcCrud('visits'),
  renewals: amcCrud('renewals'),
  claims: amcCrud('claims'),
  documents: amcCrud('documents'),
  summary: () => request('/amc/contracts/summary/'),
};

export const dashboardApi = {
  unified: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== 'All'))
    ).toString();
    return request(`/dashboard/unified/${qs ? '?' + qs : ''}`, { timeoutMs: 120000 });
  },
};

export const reportsApi = {
  dashboard: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/reports/dashboard/${qs ? '?' + qs : ''}`);
  },
};

const accountsCrud = (base) => ({
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/accounts/${base}/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/accounts/${base}/${id}/`),
  create: (data) => request(`/accounts/${base}/`, { method: 'POST', body: data }),
  update: (id, data) => request(`/accounts/${base}/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/accounts/${base}/${id}/`, { method: 'DELETE' }),
});

export const accountsModuleApi = {
  chartOfAccounts: accountsCrud('chart-of-accounts'),
  parties: accountsCrud('parties'),
  bankAccounts: accountsCrud('bank-accounts'),
  payments: accountsCrud('payments'),
  cheques: accountsCrud('cheques'),
  transactions: accountsCrud('transactions'),
  purchaseInvoices: accountsCrud('purchase-invoices'),
  sellInvoices: accountsCrud('sell-invoices'),
  vouchers: accountsCrud('vouchers'),
  purchaseChallans: accountsCrud('purchase-challans'),
  sellChallans: accountsCrud('sell-challans'),
  gstOpening: accountsCrud('gst-opening'),
  gstLedger: (year, month) => request(`/accounts/gst-opening/ledger/?year=${year}&month=${month}`),
  saveGstOpening: (data) => request('/accounts/gst-opening/save-opening/', { method: 'POST', body: data }),
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
  delete: (id) => request(`/projects/${id}/`, { method: 'DELETE' }),
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

export const siteSurveyPhotoApi = {
  create: (formData) => request('/site-survey-photos/', { method: 'POST', body: formData }),
  delete: (id) => request(`/site-survey-photos/${id}/`, { method: 'DELETE' }),
};

export const siteSurveyApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/site-surveys/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/site-surveys/${id}/`),
  summary: () => request('/site-surveys/summary/'),
};

// ─── Work Orders ─────────────────────────────────────────────────────────────

export const workOrderApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/work-orders/${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('/work-orders/', { method: 'POST', body: data }),
  update: (id, data) => request(`/work-orders/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/work-orders/${id}/`, { method: 'DELETE' }),
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
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.project) qs.set('project', params.project);
    if (params.category) qs.set('category', params.category);
    const q = qs.toString();
    return request(`/project-documents/${q ? '?' + q : ''}`);
  },
  get: (id) => request(`/project-documents/${id}/`),
  create: (formData) => request('/project-documents/', { method: 'POST', body: formData }),
  update: (id, data) => request(`/project-documents/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-documents/${id}/`, { method: 'DELETE' }),
};

// ─── Project Expenses ───────────────────────────────────────────────────────────

export const projectExpenseApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.project) qs.set('project', params.project);
    if (params.category) qs.set('category', params.category);
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to) qs.set('date_to', params.date_to);
    const q = qs.toString();
    return request(`/project-expenses/${q ? '?' + q : ''}`);
  },
  get: (id) => request(`/project-expenses/${id}/`),
  create: (data) => request('/project-expenses/', { method: 'POST', body: data }),
  update: (id, data) => request(`/project-expenses/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-expenses/${id}/`, { method: 'DELETE' }),
  summary: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.project) qs.set('project', params.project);
    if (params.category) qs.set('category', params.category);
    if (params.status) qs.set('status', params.status);
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to) qs.set('date_to', params.date_to);
    const q = qs.toString();
    return request(`/project-expenses/summary/${q ? '?' + q : ''}`);
  },
  uploadDoc: (data) => request('/expense-docs/', { method: 'POST', body: data }),
  deleteDoc: (id) => request(`/expense-docs/${id}/`, { method: 'DELETE' }),
};

// ─── Project Approvals ──────────────────────────────────────────────────────────

export const projectApprovalApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.project) qs.set('project', params.project);
    if (params.status) qs.set('status', params.status);
    if (params.approval_type) qs.set('approval_type', params.approval_type);
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request(`/project-approvals/${q ? '?' + q : ''}`);
  },
  get: (id) => request(`/project-approvals/${id}/`),
  create: (data) => request('/project-approvals/', { method: 'POST', body: data }),
  update: (id, data) => request(`/project-approvals/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-approvals/${id}/`, { method: 'DELETE' }),
  approve: (id) => request(`/project-approvals/${id}/approve/`, { method: 'POST' }),
  reject: (id, reason = '') => request(`/project-approvals/${id}/reject/`, { method: 'POST', body: { reason } }),
  uploadDoc: (data) => request('/approval-docs/', { method: 'POST', body: data }),
  deleteDoc: (id) => request(`/approval-docs/${id}/`, { method: 'DELETE' }),
};

// ─── Project Payments ───────────────────────────────────────────────────────────

export const projectPaymentApi = {
  list: (projectId) => request(`/project-payments/?project=${projectId}`),
  create: (data) => request('/project-payments/', { method: 'POST', body: data }),
  delete: (id) => request(`/project-payments/${id}/`, { method: 'DELETE' }),
};

// ─── Project Team Members ──────────────────────────────────────────────────────

export const projectTeamApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/project-team-members/${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('/project-team-members/', { method: 'POST', body: data }),
  update: (id, data) => request(`/project-team-members/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-team-members/${id}/`, { method: 'DELETE' }),
  stats: (projectId) => request(`/project-team-members/stats/${projectId ? '?project=' + projectId : ''}`),
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

// ─── Workforce (Central Employee Management) ────────────────────────────────────

export const workforceApi = {
  dashboard: () => request('/workforce/employees/dashboard/'),
  listEmployees: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/workforce/employees/${qs ? '?' + qs : ''}`);
  },
  getEmployee: (id) => request(`/workforce/employees/${id}/`),
  createEmployee: (data) => request('/workforce/employees/', { method: 'POST', body: data }),
  updateEmployee: (id, data) => request(`/workforce/employees/${id}/`, { method: 'PATCH', body: data }),
  deleteEmployee: (id) => request(`/workforce/employees/${id}/`, { method: 'DELETE' }),
  listAssignments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/workforce/assignments/${qs ? '?' + qs : ''}`);
  },
  createAssignment: (data) => request('/workforce/assignments/', { method: 'POST', body: data }),
  updateAssignment: (id, data) => request(`/workforce/assignments/${id}/`, { method: 'PATCH', body: data }),
  deleteAssignment: (id) => request(`/workforce/assignments/${id}/`, { method: 'DELETE' }),
  uploadDocument: (data) => request('/workforce/documents/', { method: 'POST', body: data }),
  deleteDocument: (id) => request(`/workforce/documents/${id}/`, { method: 'DELETE' }),
  employeeSummary: (id) => request(`/workforce/employees/${id}/summary/`),
  employeeHistory: (id) => request(`/workforce/employees/${id}/history/`),
  attendanceLedger: (id, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/workforce/employees/${id}/attendance-ledger/${qs ? '?' + qs : ''}`);
  },
  listAttendance: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/workforce/attendance/${qs ? '?' + qs : ''}`);
  },
  updateAttendance: (id, data) => request(`/workforce/attendance/${id}/`, { method: 'PATCH', body: data }),
  markAttendancePresent: (id, data = {}) => request(`/workforce/attendance/${id}/mark-present/`, { method: 'POST', body: data }),
  markAttendanceAbsent: (id) => request(`/workforce/attendance/${id}/mark-absent/`, { method: 'POST', body: {} }),
  markAttendanceByDate: (data) => request('/workforce/attendance/mark-by-date/', { method: 'POST', body: data }),
  listVouchers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/workforce/vouchers/${qs ? '?' + qs : ''}`);
  },
  createVoucher: (data) => request('/workforce/vouchers/', { method: 'POST', body: data }),
};

// ─── Subsidy ──────────────────────────────────────────────────────────────────

export const subsidyApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/subsidy/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/subsidy/${id}/`),
  create: (data) => request('/subsidy/', { method: 'POST', body: data }),
  update: (id, data) => request(`/subsidy/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/subsidy/${id}/`, { method: 'DELETE' }),
  dashboard: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/subsidy/dashboard/${qs ? '?' + qs : ''}`);
  },
  uploadDoc: (data) => request('/subsidy-docs/', { method: 'POST', body: data }),
  deleteDoc: (id) => request(`/subsidy-docs/${id}/`, { method: 'DELETE' }),
};

// ─── Material Plans ─────────────────────────────────────────────────────────────

export const materialPlanApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/material-plans/${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('/material-plans/', { method: 'POST', body: data }),
  update: (id, data) => request(`/material-plans/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/material-plans/${id}/`, { method: 'DELETE' }),
  dashboard: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/material-plans/dashboard/${qs ? '?' + qs : ''}`);
  },
  statusOverview: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/material-plans/status-overview/${qs ? '?' + qs : ''}`);
  },
};

// ─── Liaisoning & Commissioning ─────────────────────────────────────────────────

const lcCrud = (base) => ({
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/liaison/${base}/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/liaison/${base}/${id}/`),
  create: (data) => request(`/liaison/${base}/`, { method: 'POST', body: data }),
  update: (id, data) => request(`/liaison/${base}/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/liaison/${base}/${id}/`, { method: 'DELETE' }),
});

export const lcApplicationApi = lcCrud('applications');
export const lcApprovalApi = {
  ...lcCrud('approvals'),
  approve: (id) => request(`/liaison/approvals/${id}/approve/`, { method: 'POST' }),
  reject: (id, reason = '') => request(`/liaison/approvals/${id}/reject/`, { method: 'POST', body: { reason } }),
};
export const lcInspectionApi = lcCrud('inspections');
export const lcCommissioningApi = lcCrud('commissionings');
export const lcComplianceApi = lcCrud('compliances');
export const lcDocumentApi = lcCrud('documents');

// ─── O&M (Operations & Maintenance) ─────────────────────────────────────────────

const omCrud = (base) => ({
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/om/${base}/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/om/${base}/${id}/`),
  create: (data) => request(`/om/${base}/`, { method: 'POST', body: data }),
  update: (id, data) => request(`/om/${base}/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/om/${base}/${id}/`, { method: 'DELETE' }),
});

export const omAssetApi = omCrud('assets');
export const omMaintenanceApi = omCrud('maintenance-tasks');
export const omTicketApi = omCrud('tickets');
export const omVisitApi = omCrud('site-visits');
export const omSparePartApi = omCrud('spare-parts');
export const omReportApi = omCrud('reports');
export const omDocumentApi = omCrud('documents');

// ─── CRM Settings ─────────────────────────────────────────────────────────────

const settingsCrud = (base) => ({
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/settings/${base}/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/settings/${base}/${id}/`),
  create: (data) => request(`/settings/${base}/`, { method: 'POST', body: data }),
  update: (id, data) => request(`/settings/${base}/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/settings/${base}/${id}/`, { method: 'DELETE' }),
});

export const settingsApi = {
  dashboard: () => request('/settings/dashboard/'),
  categories: () => request('/settings/categories/'),
  company: {
    get: () => request('/settings/company/'),
    update: (data) => request('/settings/company/', { method: 'PATCH', body: data }),
  },
  category: (name) => ({
    get: () => request(`/settings/category/${name}/`),
    update: (data) => request(`/settings/category/${name}/`, { method: 'PATCH', body: data }),
  }),
  system: {
    get: () => request('/settings/system/'),
    update: (data) => request('/settings/system/', { method: 'PATCH', body: data }),
  },
  payment: {
    get: () => request('/settings/payment/'),
    update: (data) => request('/settings/payment/', { method: 'PATCH', body: data }),
  },
  accountsSummary: {
    get: () => request('/settings/accounts-summary/'),
    update: (data) => request('/settings/accounts-summary/', { method: 'PATCH', body: data }),
  },
  maintenance: (action) => request('/settings/maintenance/', { method: 'POST', body: { action } }),
  backups: {
    list: () => request('/settings/backups/'),
    create: (backupType = 'Full') => request('/settings/backups/', { method: 'POST', body: { backup_type: backupType } }),
  },
  paymentModes: settingsCrud('payment-modes'),
  masters: settingsCrud('masters'),
  financialYears: {
    ...settingsCrud('financial-years'),
    setCurrent: (id) => request(`/settings/financial-years/${id}/set_current/`, { method: 'POST' }),
  },
  activityLogs: settingsCrud('activity-logs'),
  ipRules: settingsCrud('ip-rules'),
  ipBlockedAttempts: settingsCrud('ip-blocked-attempts'),
  documentSeries: settingsCrud('document-series'),
};
