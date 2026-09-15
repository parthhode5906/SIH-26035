/**
 * Environmental watchdog banner (design.md §5.4) — renders the backend's
 * drift report (D-14): green (within limits) → amber (approaching limit).
 * The red "drift exceeded" state arrives with Phase 5's threshold work;
 * the backend currently models ok/warn only. Persisted for the report.
 */
export interface DriftReportDto {
  delta_c: string
  allowed_drift_in_e: string
  allowed_drift_in_unit: string
  static_range_c: number[]
  level: 'ok' | 'warn'
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
  return (
    <div
      role="status"
      className={`mb-4 rounded-lg px-4 py-2 text-sm ${
        amber ? 'bg-warn/15 text-warn' : 'bg-pass/10 text-pass'
      }`}
    >
      {amber ? '⚠ ' : '✓ '}
      Ambient Δ {report.delta_c} °C · allowed zero-drift {report.allowed_drift_in_e}e ={' '}
      {report.allowed_drift_in_unit} — within §3.9.2.3 limits. Verified against the recorded
      start/end temperatures.
    </div>
    )
}
