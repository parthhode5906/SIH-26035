/**
 * Environmental watchdog banner (design.md §5.4) — renders the backend's
 * drift report (D-14): green (within limits) → amber (approaching limit)
 * → red (drift exceeded / outside static range, §3.9.2 — P6-3). The red
 * state explains the metrological consequence and recommends re-running
 * the affected tests; the flag persists into the report via aggregation.
 */
export interface DriftReportDto {
  delta_c: string
  allowed_drift_in_e: string
  allowed_drift_in_unit: string
  static_range_c: number[]
  level: 'ok' | 'warn' | 'red'
}

export function WatchdogBanner({ report }: { report: DriftReportDto | null }) {
  if (!report) {
    return (
      <div className="mb-4 rounded-lg bg-slate-100 px-4 py-2 text-sm text-inkmuted">
        Drift watchdog idle — record the end-of-test temperature to evaluate ambient drift
        (§3.9.2).
      </div>
    )
  }
  const amber = report.level === 'warn'
  const red = report.level === 'red'
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-4 rounded-lg px-4 py-2 text-sm ${
        red
          ? 'bg-fail/10 text-fail'
          : amber
            ? 'bg-warn/15 text-warn'
            : 'bg-pass/10 text-pass'
      }`}
    >
      {red ? (
        <>
          <span className="font-semibold">✗ Ambient drift exceeded —</span> Δ {report.delta_c} °C
          exceeds the §3.9.2.3 allowance of {report.allowed_drift_in_e}e ({report.allowed_drift_in_unit})
          or the static temperature range {report.static_range_c[0]}–{report.static_range_c[1]} °C was
          violated. <strong>Metrological consequence:</strong> zero-dependent readings taken under
          these conditions are void — re-run the affected tests after stabilizing the room.
        </>
      ) : (
        <>
          {amber ? '⚠ ' : '✓ '}
          Ambient Δ {report.delta_c} °C · allowed zero-drift {report.allowed_drift_in_e}e ={' '}
          {report.allowed_drift_in_unit} — within §3.9.2.3 limits. Verified against the recorded
          start/end temperatures.
        </>
      )}
    </div>
  )
}
