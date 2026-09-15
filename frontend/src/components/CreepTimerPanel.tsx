/**
 * CreepTimerPanel (design.md §5.3) — elapsed timer with mandatory capture
 * points at 0/5/15/30 min (R 76-1 §A.4.11.1). Amber chip at each capture
 * point: "Record reading now." Points already recorded are checked off.
 * The drift chart strip renders provisional Ec values over time.
 */
import { useEffect, useRef, useState } from 'react'
import {
  CAPTURE_POINTS_S,
  dueCapturePoint,
  formatElapsed,
  passedPoints,
} from '@/lib/creep'

export function CreepTimerPanel({
  recordedSequences,
  onCaptureDue,
}: {
  /** How many capture points already have committed rows (in order). */
  recordedSequences: number
  /** Called each tick while a capture point is in its due window. */
  onCaptureDue?: (pointMin: number) => void
}) {
  const [startAt] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const lastDueRef = useRef<number | null>(null)

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startAt) / 1000)), 500)
    return () => clearInterval(t)
  }, [startAt])

  const due = dueCapturePoint(elapsed)
  const done = passedPoints(elapsed)

  // Fire "record now" once per due window (not every 500 ms).
  useEffect(() => {
    if (due !== null && due !== lastDueRef.current) {
      lastDueRef.current = due
      onCaptureDue?.(due / 60)
    }
    if (due === null) lastDueRef.current = null
  }, [due, onCaptureDue])

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-raised p-4">
      <div className="numeric text-3xl font-bold tabular-nums" aria-live="off">
        {formatElapsed(elapsed)}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-inkmuted">
          Mandatory capture points (§A.4.11.1)
        </span>
        <div className="flex gap-2">
          {CAPTURE_POINTS_S.map((s) => {
            const min = s / 60
            const recorded = done.indexOf(s) < recordedSequences
            const isDue = due === s
            return (
              <span
                key={s}
                className={`inline-flex h-8 items-center rounded px-2 text-xs font-semibold ${
                  recorded
                    ? 'bg-pass/10 text-pass'
                    : isDue
                      ? 'animate-pulse bg-warn/15 text-warn'
                      : 'bg-slate-100 text-inkmuted'
                }`}
              >
                {recorded ? '✓' : isDue ? '●' : '○'} {min} min
              </span>
            )
          })}
        </div>
      </div>
      <div className="ml-auto text-xs text-inkmuted">
        Early termination: drift &lt; 0.5e over 30 min AND &lt; 0.2e from 15→30 min;
        otherwise run the full 4 h.
      </div>
    </div>
  )
}
