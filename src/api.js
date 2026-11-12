import { maybeSimulateNetwork, recordApiCall } from './developer/services/apiInspector.js';

// Dev: default `/api/v1` goes through Vite proxy → backend (works on LAN Network URL).
// Production builds MUST set VITE_API_URL. Staging/test must not silently hit production.
const PROD_API = 'https://api.crm.ecomalwa.com/api/v1';
const configuredApi = (import.meta.env.VITE_API_URL || '').trim();
const isProdBuild = import.meta.env.PROD || import.meta.env.MODE === 'production';
const isStagingLike = ['staging', 'test', 'preview'].includes(String(import.meta.env.MODE || '').toLowerCase());

function resolveApiBase() {
  if (import.meta.env.DEV) return configuredApi || '/api/v1';
  if (!configuredApi) {
    if (isStagingLike) {
      throw new Error('VITE_API_URL is required for staging/test builds (refusing production API fallback).');
    }
    if (isProdBuild) {
      console.error('VITE_API_URL missing in production build — refusing silent misconfiguration.');
      if (typeof window !== 'undefined') window.__MALWA_API_URL_MISCONFIGURED__ = true;
      // Keep CRM usable only for the known production host build; still flag misconfig.
      return PROD_API;
    }
    throw new Error('VITE_API_URL is required outside local development.');
  }
  if (isStagingLike && configuredApi.replace(/\/$/, '') === PROD_API.replace(/\/$/, '')) {
    throw new Error('Staging/test builds must not use the production API URL.');
  }
  return configuredApi;
}

const API_BASE = resolveApiBase();

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
function resolveMediaUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;

  let path = url.startsWith('/') ? url : `/media/${url.replace(/^\/+/, '')}`;
  if (path.startsWith('/') && !path.startsWith('/media/')) {
    path = `/media${path}`;
  }

  const apiBase = import.meta.env.VITE_API_URL || '';
  if (apiBase && /^https?:\/\//i.test(apiBase)) {
    return `${new URL(apiBase).origin}${path}`;
  }

  return path;
}

