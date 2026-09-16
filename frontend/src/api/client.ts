/**
 * Backend API client (P3-1/P3-2). All metrology values travel as strings
 * (INV-4). The base URL is configurable via VITE_API_BASE.
 */
import { useAuthStore } from '@/stores/auth'

const BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authenticatedFetch(path, init)
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as T
}

async function authenticatedFetch(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  const token = useAuthStore.getState().accessToken
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (allowRefresh && res.status === 401 && useAuthStore.getState().refreshToken) {
    const refreshed = await useAuthStore.getState().tryRefresh(BASE)
    if (refreshed) return authenticatedFetch(path, init, false)
  }
  return res
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  role: string
  full_name: string
}

export interface InstrumentDto {
  id: string
  manufacturer: string
  model: string
  serial_number: string
  accuracy_class: string
  max_capacity: string
  min_capacity: string
  verification_scale_interval: string
  display_interval: string | null
  base_unit: string
  n_max: string
}

export interface SessionDto {
  id: string
  instrument_id: string
  status: string
  start_temp_c: string | null
  end_temp_c: string | null
  humidity_pct: string | null
  pressure_hpa: string | null
  started_at: string | null
  completed_at: string | null
}

export interface ObservationDto {
  id: string
  test_type: string
  position: string | null
  sequence_no: number
  revision_no: number
  applied_load: string
  indication: string
  additional_load: string
  zero_error: string
  error_prior: string
  corrected_error: string
  mpe_limit: string
  verdict: 'PASS' | 'FAIL'
  source: string
}

export const api = {
  login: (email: string, password: string) =>
    request<TokenPair>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ id: string; email: string; role: string; full_name: string }>('/api/v1/users/me'),

  listInstruments: (q = '') =>
    request<{ total: number; items: InstrumentDto[] }>(
      `/api/v1/instruments?limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ),

  createInstrument: (body: Record<string, unknown>) =>
    request<InstrumentDto>('/api/v1/instruments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createSession: (body: Record<string, unknown>) =>
    request<SessionDto>('/api/v1/sessions', { method: 'POST', body: JSON.stringify(body) }),

  listSessions: () =>
    request<{ total: number; items: SessionDto[] }>('/api/v1/sessions?limit=50'),

  getSession: (id: string) => request<SessionDto>(`/api/v1/sessions/${id}`),

  patchSession: (id: string, body: Record<string, unknown>) =>
    request<SessionDto>(`/api/v1/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  listObservations: (sessionId: string) =>
    request<ObservationDto[]>(`/api/v1/sessions/${sessionId}/observations`),

  /** Drift-watchdog verdict (D-14); null before end temp is recorded. */
  getDrift: (sessionId: string) =>
    request<{
      delta_c: string
      allowed_drift_in_e: string
      allowed_drift_in_unit: string
      static_range_c: number[]
      level: 'ok' | 'warn'
    } | null>(`/api/v1/sessions/${sessionId}/drift`),

  finalizeSession: (id: string) =>
    request<SessionDto>(`/api/v1/sessions/${id}/finalize`, { method: 'POST' }),

  syncBatch: (sessionId: string, items: Record<string, unknown>[]) =>
    request<{ accepted: string[]; rejected: { index: string; reason: string }[] }>(
      `/api/v1/sessions/${sessionId}/observations:batch`,
      { method: 'POST', body: JSON.stringify({ items }) },
    ),

  /** Server-side authoritative evaluation of one observation. */
  addObservation: (sessionId: string, body: Record<string, unknown>) =>
    request<{ observation: ObservationDto; evaluation: Record<string, string> }>(
      `/api/v1/sessions/${sessionId}/observations`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
}

// --- Reports (Phase 5) --------------------------------------------------

export interface ReportArchiveDto {
  id: string
  session_id: string
  sha256: string
  qr_payload: string
  signed_by: string | null
  signed_at: string | null
  template_version: string
  created_at: string
}

export interface VerifyDto {
  report_id: string
  session_id: string
  template_version: string
  content_digest: string
  file_sha256: string
  file_intact: boolean
  session_status: string
  signed: boolean
  signed_by: string | null
  signed_at: string | null
  verify_base_url: string
}

export const reportsApi = {
  list: () => request<ReportArchiveDto[]>('/api/v1/reports'),

  get: (id: string) => request<ReportArchiveDto>(`/api/v1/reports/${id}`),

  /** Authenticated blob download (JWT cannot ride a plain <a href>). */
  downloadPdf: async (id: string): Promise<void> => {
    const token = useAuthStore.getState().accessToken
    const res = await fetch(`${BASE}/api/v1/reports/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new ApiError(res.status, `download failed (${res.status})`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pattern-evaluation-report-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },

  downloadDocx: async (id: string): Promise<void> => {
    const token = useAuthStore.getState().accessToken
    const res = await fetch(`${BASE}/api/v1/reports/${id}/docx`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new ApiError(res.status, `download failed (${res.status})`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pattern-evaluation-report-${id}.docx`
    a.click()
    URL.revokeObjectURL(url)
  },
}

/** Public (unauthenticated) verification — the QR target. */
export async function publicVerify(reportId: string): Promise<VerifyDto> {
  const res = await fetch(`${BASE}/api/v1/public/verify/${reportId}`)
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as VerifyDto
}

export function signSession(sessionId: string): Promise<SessionDto> {
  return request<SessionDto>(`/api/v1/reports/sessions/${sessionId}/sign`, { method: 'POST' })
}
