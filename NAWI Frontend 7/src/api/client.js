// Backend API client — aligned with OIML R-76 FastAPI backend contracts.
// All metrology values travel as decimal STRINGS, never binary floats.
const BASE = import.meta.env.VITE_API_URL || '/api/v1';
const ACCESS_KEY = 'nawi-access-token';
const REFRESH_KEY = 'nawi-refresh-token';
const jsonHeaders = { 'Content-Type': 'application/json' };

function formatErrorMessage(status, data) {
  if (!data) return `Request failed (${status})`;
  if (typeof data === 'string') return data;
  if (data.detail) {
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      // Pydantic 422 validation errors array
      return data.detail
        .map((e) => {
          const loc = Array.isArray(e.loc) ? e.loc.filter((x) => x !== 'body').join('.') : '';
          return `${loc ? `${loc}: ` : ''}${e.msg || 'Invalid value'}`;
        })
        .join(', ');
    }
    return JSON.stringify(data.detail);
  }
  if (data.message) return data.message;
  if (data.error) return data.error;
  return `Request failed (${status})`;
}

async function request(path, options = {}, retry = true) {
  const headers = { ...(options.body instanceof FormData ? {} : jsonHeaders), ...(options.headers || {}) };
  const token = localStorage.getItem(ACCESS_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  let res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401 && retry && localStorage.getItem(REFRESH_KEY)) {
    try {
      const rr = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ refresh_token: localStorage.getItem(REFRESH_KEY) }),
      });
      if (rr.ok) {
        const d = await rr.json();
        setTokens(d);
        return request(path, options, false);
      }
    } catch {
      // refresh failed
    }
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const d = await res.json();
      msg = formatErrorMessage(res.status, d);
    } catch {
      // no JSON body on error
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export function setTokens(d) {
  if (d.access_token) localStorage.setItem(ACCESS_KEY, d.access_token);
  if (d.refresh_token) localStorage.setItem(REFRESH_KEY, d.refresh_token);
  localStorage.setItem('nawi-authenticated', '1');
  const user = d.user || { role: d.role, full_name: d.full_name };
  localStorage.setItem('nawi-user', JSON.stringify(user));
}

export function clearTokens() {
  [ACCESS_KEY, REFRESH_KEY, 'nawi-authenticated', 'nawi-user', 'nawi-session'].forEach((k) => localStorage.removeItem(k));
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  refresh: (refreshToken) => request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) }),
  me: () => request('/users/me'),
  ruleset: () => request('/ruleset'),

  // Instruments — returns { total, skip, limit, items }
  instruments: async (q = '', skip = 0, limit = 50) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (skip > 0) params.set('skip', String(skip));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    const res = await request(`/instruments${qs ? `?${qs}` : ''}`);
    return {
      total: res?.total ?? (Array.isArray(res) ? res.length : 0),
      skip: res?.skip ?? 0,
      limit: res?.limit ?? 50,
      items: Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [],
    };
  },
  instrument: (id) => request(`/instruments/${id}`),
  createInstrument: (x) => request('/instruments', { method: 'POST', body: JSON.stringify(x) }),

  // Sessions — returns { total, skip, limit, items }
  sessions: async (skip = 0, limit = 50) => {
    const params = new URLSearchParams();
    if (skip > 0) params.set('skip', String(skip));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    const res = await request(`/sessions${qs ? `?${qs}` : ''}`);
    return {
      total: res?.total ?? (Array.isArray(res) ? res.length : 0),
      skip: res?.skip ?? 0,
      limit: res?.limit ?? 50,
      items: Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [],
    };
  },
  session: (id) => request(`/sessions/${id}`),
  createSession: (x) => request('/sessions', { method: 'POST', body: JSON.stringify(x) }),
  patchSession: (id, x) => request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(x) }),
  drift: (id) => request(`/sessions/${id}/drift`),

  // Observations — sequence_no is mandatory
  observations: (id) => request(`/sessions/${id}/observations`),
  addObservation: (id, x) => request(`/sessions/${id}/observations`, { method: 'POST', body: JSON.stringify(x) }),
  syncBatch: (id, items) =>
    request(`/sessions/${id}/observations:batch`, { method: 'POST', body: JSON.stringify({ items }) }),

  // Test Plan / Applicability
  testPlan: (sessionId) => request(`/sessions/${sessionId}/test-plan`),
  updateTestPlan: (sessionId, body) =>
    request(`/sessions/${sessionId}/test-plan`, { method: 'PUT', body: JSON.stringify(body) }),

  // Checklist (Sheet 17)
  checklist: (sessionId) => request(`/sessions/${sessionId}/checklist`),
  seedChecklist: (sessionId) => request(`/sessions/${sessionId}/checklist/seed`, { method: 'POST' }),
  updateChecklistItem: (sessionId, body) =>
    request(`/sessions/${sessionId}/checklist/items`, { method: 'PUT', body: JSON.stringify(body) }),

  // Finalization
  finalize: (id) => request(`/sessions/${id}/finalize`, { method: 'POST' }),

  // Reports
  reports: async () => {
    const res = await request('/reports');
    return Array.isArray(res) ? res : (res?.items || []);
  },
  report: (id) => request(`/reports/${id}`),
  downloadUrl: (id) => `${BASE}/reports/${encodeURIComponent(id)}/download`,
  downloadDocxUrl: (id) => `${BASE}/reports/${encodeURIComponent(id)}/docx`,
  verify: (id) => request(`/public/verify/${encodeURIComponent(id)}`),

  // Sign-off (Officer approval)
  sign: (sessionId, reportId) => {
    const qs = reportId ? `?report_id=${encodeURIComponent(reportId)}` : '';
    return request(`/reports/sessions/${sessionId}/sign${qs}`, { method: 'POST' });
  },

  // Attachments
  upload: async (sessionId, file) => {
    const f = new FormData();
    f.append('file', file);
    return request(`/sessions/${sessionId}/attachments`, { method: 'POST', body: f });
  },

  // Governance / audit (Admin only)
  audit: (limit = 100) => request(`/users/audit?limit=${limit}`),
  auditVerify: () => request('/users/audit/verify'),
};

export async function downloadFile(id, kind = 'pdf') {
  const token = localStorage.getItem(ACCESS_KEY);
  const url = kind === 'docx' ? api.downloadDocxUrl(id) : api.downloadUrl(id);
  const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) {
    let msg = `Unable to download report (${kind})`;
    try {
      const d = await r.json();
      msg = d.detail || msg;
    } catch {
      // not json
    }
    throw new Error(msg);
  }
  const blob = await r.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = `pattern-evaluation-report-${id}.${kind}`;
  a.click();
  URL.revokeObjectURL(objUrl);
}

export const downloadReport = (id) => downloadFile(id, 'pdf');

export async function health() {
  const base = import.meta.env.VITE_API_URL || '/api/v1';
  try {
    const r = await fetch(`${base.replace('/api/v1', '')}/health`);
    return r.ok;
  } catch {
    return false;
  }
}