export function getMediaUrl(url) {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return resolved;
  const token = tokenStore.getAccess();
  if (!token) return resolved;
  // Drop a previous access= so nested/re-render calls don't stack tokens and
  // change the URL (browser would reload every <img> and freeze the UI).
  // Note: <img>/<a> cannot send Authorization; query JWT is still required for
  // those tags. Prefer fetchMediaBlob() for downloads to keep tokens out of URLs.
  const base = String(resolved)
    .replace(/([?&])access=[^&]*/g, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?')
    .replace(/&&+/g, '&');
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}access=${encodeURIComponent(token)}`;
}

/** Fetch media with Authorization header (no JWT in the URL). Retries once after refresh on 401. */
export async function fetchMediaBlob(url) {
  const resolved = resolveMediaUrl(url);
  if (!resolved) throw new Error('Missing media URL');

  const doFetch = (accessToken) => {
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(resolved, { headers, credentials: 'omit' });
  };

  let res = await doFetch(tokenStore.getAccess());
  if (res.status === 401) {
    const next = await refreshAccessToken();
    if (!next) throw new Error('Media fetch failed (401)');
    res = await doFetch(next);
  }
  if (!res.ok) throw new Error(`Media fetch failed (${res.status})`);
  return res.blob();
}

/**
 * Open/download media via blob URL so the JWT never appears in the address bar.
 * Pass `previewWindow` from a synchronous window.open('') in the click handler
 * to avoid popup blockers after the async fetch.
 */
export async function openMediaAuthenticated(url, { downloadName, previewWindow } = {}) {
  const win = previewWindow || (downloadName ? null : window.open('', '_blank'));
  try {
    const blob = await fetchMediaBlob(url);
    const objectUrl = URL.createObjectURL(blob);
    if (downloadName) {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Downloads finish asynchronously — revoke after a generous delay.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
      if (win && !win.closed) win.close();
      return objectUrl;
    }
    if (win && !win.closed) {
      win.location.href = objectUrl;
      win.opener = null;
    } else {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
    // Do not revoke while the preview tab may still be loading the blob.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000);
    return objectUrl;
  } catch (err) {
    if (win && !win.closed) win.close();
    throw err;
  }
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

async function request(path, { method = 'GET', body, auth = true, timeoutMs = 20000, signal } = {}) {
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (auth) {
    const token = tokenStore.getAccess();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    await maybeSimulateNetwork(path, method);
  } catch (simErr) {
    window.clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
    throw simErr;
  }

  const doFetch = (hdrs) =>
    fetch(`${API_BASE}${path}`, {
      method,
      headers: hdrs,
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });

  const finishInspect = (partial) => {
    try {
      recordApiCall({
        method,
        path,
        durationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
        requestBytes: body == null ? 0 : isFormData ? null : JSON.stringify(body).length,
        ...partial,
      });
    } catch {
      /* ignore inspector failures */
    }
  };

  try {
    let res = await doFetch(headers);

    if (res.status === 401 && auth) {
      // Never auto-retry non-idempotent methods after refresh ambiguity.
      if (!['GET', 'HEAD', 'OPTIONS'].includes((method || 'GET').toUpperCase())) {
        throw new Error('Session expired. Please login again.');
      }
      const newAccess = await refreshAccessToken();
      // Throw instead of returning null: callers treat null as "no data",
      // which silently hides the expired session.
      if (!newAccess) throw new Error('Session expired. Please login again.');
      headers['Authorization'] = `Bearer ${newAccess}`;
      res = await doFetch(headers);
    }

    if (res.status === 204) {
      finishInspect({ status: 204, ok: true, responseBytes: 0 });
      return null;
    }

    const rawText = await res.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      const msg = data.detail || data.message || Object.values(data).flat().join(' ') || `HTTP ${res.status}`;
      finishInspect({ status: res.status, ok: false, responseBytes: rawText.length, error: msg });
      throw new Error(msg);
    }

    finishInspect({ status: res.status, ok: true, responseBytes: rawText.length });
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (signal?.aborted) {
        finishInspect({ status: 0, ok: false, error: 'aborted' });
        throw error;
      }
      finishInspect({ status: 0, ok: false, error: 'timeout' });
      throw new Error('Request timed out. Please try again.');
    }
    if (!String(error?.message || '').includes('Network simulator')) {
      finishInspect({ status: 0, ok: false, error: error?.message || 'request failed' });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
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
  updatePreferences: (prefs) => request('/users/me/preferences/', { method: 'PATCH', body: prefs }),
  verifyPassword: (password) => request('/users/verify-password/', { method: 'POST', body: { password } }),
  logout: async () => {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) {
        await request('/auth/logout/', { method: 'POST', body: { refresh } });
      }
    } catch {
      /* still clear local session even if blacklist call fails */
    }
    tokenStore.clear();
    window.dispatchEvent(new Event('auth:logout'));
  },
};

export const userApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/users/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/users/${id}/`),
  /** Active users for dropdowns — available to every signed-in role. */
  options: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/users/options/${qs ? '?' + qs : ''}`);
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
  /** Global IVRS uniqueness (not limited to the caller's scoped lead list). */
  checkIvrs: (ivrs, excludeId) => {
    const qs = new URLSearchParams({ ivrs: (ivrs || '').trim() });
    if (excludeId != null && excludeId !== '') qs.set('exclude_id', String(excludeId));
    return request(`/leads/check-ivrs/?${qs.toString()}`);
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

/** Fixed BOM & Pricing Master (capacity-versioned). */
export const bomApi = {
  capacities: () => request('/bom-capacities/'),
  ensureDefaults: () => request('/bom-capacities/ensure-defaults/', { method: 'POST', body: {} }),
  versions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/bom-versions/${qs ? `?${qs}` : ''}`);
  },
  createVersion: (data) => request('/bom-versions/', { method: 'POST', body: data }),
  updateVersion: (id, data) => request(`/bom-versions/${id}/`, { method: 'PATCH', body: data }),
  activateVersion: (id) => request(`/bom-versions/${id}/activate/`, { method: 'POST', body: {} }),
  preview: (id) => request(`/bom-versions/${id}/preview/`),
  activeForCapacity: (capacityKw) => request(`/bom/active/?capacity_kw=${encodeURIComponent(capacityKw)}`),
  draftQuotation: (data) => request('/bom/draft-quotation/', { method: 'POST', body: data }),
};

