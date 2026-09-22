// Backend API client — endpoint paths and payload field names here are
// matched against the confirmed backend contract (ObservationDto,
// InstrumentDto, SessionDto and the router behaviour described in the
// project's own architecture/reverse-engineering notes), not guessed.
// All metrology values travel as decimal STRINGS, never JS numbers —
// the backend's Pydantic ingress rejects floats outright.
const BASE = import.meta.env.VITE_API_URL || '/api/v1';
const ACCESS_KEY = 'nawi-access-token';
const REFRESH_KEY = 'nawi-refresh-token';
const jsonHeaders = { 'Content-Type': 'application/json' };

async function request(path, options = {}, retry = true) {
  const headers = { ...(options.body instanceof FormData ? {} : jsonHeaders), ...(options.headers || {}) };
  const token = localStorage.getItem(ACCESS_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  let res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401 && retry && localStorage.getItem(REFRESH_KEY)) {
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
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const d = await res.json();
      msg = d.detail || msg;
    } catch {
      // no JSON body on this error — keep the generic message
    }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export function setTokens(d) {
  localStorage.setItem(ACCESS_KEY, d.access_token);
  localStorage.setItem(REFRESH_KEY, d.refresh_token);
  localStorage.setItem('nawi-authenticated', '1');
  localStorage.setItem('nawi-user', JSON.stringify(d.user || { role: d.role, full_name: d.full_name }));
}

export function clearTokens() {
  [ACCESS_KEY, REFRESH_KEY, 'nawi-authenticated', 'nawi-user'].forEach((k) => localStorage.removeItem(k));
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/users/me'),

  // Instruments — field names match InstrumentDto exactly (manufacturer,
  // model, serial_number, accuracy_class, max_capacity, min_capacity,
  // verification_scale_interval, display_interval, base_unit).
  instruments: (q = '') => request(`/instruments?limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  createInstrument: (x) => request('/instruments', { method: 'POST', body: JSON.stringify(x) }),

  // Sessions — environment is recorded by PATCHing the session itself
  // (start_temp_c / end_temp_c / humidity_pct / pressure_hpa), there is no
  // separate "/environment" endpoint.
  sessions: () => request('/sessions?limit=50'),
  session: (id) => request(`/sessions/${id}`),
  createSession: (x) => request('/sessions', { method: 'POST', body: JSON.stringify(x) }),
  patchSession: (id, x) => request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(x) }),
  drift: (id) => request(`/sessions/${id}/drift`),

  // Observations — field names match ObservationDto (test_type, position,
  // applied_load, indication, additional_load, zero_error, source).
  // sequence_no / revision_no / error_prior / corrected_error / mpe_limit /
  // verdict are computed and returned by the server, never sent by us.
  observations: (id) => request(`/sessions/${id}/observations`),
  addObservation: (id, x) => request(`/sessions/${id}/observations`, { method: 'POST', body: JSON.stringify(x) }),
  syncBatch: (id, items) =>
    request(`/sessions/${id}/observations:batch`, { method: 'POST', body: JSON.stringify({ items }) }),

  finalize: (id) => request(`/sessions/${id}/finalize`, { method: 'POST' }),

  // Reports
  reports: () => request('/reports'),
  report: (id) => request(`/reports/${id}`),
  downloadUrl: (id) => `${BASE}/reports/${encodeURIComponent(id)}/download`,
  downloadDocxUrl: (id) => `${BASE}/reports/${encodeURIComponent(id)}/docx`,
  verify: (id) => request(`/public/verify/${encodeURIComponent(id)}`),

  // Sign-off — the officer/admin identity and timestamp are taken from the
  // authenticated session server-side; no signer/designation is posted.
  sign: (sessionId) => request(`/reports/sessions/${sessionId}/sign`, { method: 'POST' }),

  // Attachments — one file per call, session identified by the URL, not a
  // form field.
  upload: async (sessionId, file) => {
    const f = new FormData();
    f.append('file', file);
    return request(`/sessions/${sessionId}/attachments`, { method: 'POST', body: f });
  },

  // Governance / audit
  audit: () => request('/users/audit'),
  auditVerify: () => request('/users/audit/verify'),
};

export async function downloadFile(id, kind = 'pdf') {
  const token = localStorage.getItem(ACCESS_KEY);
  const url = kind === 'docx' ? api.downloadDocxUrl(id) : api.downloadUrl(id);
  const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error(`Unable to download report (${kind})`);
  const blob = await r.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = `${id}.${kind}`;
  a.click();
  URL.revokeObjectURL(objUrl);
}

// Backwards-compatible alias used by a couple of older call sites.
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
