/**
 * S5 — Session workspace (P3-7 + Phase 4 modules). Per-test entry with
 * rulebook-suggested loads (§A.4.x), interactive eccentricity grid,
 * creep timer, drift watchdog banner, tab completion states and the
 * Finalize gate (design.md §4.2). Reload-safe: rows come from IndexedDB
 * when offline and from the server when online (server authoritative).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, reportsApi, signSession, type ObservationDto, type ReportArchiveDto, type SessionDto } from '@/api/client'
import { db, latestLocalObservations, type OfflineObservation } from '@/db/offline'
import { LiveValidationRow } from '@/components/LiveValidationRow'
import { EccentricityGrid, type GridRow } from '@/components/EccentricityGrid'
import { CreepTimerPanel } from '@/components/CreepTimerPanel'
import { WatchdogBanner, type DriftReportDto } from '@/components/WatchdogBanner'
import { ScaleConnectPanel } from '@/components/ScaleConnectPanel'
import { EvidenceCapture } from '@/components/EvidenceCapture'
import { useScaleConnection } from '@/hooks/useScaleConnection'
import { SyncBadge, VerdictBadge } from '@/components/VerdictBadge'
import { useConnectivity } from '@/stores/connectivity'
import { useAuthStore } from '@/stores/auth'
import { syncOutbox } from '@/lib/sync'
import { TEST_MODULES, moduleFor, moduleStatus } from '@/lib/requirements'
import type { RowShape } from '@/lib/requirements'
import type { ScaleParameters } from '@/engine/mpe'

export function SessionWorkspacePage() {
  const { sessionId = '' } = useParams()
  const [session, setSession] = useState<SessionDto | null>(null)
  const [instrument, setInstrument] = useState<{ scale: ScaleParameters; label: string } | null>(null)
  const [serverRows, setServerRows] = useState<ObservationDto[] | null>(null)
  const [localRows, setLocalRows] = useState<OfflineObservation[]>([])
  const [activeTest, setActiveTest] = useState<string>('weighing_performance')
  const [activePosition, setActivePosition] = useState<string | null>(null)
  const [endTemp, setEndTemp] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [drift, setDrift] = useState<DriftReportDto | null>(null)
  const [report, setReport] = useState<ReportArchiveDto | null>(null)
  // P6-1: scale link + last capture fill (token re-applies identical values).
  const [capture, setCapture] = useState<{ value: string; token: number } | null>(null)
  const scaleLink = useScaleConnection({
    n: 3,
    toleranceDivisions: 1,
    d: Number(instrument?.scale.display_interval ?? instrument?.scale.verification_scale_interval ?? 1),
  })
  const online = useConnectivity((s) => s.online)
  const role = useAuthStore((s) => s.role)

  const mod = moduleFor(activeTest)!

  const reload = useCallback(async () => {
    try {
      const s = await api.getSession(sessionId)
      setSession(s)
      setEndTemp(s.end_temp_c ?? '')
      // Offline-first invariant: anything seen online must survive an
      // outage. Upsert the session so offline reloads resolve instrument
      // + status from the cache.
      await db.sessions.put({
        id: s.id,
        instrument_id: s.instrument_id,
        status: (s.status === 'approved' ? 'approved' : s.status) as 'draft' | 'in_progress' | 'completed' | 'approved',
        start_temp_c: s.start_temp_c ?? undefined,
        end_temp_c: s.end_temp_c ?? undefined,
        humidity_pct: s.humidity_pct ?? undefined,
        pressure_hpa: s.pressure_hpa ?? undefined,
        created_at: s.started_at ?? new Date().toISOString(),
        server_id: s.id,
      })
      const rows = await api.listObservations(sessionId)
      setServerRows(rows)
      setLocalRows([])
    } catch {
      // Offline: load local mirror.
      setServerRows(null)
      setLocalRows(await latestLocalObservations(sessionId))
      const local = await db.sessions.get(sessionId)
      if (local?.instrument_id) {
        setSession({
          id: sessionId,
          instrument_id: local.instrument_id,
          status: local.status,
          start_temp_c: local.start_temp_c ?? null,
          end_temp_c: local.end_temp_c ?? null,
          humidity_pct: local.humidity_pct ?? null,
          pressure_hpa: local.pressure_hpa ?? null,
          started_at: local.created_at,
          completed_at: null,
        })
      } else if (!local) {
        // Session never seen online on this device: degrade gracefully.
        setNote(
          'This session was never opened on this device while online — reconnect once to cache it.',
        )
      }
    }
  }, [sessionId])

  useEffect(() => {
    void reload()
  }, [reload, online])

  // P5: fetch the session's report (post-finalize) whenever the session loads
  // or transitions.
  useEffect(() => {
    if (session?.status === 'completed' || session?.status === 'approved') {
      void loadReport()
    } else {
      setReport(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, sessionId])

  // Resolve instrument parameters for the TS mirror. Online: fetch and
  // cache in IndexedDB. Offline: read the cache — provisional verdicts
  // MUST keep working with zero connectivity.
  useEffect(() => {
    const instrumentId = session?.instrument_id
    if (!instrumentId) return
    let cancelled = false
    ;(async () => {
      try {
        const page = await api.listInstruments()
        await db.instruments.bulkPut(
          page.items.map((i) => ({ ...i, fetched_at: new Date().toISOString() })),
        )
        const found = page.items.find((i) => i.id === instrumentId)
        if (found && !cancelled) {
          setInstrument({
            label: `${found.manufacturer} ${found.model} · Class ${found.accuracy_class}`,
            scale: {
              accuracy_class: found.accuracy_class as ScaleParameters['accuracy_class'],
              max_capacity: found.max_capacity,
              min_capacity: found.min_capacity,
              verification_scale_interval: found.verification_scale_interval,
              display_interval: found.display_interval,
            },
          })
        }
      } catch {
        const cached = await db.instruments.get(instrumentId)
        if (cached && !cancelled) {
          setInstrument({
            label: `${cached.manufacturer} ${cached.model} · Class ${cached.accuracy_class} (cached)`,
            scale: {
              accuracy_class: cached.accuracy_class as ScaleParameters['accuracy_class'],
              max_capacity: cached.max_capacity,
              min_capacity: cached.min_capacity,
              verification_scale_interval: cached.verification_scale_interval,
              display_interval: cached.display_interval,
            },
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session?.instrument_id])

  // Drift watchdog (D-14): server report whenever online; neutral when
  // offline or before the end temp is recorded.
  useEffect(() => {
    if (!online || session?.status === 'unknown') return
    let cancelled = false
    api
      .getDrift(sessionId)
      .then((r) => {
        if (!cancelled) setDrift(r)
      })
      .catch(() => {
        if (!cancelled) setDrift(null)
      })
    return () => {
      cancelled = true
    }
  }, [online, sessionId, session?.end_temp_c])

  // Latest-wins rows in the minimal shape the requirements module needs.
  const allRows: RowShape[] = useMemo(
    () =>
      serverRows ??
      localRows.map((r) => ({
        test_type: r.test_type,
        position: r.position,
        sequence_no: r.sequence_no,
      })),
    [serverRows, localRows],
  )

  const scale = instrument?.scale ?? null

  const statuses = useMemo(() => {
    // moduleStatus reads only counts/positions — the neutral fallback
    // scale is safe when the instrument spec has not loaded yet.
    const fallback: ScaleParameters = {
      accuracy_class: 'III',
      max_capacity: '1',
      min_capacity: '0.01',
      verification_scale_interval: '0.001',
      display_interval: null,
    }
    return Object.fromEntries(
      TEST_MODULES.map((m) => [m.testType, moduleStatus(m, allRows, scale ?? fallback)]),
    )
  }, [allRows, scale])

  const completedCount = TEST_MODULES.filter((m) => statuses[m.testType]!.complete).length
  const allComplete = completedCount === TEST_MODULES.length
  const incompleteList = TEST_MODULES.filter((m) => !statuses[m.testType]!.complete)

  const activeStatus = statuses[activeTest]!
  const modRows = useMemo(() => allRows.filter((r) => r.test_type === activeTest), [allRows, activeTest])

  // Next sequence number for the active test type: one past the highest
  // sequence known from EITHER source (server rows when online, the local
  // mirror's synced+pending rows when offline) — so an outage can never
  // collide with a sequence the server already has.
  const nextSequenceNo = useMemo(
    () =>
      modRows.reduce(
        (acc, r) => Math.max(acc, r.sequence_no + 1),
        1,
      ),
    [modRows],
  )

  // Position handling: eccentricity (segments 1-4) and creep (capture
  // points 1-4). Default to the first missing required position.
  const missingFirst = activeStatus.missingPositions[0] ?? null
  const position = mod.requiredPositions ? (activePosition ?? missingFirst) : null

  async function commitRow(values: {
    applied_load: string
    indication: string
    additional_load: string
    zero_error: string
    provisional: { verdict: 'PASS' | 'FAIL'; corrected_error: string }
  }) {
    if (!instrument) {
      setNote('Instrument parameters unavailable — cannot stage the row offline.')
      return
    }
    const sequenceNo = nextSequenceNo
    const newPos = position
    const newId = await db.observations.add({
      session_id: sessionId,
      test_type: activeTest,
      position: newPos,
      sequence_no: sequenceNo,
      revision_no: 0,
      applied_load: values.applied_load,
      indication: values.indication,
      additional_load: values.additional_load,
      zero_error: values.zero_error,
      provisional_verdict: values.provisional.verdict,
      provisional_corrected_error: values.provisional.corrected_error,
      source: 'manual',
      created_at: new Date().toISOString(),
      sync_state: 'pending',
    })
    setNote('Row saved locally — will sync automatically.')
    if (online) {
      try {
        await api.addObservation(sessionId, {
          test_type: activeTest,
          position: newPos,
          sequence_no: sequenceNo,
          applied_load: values.applied_load,
          indication: values.indication,
          additional_load: values.additional_load,
          zero_error: values.zero_error,
        })
        await db.observations.update(newId, { sync_state: 'synced' })
      } catch {
        /* stays pending; sync engine pushes later */
      }
      await reload()
    }
    setLocalRows(await latestLocalObservations(sessionId))
    // Advance to the next required position automatically.
    if (mod.requiredPositions && newPos) {
      const remaining = (mod.positions ?? []).filter(
        (p) =>
          p !== newPos &&
          !allRows.some((r) => r.test_type === activeTest && r.position === p),
      )
      setActivePosition(remaining[0] ?? null)
    }
  }

  async function finalize() {
    if (
      !confirm(
        allComplete
          ? 'Finalize this session? Closed sessions accept no further observations.'
          : 'Some test modules are incomplete. Finalize anyway? Closed sessions accept no further observations.',
      )
    )
      return
    try {
      await api.finalizeSession(sessionId)
      setNote('Session finalized — R 76-2 report generated.')
      await reload()
      await loadReport()
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'finalize failed')
    }
  }

  async function loadReport() {
    try {
      const all = await reportsApi.list()
      setReport(all.find((r) => r.session_id === sessionId) ?? null)
    } catch {
      setReport(null)
    }
  }

  async function sign() {
    if (!confirm('Sign & approve this report as the Authorized Signatory?')) return
    try {
      await signSession(sessionId)
      setNote('Report signed — artifacts re-rendered and re-sealed.')
      await reload()
      await loadReport()
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'sign failed')
    }
  }

  async function download(kind: 'pdf' | 'docx') {
    if (!report) return
    try {
      if (kind === 'pdf') await reportsApi.downloadPdf(report.id)
      else await reportsApi.downloadDocx(report.id)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'download failed')
    }
  }

  const rows = serverRows ?? []
  const gridRows: GridRow[] = useMemo(() => {
    const src = serverRows
      ? rows.filter((r) => r.test_type === 'eccentricity')
      : localRows
          .filter((r) => r.test_type === 'eccentricity')
          .map((r) => ({ position: r.position, verdict: r.provisional_verdict }))
    return src.map((r) => ({
      position: 'position' in r ? String(r.position) : '',
      verdict: (r as { verdict: 'PASS' | 'FAIL' }).verdict,
    }))
  }, [serverRows, rows, localRows])

  const creepRecorded = (['1', '2', '3', '4'] as const).filter((p) =>
    modRows.some((r) => r.position === p),
  ).length

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Session {sessionId.slice(0, 8)}…</h1>
          <p className="text-sm text-inkmuted">{instrument?.label ?? 'Loading instrument…'} · status: {session?.status ?? 'unknown'}</p>
        </div>
        <button
          type="button"
          onClick={() => void finalize()}
          disabled={session?.status !== 'in_progress'}
          title={
            incompleteList.length === 0
              ? 'All test modules complete'
              : `Incomplete: ${incompleteList
                  .map((m) => `${m.title} (${statuses[m.testType]!.have}/${statuses[m.testType]!.need})`)
                  .join(', ')}`
          }
          className={`h-11 rounded px-5 font-semibold text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-pass/40 ${
            allComplete ? 'bg-pass hover:bg-pass/90' : 'bg-slate-400'
          }`}
        >
          Finalize
        </button>
      </div>

      <WatchdogBanner report={drift} />

      {report && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white p-3">
          <div className="flex-1">
            <p className="text-sm font-semibold">R 76-2 report generated</p>
            <p className="font-mono text-[10px] break-all text-inkmuted">
              SHA-256 {report.sha256.slice(0, 24)}…
            </p>
          </div>
          {report.signed_at ? (
            <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">✓ signed</span>
          ) : (
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">awaiting sign-off</span>
          )}
          <button
            type="button"
            onClick={() => void download('pdf')}
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => void download('docx')}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
          >
            Download DOCX
          </button>
          <Link
            to={`/verify/${report.id}`}
            className="text-xs text-[var(--accent)] underline"
          >
            verify page
          </Link>
          {!report.signed_at && role === 'approving_officer' && (
            <button
              type="button"
              onClick={() => void sign()}
              className="rounded bg-pass px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Sign as officer
            </button>
          )}
        </div>
      )}

      <div className="mb-2 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={TEST_MODULES.length}>
          <div
            className="h-full rounded bg-accent transition-all"
            style={{ width: `${(completedCount / TEST_MODULES.length) * 100}%` }}
          />
        </div>
        <span className="numeric text-xs font-semibold text-inkmuted">
          {completedCount}/{TEST_MODULES.length} test modules complete
        </span>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TEST_MODULES.map((m) => {
          const st = statuses[m.testType]!
          const isActive = activeTest === m.testType
          return (
            <button
              key={m.testType}
              type="button"
              onClick={() => {
                setActiveTest(m.testType)
                setActivePosition(null)
              }}
              className={`px-4 py-2 text-sm font-medium ${
                isActive ? 'border-b-2 border-accent text-accent' : 'text-inkmuted hover:text-ink'
              }`}
              title={`${m.clause} — ${st.have}/${st.need}${st.missingPositions.length ? `, missing positions ${st.missingPositions.join(', ')}` : ''}`}
            >
              {st.complete ? '✓ ' : st.have > 0 ? '● ' : ''}
              {m.title}
            </button>
          )
        })}
      </div>

      {mod.requiredPositions && activeTest === 'eccentricity' && (
        <div className="mb-6">
          <EccentricityGrid
            rows={gridRows}
            activePosition={position}
            onSelect={(p) => setActivePosition(p)}
          />
        </div>
      )}

      {activeTest === 'creep' && (
        <CreepTimerPanel
          recordedSequences={creepRecorded}
          onCaptureDue={(min) => {
            const idx = { 0: '1', 5: '2', 15: '3', 30: '4' }[min as 0 | 5 | 15 | 30]
            if (idx) setActivePosition(idx)
          }}
        />
      )}

      {session?.status === 'in_progress' && (
        <div className="mb-6">
          <ScaleConnectPanel
            link={scaleLink}
            dLabel={`d = ${instrument?.scale.display_interval ?? instrument?.scale.verification_scale_interval ?? 1} kg`}
            onCapture={(value) => setCapture((c) => ({ value, token: (c?.token ?? 0) + 1 }))}
          />
          {instrument && (
            <LiveValidationRow
              key={`${activeTest}-${position ?? ''}`}
              scale={instrument.scale}
              testType={mod.title}
              sequenceNo={nextSequenceNo}
              position={position ?? undefined}
              initialLoad={mod.suggestedLoads(instrument.scale)[0]}
              capture={capture ?? undefined}
              onCommit={(v) => void commitRow(v)}
            />
          )}
          <p className="mt-2 text-xs text-inkmuted">
            {mod.clause} · {mod.hint}
          </p>
        </div>
      )}

      {note && (
        <p className="mb-4 rounded bg-accent/10 px-4 py-3 text-sm text-accent" role="status">
          {note}
        </p>
      )}

      {session && (
        <div className="mb-6">
          <EvidenceCapture sessionId={sessionId} />
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-inkmuted uppercase tracking-wide">
        {mod.title} — {activeStatus.have}/{activeStatus.need}
        {activeStatus.missingPositions.length > 0 &&
          ` · missing positions ${activeStatus.missingPositions.join(', ')}`}
      </h2>
      <div className="overflow-x-auto rounded-xl bg-raised shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-inkmuted uppercase tracking-wide">
              {mod.requiredPositions && <th className="px-4 py-3">Pos</th>}
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">L</th>
              <th className="px-4 py-3">I</th>
              <th className="px-4 py-3">ΔL</th>
              <th className="px-4 py-3">E₀</th>
              <th className="px-4 py-3">Ec</th>
              <th className="px-4 py-3">MPE</th>
              <th className="px-4 py-3">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {serverRows
              ? rows
                  .filter((r) => r.test_type === activeTest)
                  .map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      {mod.requiredPositions && <td className="numeric px-4 py-2">{r.position ?? '—'}</td>}
                      <td className="numeric px-4 py-2">{r.sequence_no}</td>
                      <td className="numeric px-4 py-2">{r.applied_load}</td>
                      <td className="numeric px-4 py-2">{r.indication}</td>
                      <td className="numeric px-4 py-2">{r.additional_load}</td>
                      <td className="numeric px-4 py-2">{r.zero_error}</td>
                      <td className="numeric px-4 py-2">{r.corrected_error}</td>
                      <td className="numeric px-4 py-2">{r.mpe_limit}</td>
                      <td className="px-4 py-2">
                        <VerdictBadge state={r.verdict as 'PASS' | 'FAIL'} />
                      </td>
                    </tr>
                  ))
              : localRows
                  .filter((r) => r.test_type === activeTest)
                  .map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      {mod.requiredPositions && <td className="numeric px-4 py-2">{r.position ?? '—'}</td>}
                      <td className="numeric px-4 py-2">{r.sequence_no}</td>
                      <td className="numeric px-4 py-2">{r.applied_load}</td>
                      <td className="numeric px-4 py-2">{r.indication}</td>
                      <td className="numeric px-4 py-2">{r.additional_load}</td>
                      <td className="numeric px-4 py-2">{r.zero_error}</td>
                      <td className="numeric px-4 py-2">{r.provisional_corrected_error}</td>
                      <td className="px-4 py-2 text-xs text-inkmuted">—</td>
                      <td className="flex items-center gap-2 px-4 py-2">
                        <VerdictBadge state={r.provisional_verdict} provisional />
                        <SyncBadge syncState={r.sync_state} />
                      </td>
                    </tr>
                  ))}
            {modRows.length === 0 && (
              <tr>
                <td colSpan={mod.requiredPositions ? 10 : 9} className="px-4 py-6 text-center text-inkmuted">
                  No {mod.title.toLowerCase()} observations yet — suggested loads:{' '}
                  {scale ? mod.suggestedLoads(scale).join(', ') : '…'}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-6 rounded-xl bg-raised p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-inkmuted uppercase tracking-wide">
          Environment (end of test)
        </h2>
        <div className="flex items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-inkmuted">End temp (°C)</span>
            <input
              inputMode="decimal"
              className="numeric w-32 rounded border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              value={endTemp}
              onChange={(e) => setEndTemp(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={async () => {
              try {
                await api.patchSession(sessionId, { end_temp_c: endTemp || null })
                setNote('Environment updated — drift watchdog re-evaluated server-side.')
                await reload()
              } catch {
                setNote('Could not update environment — you may be offline. Retry once connected.')
              }
            }}
            className="h-11 rounded bg-accent px-5 font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={async () => {
              const report = await syncOutbox()
              setNote(`Manual sync: pushed ${report.pushed}, rejected ${report.rejected.length}.`)
            }}
            className="h-11 rounded border border-accent px-5 font-semibold text-accent hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            Sync now
          </button>
        </div>
      </section>
    </div>
  )
}