export const reportsApi = {
  dashboard: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/reports/dashboard/${qs ? '?' + qs : ''}`);
  },
  exportLeads: (body = {}) => request('/reports/export-leads/', { method: 'POST', body }),
  exportLeadsXlsx: (body = {}) => request('/reports/export-leads-xlsx/', { method: 'POST', body }),
  exportStatus: (taskId) => request(`/reports/export-status/${encodeURIComponent(taskId)}/`),
  importLeads: (body = {}) => request('/reports/import-leads/', { method: 'POST', body }),
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
  categoryMaps: accountsCrud('category-maps'),
  seedCategoryMaps: () => request('/accounts/category-maps/seed-defaults/', { method: 'POST', body: {} }),
  seedRecommendedCoa: () => request('/accounts/chart-of-accounts/seed-recommended/', { method: 'POST', body: {} }),
  parties: accountsCrud('parties'),
  syncCustomersFromLeads: () => request('/accounts/parties/sync-from-leads/', { method: 'POST', body: {} }),
  customerDirectory: () => request('/accounts/parties/customer-directory/'),
  fixCustomerDuplicates: () => request('/accounts/parties/fix-duplicates/', { method: 'POST', body: {} }),
  detectCustomerDuplicates: () => request('/accounts/parties/detect-duplicates/'),
  mergeCustomersPreview: (data) => request('/accounts/parties/merge-preview/', { method: 'POST', body: data }),
  mergeCustomers: (data) => request('/accounts/parties/merge/', { method: 'POST', body: data }),
  mergeAudits: () => request('/accounts/parties/merge-audits/'),
  partyProjectAccounts: (id) => request(`/accounts/parties/${id}/project-accounts/`),
  customerProfile: (id) => request(`/accounts/parties/${id}/profile/`),
  orphanProjects: () => request('/accounts/parties/orphan-projects/'),
  linkOrphanProject: (data) => request('/accounts/parties/link-orphan-project/', { method: 'POST', body: data }),
  createCustomerForOrphan: (data) => request('/accounts/parties/create-customer-for-orphan/', { method: 'POST', body: data }),
  skipOrphanProject: (data) => request('/accounts/parties/skip-orphan-project/', { method: 'POST', body: data }),
  allocatePayment: (data) => request('/accounts/parties/allocate-payment/', { method: 'POST', body: data }),
  reassignProjectCustomer: (projectId, data) => request(`/projects/${projectId}/reassign-customer/`, { method: 'POST', body: data }),
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
  partyLedger: (id, qs = '') => request(`/accounts/parties/${id}/ledger/${qs ? '?' + qs : ''}`),
  creditLedger: () => request('/accounts/parties/credit-ledger/'),
  settleParty: (id, data) => request(`/accounts/parties/${id}/settle/`, { method: 'POST', body: data }),
  addLedgerEntry: (id, data) => request(`/accounts/parties/${id}/add-ledger-entry/`, { method: 'POST', body: data }),
  addVendorManualEntry: (id, data) => request(`/accounts/parties/${id}/add-vendor-manual-entry/`, { method: 'POST', body: data }),
  updateVendorManualEntry: (id, entryId, data) => request(`/accounts/parties/${id}/vendor-manual-entries/${entryId}/`, { method: 'PATCH', body: data }),
  deleteVendorManualEntry: (id, entryId) => request(`/accounts/parties/${id}/vendor-manual-entries/${entryId}/delete/`, { method: 'DELETE' }),
};

// ─── Follow-ups ──────────────────────────────────────────────────────────────

export const followUpApi = {
  list: (leadId) => request(`/follow-ups/?lead=${leadId}&page_size=25&ordering=-scheduled_at`),
  listAll: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/follow-ups/${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('/follow-ups/', { method: 'POST', body: data }),
  update: (id, data) => request(`/follow-ups/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/follow-ups/${id}/`, { method: 'DELETE' }),
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
  ensureInstallationTasks: (id) =>
    request(`/projects/${id}/ensure-installation-tasks/`, { method: 'POST', body: {} }),
  summary: () => request('/projects/summary/'),
  getSystemConfig: (id) => request(`/projects/${id}/system_config/`),
  saveSystemConfig: (id, data) => request(`/projects/${id}/system_config/`, { method: 'PUT', body: data }),
  getSiteSurvey: (id) => request(`/projects/${id}/site_survey/`),
  saveSiteSurvey: (id, data) => request(`/projects/${id}/site_survey/`, { method: 'PUT', body: data }),
  pnl: (id) => request(`/projects/${id}/pnl/`),
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
  list: (projectId, params = {}) => {
    const qs = new URLSearchParams({ project: projectId, page_size: params.page_size || 200, ...params });
    return request(`/project-milestones/?${qs.toString()}`);
  },
  create: (data) => request('/project-milestones/', { method: 'POST', body: data }),
  update: (id, data) => request(`/project-milestones/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-milestones/${id}/`, { method: 'DELETE' }),
};

// ─── Project Checklist Items (Site Survey + Installation) ─────────────────────

export const projectChecklistApi = {
  list: (projectId, phase, params = {}) => {
    const qs = new URLSearchParams({ project: projectId, page_size: params.page_size || 200, ...params });
    if (phase) qs.set('phase', phase);
    return request(`/project-checklist-items/?${qs.toString()}`);
  },
  create: (data) => request('/project-checklist-items/', { method: 'POST', body: data }),
  update: (id, data) => request(`/project-checklist-items/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/project-checklist-items/${id}/`, { method: 'DELETE' }),
};

// ─── Installation Materials ─────────────────────────────────────────────────────

export const installationMaterialApi = {
  list: (projectId, params = {}) => {
    const qs = new URLSearchParams({ project: projectId, page_size: params.page_size || 200, ...params });
    return request(`/installation-materials/?${qs.toString()}`);
  },
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
  markPacked: (project, packed = true, lines) => request('/material-plans/mark-packed/', {
    method: 'POST',
    body: { project, packed, ...(lines?.length ? { lines } : {}) },
  }),
};

// ─── Job Sheets ─────────────────────────────────────────────────────────────────

export const jobSheetApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/job-sheets/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/job-sheets/${id}/`),
  create: (data) => request('/job-sheets/', { method: 'POST', body: data }),
  update: (id, data) => request(`/job-sheets/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/job-sheets/${id}/`, { method: 'DELETE' }),
  generateWorkOrders: (id) => request(`/job-sheets/${id}/generate-work-orders/`, { method: 'POST', body: {} }),
};

