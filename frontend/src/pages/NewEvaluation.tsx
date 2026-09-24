/**
 * S3/S4 — New Evaluation wizard (P3-4): pick or register an instrument
 * (class-validated on the server; Table-3 reasons surface inline), capture
 * environment, then open the session. Works OFFLINE: the session is queued
 * in the outbox and observations collect locally until sync.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type InstrumentDto } from '@/api/client'
import { db } from '@/db/offline'
import { useConnectivity } from '@/stores/connectivity'

function uuid(): string {
  return crypto.randomUUID()
}

export function NewEvaluationPage() {
  const [instruments, setInstruments] = useState<InstrumentDto[]>([])
  const [selected, setSelected] = useState<string>('')
  const [mode, setMode] = useState<'initial_verification' | 'in_service'>(
    'initial_verification',
  )
  const [startTemp, setStartTemp] = useState('')
  const [humidity, setHumidity] = useState('')
  const [pressure, setPressure] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const online = useConnectivity((s) => s.online)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .listInstruments()
      .then(async (p) => {
        // Refresh the offline cache on every successful load.
        await db.instruments.bulkPut(
          p.items.map((i) => ({ ...i, fetched_at: new Date().toISOString() })),
        )
        setInstruments(p.items)
      })
      .catch(async () => {
        // Offline: fall back to the cached catalog.
        const cached = await db.instruments.toArray()
        if (cached.length) setInstruments(cached)
        else setError('could not load instruments — check connectivity')
      })
  }, [])

  async function start() {
    if (!selected) return
    setBusy(true)
    setError(null)
    const clientSessionId = uuid()
    const payload = {
      instrument_id: selected,
      evaluation_mode: mode,
      start_temp_c: startTemp || null,
      humidity_pct: humidity || null,
      pressure_hpa: pressure || null,
    }
    try {
      const server = await api.createSession(payload)
      await db.sessions.put({
        id: clientSessionId,
        instrument_id: selected,
        status: 'in_progress',
        evaluation_mode: mode,
        server_id: server.id,
        start_temp_c: startTemp || undefined,
        humidity_pct: humidity || undefined,
        pressure_hpa: pressure || undefined,
        created_at: new Date().toISOString(),
      })
      navigate(`/sessions/${server.id}`)
    } catch {
      // OFFLINE PATH: queue the session; observations collect locally.
      await db.sessions.put({
        id: clientSessionId,
        instrument_id: selected,
        status: 'in_progress',
        evaluation_mode: mode,
        start_temp_c: startTemp || undefined,
        humidity_pct: humidity || undefined,
        pressure_hpa: pressure || undefined,
        created_at: new Date().toISOString(),
      })
      await db.outboxSessions.put({ id: clientSessionId, payload, state: 'pending' })
      navigate(`/sessions/${clientSessionId}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">New evaluation</h1>

      <section className="mb-6 rounded-xl bg-raised p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-inkmuted uppercase tracking-wide">
          1 · Instrument under test
        </h2>
        {instruments.length === 0 ? (
          <p className="text-sm text-inkmuted">
            No instruments registered yet. Register one via the API (POST /api/v1/instruments)
            or the admin console.
          </p>
        ) : (
          <div className="grid gap-2">
            {instruments.map((i) => (
              <label
                key={i.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${
                  selected === i.id ? 'border-accent bg-accent/5' : 'border-slate-200'
                }`}
              >
                <span>
                  <span className="font-semibold">
                    {i.manufacturer} {i.model}
                  </span>
                  <span className="ml-2 text-sm text-inkmuted">S/N {i.serial_number}</span>
                </span>
                <span className="numeric text-sm">
                  Class {i.accuracy_class} · {i.max_capacity} {i.base_unit} · e={i.verification_scale_interval}
                </span>
                <input
                  type="radio"
                  name="instrument"
                  className="accent-accent"
                  checked={selected === i.id}
                  onChange={() => setSelected(i.id)}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl bg-raised p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-inkmuted uppercase tracking-wide">
          2 · MPE regime (R 76-1 §3.5)
        </h2>
        <div className="grid gap-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
              mode === 'initial_verification' ? 'border-accent bg-accent/5' : 'border-slate-200'
            }`}
          >
            <input
              type="radio"
              name="evaluation_mode"
              className="mt-1 accent-accent"
              checked={mode === 'initial_verification'}
              onChange={() => setMode('initial_verification')}
            />
            <span>
              <span className="font-semibold">Initial verification / pattern evaluation</span>
              <span className="block text-xs text-inkmuted">
                MPE = Table 6 (±0.5e / ±1e / ±1.5e) — the regime for new-model approval (PS 26035).
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
              mode === 'in_service' ? 'border-accent bg-accent/5' : 'border-slate-200'
            }`}
          >
            <input
              type="radio"
              name="evaluation_mode"
              className="mt-1 accent-accent"
              checked={mode === 'in_service'}
              onChange={() => setMode('in_service')}
            />
            <span>
              <span className="font-semibold">In-service re-verification (§3.5.2)</span>
              <span className="block text-xs text-inkmuted">
                MPE = 2× Table 6 — only for re-verifying an instrument already in use.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="mb-6 rounded-xl bg-raised p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-inkmuted uppercase tracking-wide">
          3 · Environmental conditions (start)
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['Temp (°C)', startTemp, setStartTemp],
              ['Humidity (%)', humidity, setHumidity],
              ['Pressure (hPa)', pressure, setPressure],
            ] as const
          ).map(([label, value, setter]) => (
            <label key={label} className="block">
              <span className="mb-1 block text-xs font-medium text-inkmuted">{label}</span>
              <input
                inputMode="decimal"
                className="numeric w-full rounded border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                value={value}
                onChange={(e) => setter(e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      {error && (
        <p className="mb-4 rounded bg-warn/10 px-4 py-3 text-sm text-warn" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!selected || busy}
        onClick={() => void start()}
        className="h-11 w-full rounded bg-accent font-semibold text-white hover:bg-accent/90 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {busy ? 'Opening…' : online ? 'Open session' : 'Open session (offline — will sync)'}
      </button>
    </div>
  )
}
