/** S2 — Dashboard (design.md §8): stats row + session cards. */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type SessionDto } from '@/api/client'
import { db } from '@/db/offline'
import { useConnectivity } from '@/stores/connectivity'

export function DashboardPage() {
  const [sessions, setSessions] = useState<SessionDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [localCount, setLocalCount] = useState(0)
  const online = useConnectivity((s) => s.online)

  const refresh = useCallback(async () => {
    try {
      const page = await api.listSessions()
      setSessions(page.items)
      setError(null)
    } catch {
      // Offline: show locally-known sessions (incl. outbox-pending ones).
      const local = await db.sessions.toArray()
      const seen = new Set<string>()
      const mapped: SessionDto[] = []
      for (const s of local) {
        const id = s.server_id ?? s.id
        if (seen.has(id)) continue
        seen.add(id)
        mapped.push({
          id,
          instrument_id: s.instrument_id,
          status: s.status,
          start_temp_c: s.start_temp_c ?? null,
          end_temp_c: s.end_temp_c ?? null,
          humidity_pct: s.humidity_pct ?? null,
          pressure_hpa: s.pressure_hpa ?? null,
          started_at: s.created_at,
          completed_at: null,
        })
      }
      setSessions(mapped)
      setError('offline — showing locally saved sessions')
    }
    setLocalCount((await db.observations.where('sync_state').equals('pending').count()) || 0)
  }, [])

  useEffect(() => {
    void refresh()
    if (online) void refresh()
  }, [refresh, online])

  const inProgress = sessions.filter((s) => s.status === 'in_progress').length
  const completed = sessions.filter((s) => s.status === 'completed').length
  const approved = sessions.filter((s) => s.status === 'approved').length

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          to="/evaluations/new"
          className="inline-flex h-11 items-center rounded bg-accent px-5 font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          + New evaluation
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['In progress', inProgress],
          ['Completed', completed],
          ['Approved', approved],
          ['Pending sync rows', localCount],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl bg-raised p-4 shadow-sm">
            <div className="numeric text-3xl font-bold">{value}</div>
            <div className="mt-1 text-xs font-medium text-inkmuted uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded bg-warn/10 px-4 py-3 text-sm text-warn" role="alert">
          {error} — showing cached data only.
        </p>
      )}

      <h2 className="mb-3 text-sm font-semibold text-inkmuted uppercase tracking-wide">Sessions</h2>
      {sessions.length === 0 ? (
        <div className="rounded-xl bg-raised p-8 text-center text-inkmuted shadow-sm">
          No sessions yet. Start a new evaluation to begin testing an instrument.
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              to={`/sessions/${s.id}`}
              className="flex items-center justify-between rounded-xl bg-raised p-4 shadow-sm hover:shadow"
            >
              <div>
                <div className="font-semibold">Session {s.id.slice(0, 8)}…</div>
                <div className="text-sm text-inkmuted">
                  Status: {s.status} · started {s.started_at ? new Date(s.started_at).toLocaleString() : '—'}
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  s.status === 'approved'
                    ? 'bg-pass/10 text-pass'
                    : s.status === 'completed'
                      ? 'bg-accent/10 text-accent'
                      : 'bg-warn/10 text-warn'
                }`}
              >
                {s.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