// ─── Project Sales Challan / Invoice ────────────────────────────────────────────

const projectDocCrud = (base) => ({
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/${base}/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/${base}/${id}/`),
  create: (data) => request(`/${base}/`, { method: 'POST', body: data }),
  update: (id, data) => request(`/${base}/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/${base}/${id}/`, { method: 'DELETE' }),
});

export const projectSalesChallanApi = {
  ...projectDocCrud('project-sales-challans'),
  quotationPrefill: (projectId, quotationId) => {
    const qs = new URLSearchParams({ project: projectId, ...(quotationId ? { quotation: quotationId } : {}) });
    return request(`/project-sales-challans/quotation-prefill/?${qs}`);
  },
};
export const projectInvoiceApi = projectDocCrud('project-invoices');

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
export const lcLoanProcessApi = lcCrud('loan-processes');
export const lcInspectionPlacedApi = lcCrud('inspections-placed');
export const lcAgreementApi = lcCrud('agreements');
export const lcNetMeterApi = lcCrud('net-meters');
export const lcProjectApi = {
  list: lcCrud('projects').list,
  get: (id) => request(`/liaison/projects/${id}/`),
  advance: (id, fromStage) => request(`/liaison/projects/${id}/advance/`, { method: 'POST', body: { from_stage: fromStage } }),
  setStage: (id, stage) => request(`/liaison/projects/${id}/set-stage/`, { method: 'POST', body: { stage } }),
};

// Project Management pipeline (Site Survey → … → Invoice) for Won projects.
export const pmPipelineApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/project-pipeline/${qs ? '?' + qs : ''}`);
  },
  summary: () => request('/project-pipeline/summary/'),
  get: (id) => request(`/project-pipeline/${id}/`),
  advance: (id, fromStage) => request(`/project-pipeline/${id}/advance/`, { method: 'POST', body: { from_stage: fromStage } }),
  setStage: (id, stage) => request(`/project-pipeline/${id}/set-stage/`, { method: 'POST', body: { stage } }),
};

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

const omPost = (path, body = {}) => request(`/om/${path}`, { method: 'POST', body });

export const omAssetApi = omCrud('assets');
export const omMaintenanceApi = {
  ...omCrud('maintenance-tasks'),
  accept: (id) => omPost(`maintenance-tasks/${id}/accept/`),
  start: (id) => omPost(`maintenance-tasks/${id}/start/`),
  cancel: (id, reason = '') => omPost(`maintenance-tasks/${id}/cancel/`, { reason }),
  assignEngineer: (id, assignedEngineer, extra = {}) => omPost(`maintenance-tasks/${id}/assign-engineer/`, { assigned_engineer: assignedEngineer, ...extra }),
  myTasks: () => request('/om/maintenance-tasks/my-tasks/'),
};
export const omTicketApi = {
  ...omCrud('tickets'),
  createTask: (id, data) => omPost(`tickets/${id}/create-task/`, data),
  resolve: (id, resolution = '') => omPost(`tickets/${id}/resolve/`, { resolution }),
  close: (id, resolution = '') => omPost(`tickets/${id}/close/`, { resolution }),
};
export const omVisitApi = {
  ...omCrud('site-visits'),
  complete: (formData) => request('/om/site-visits/complete/', { method: 'POST', body: formData, timeoutMs: 120000 }),
  cancel: (id, reason = '') => omPost(`site-visits/${id}/cancel/`, { reason }),
};
export const omSparePartApi = omCrud('spare-parts');
export const omReportApi = omCrud('reports');
export const omDocumentApi = omCrud('documents');
export const omPlantApi = {
  ...omCrud('plants'),
  history: (id) => request(`/om/plants/${id}/history/`),
  refresh: (id, commissioningDate) => omPost(`plants/${id}/refresh/`, commissioningDate ? { commissioning_date: commissioningDate } : {}),
};
export const omInsuranceApi = omCrud('insurance');
export const omVisitPartApi = omCrud('visit-parts');
export const omDashboardApi = { get: () => request('/om/dashboard/') };
export const omEngineerApi = { list: () => request('/om/engineers/') };

export const notificationApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/notifications/${qs ? '?' + qs : ''}`);
  },
  unreadCount: () => request('/notifications/unread-count/'),
  markRead: (ids) => request('/notifications/mark-read/', { method: 'POST', body: { ids } }),
  markAllRead: () => request('/notifications/mark-all-read/', { method: 'POST', body: {} }),
};

// ─── O&M pending flow (work order → quotation → dispatch → install → invoice) ──

export const omPendingApi = {
  summary: () => request('/om/pending/summary/'),
  workOrders: () => request('/om/pending/work-orders/'),
  quotations: () => request('/om/pending/quotations/'),
  dispatch: () => request('/om/pending/dispatch/'),
  installation: () => request('/om/pending/installation/'),
  invoices: () => request('/om/pending/invoices/'),
  materials: () => request('/om/pending/materials/'),
  markPacked: (project, packed = true, lines) => request('/om/pending/mark-packed/', {
    method: 'POST',
    body: { project, packed, ...(lines?.length ? { lines } : {}) },
  }),
  setInstallation: (project, done = true) => request('/om/pending/installation-status/', {
    method: 'POST',
    body: { project, done },
  }),
};

// ─── Daily Tasks ──────────────────────────────────────────────────────────────

export const dailyTasksApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/daily-tasks/tasks/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/daily-tasks/tasks/${id}/`),
  create: (data) => request('/daily-tasks/tasks/', { method: 'POST', body: data }),
  update: (id, data) => request(`/daily-tasks/tasks/${id}/`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/daily-tasks/tasks/${id}/`, { method: 'DELETE' }),
  summary: () => request('/daily-tasks/tasks/summary/'),
};

export const staffDailyTasksApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return request(`/daily-tasks/assignments/${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/daily-tasks/assignments/${id}/`),
  create: (data) => request('/daily-tasks/assignments/', { method: 'POST', body: data }),
  updateStatus: (id, status) => request(`/daily-tasks/assignments/${id}/update_status/`, { method: 'PATCH', body: { status } }),
  delete: (id) => request(`/daily-tasks/assignments/${id}/`, { method: 'DELETE' }),
  assignees: () => request('/daily-tasks/assignments/assignees/'),
};

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
  organization: {
    get: () => request('/settings/organization/'),
  },
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
  auditEvents: {
    ...settingsCrud('audit-events'),
    summary: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null)),
      ).toString();
      return request(`/settings/audit-events/summary/${qs ? `?${qs}` : ''}`);
    },
    clear: () => request('/settings/audit-events/clear/', { method: 'POST', body: {} }),
  },
  bugReports: {
    ...settingsCrud('bug-reports'),
    resolve: (id) => request(`/settings/bug-reports/${id}/resolve/`, { method: 'POST', body: {} }),
    clearResolved: () => request('/settings/bug-reports/clear_resolved/', { method: 'POST', body: {} }),
  },
  whatsappMessages: {
    ...settingsCrud('whatsapp-messages'),
    stats: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null)),
      ).toString();
      return request(`/settings/whatsapp-messages/stats/${qs ? `?${qs}` : ''}`);
    },
    markProcessed: (id) => request(`/settings/whatsapp-messages/${id}/mark_processed/`, { method: 'POST', body: {} }),
  },
  developerMemory: {
    get: () => request('/settings/developer/memory/'),
    update: (data) => request('/settings/developer/memory/', { method: 'PATCH', body: data }),
  },
  attendanceMachine: {
    get: () => request('/settings/developer/attendance-machine/'),
    update: (data) => request('/settings/developer/attendance-machine/', { method: 'PATCH', body: data }),
    test: () => request('/settings/developer/attendance-machine/', { method: 'POST', body: { action: 'test' } }),
    sync: (data) => request('/settings/developer/attendance-machine/', { method: 'POST', body: { action: 'sync', ...data } }),
  },
  ipRules: settingsCrud('ip-rules'),
  ipBlockedAttempts: settingsCrud('ip-blocked-attempts'),
  documentSeries: settingsCrud('document-series'),
  recycleBin: {
    list: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null)),
      ).toString();
      return request(`/settings/recycle-bin/${qs ? `?${qs}` : ''}`);
    },
    restore: (data) => request('/settings/recycle-bin/restore/', { method: 'POST', body: data }),
    permanentDelete: (id) => request(`/settings/recycle-bin/${id}/`, { method: 'DELETE' }),
    purge: () => request('/settings/recycle-bin/purge/', { method: 'POST', body: {} }),
    empty: () => request('/settings/recycle-bin/empty/', { method: 'POST', body: {} }),
  },
};
