/**
 * Live Validation Row — the demo showpiece (design.md §5.2).
 *
 * Never blocks typing (§7 rule 1); validates on commit (Enter); shows the
 * TS-mirror PROVISIONAL verdict instantly; the authoritative verdict
 * arrives from the backend after sync. Errors render under the field with
 * plain-language reasons (§7 rule 2).
 */
import { useEffect, useRef, useState } from 'react'
import { EngineValueError, evaluate, type EvaluationResult } from '@/engine/mpe'
import type { ScaleParameters } from '@/engine/mpe'
import { VerdictBadge } from '@/components/VerdictBadge'

export interface LiveValidationRowProps {
  scale: ScaleParameters
  testType: string
  sequenceNo: number
  position?: string
  /** Rulebook-suggested load prefilled (§A.4.x); still editable. */
  initialLoad?: string
  /** Scale capture fill (P6-1): token bumps to re-apply the same value. */
  capture?: { value: string; token: number }
  onCommit: (values: {
    applied_load: string
    indication: string
    additional_load: string
    zero_error: string
    provisional: EvaluationResult
  }) => void
}

export function LiveValidationRow({ scale, testType, sequenceNo, position, initialLoad, capture, onCommit }: LiveValidationRowProps) {
  const [load, setLoad] = useState(initialLoad ?? '')
  const [indication, setIndication] = useState('')
  const [dL, setDL] = useState('0')
  const [e0, setE0] = useState('0')
  const [provisional, setProvisional] = useState<EvaluationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const previousCaptureToken = useRef<number | null>(null)

  // Scale capture (P6-1): fill Indication from the stable reading and
  // re-run the provisional verdict with the current load.
  useEffect(() => {
    if (!capture) return
    if (previousCaptureToken.current === null) {
      previousCaptureToken.current = capture.token
      return
    }
    if (previousCaptureToken.current === capture.token) return
    previousCaptureToken.current = capture.token
    setIndication(capture.value)
    runProvisional(load, capture.value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture?.token])

  function runProvisional(l: string, i: string) {
    if (!l || !i) {
      setProvisional(null)
      setError(null)
      return
    }
    try {
      setProvisional(evaluate(scale, {
        applied_load: l,
        indication: i,
        additional_load: dL || '0',
        zero_error: e0 || '0',
      }))
      setError(null)
    } catch (err) {
      setProvisional(null)
      setError(err instanceof EngineValueError ? err.message : 'invalid input')
    }
  }

  function commit() {
    if (!provisional) return
    onCommit({
      applied_load: load,
      indication: indication,
      additional_load: dL || '0',
      zero_error: e0 || '0',
      provisional,
    })
    setLoad('')
    setIndication('')
    setDL('0')
    setE0('0')
    setProvisional(null)
    setError(null)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-raised p-4">
      <div className="mb-3 text-xs font-semibold text-inkmuted uppercase tracking-wide">
        {testType}{position ? ` · position ${position}` : ''} · row #{sequenceNo}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ['Applied load (L)', load, setLoad, 'e.g. 5'],
            ['Indication (I)', indication, setIndication, 'e.g. 5.006'],
            ['ΔL (changeover)', dL, setDL, '0'],
            ['E₀ (zero error)', e0, setE0, '0'],
          ] as const
        ).map(([label, value, setter, placeholder]) => (
          <label key={label} className="block">
            <span className="mb-1 block text-xs font-medium text-inkmuted">{label}</span>
            <input
              inputMode="decimal"
              className="numeric w-full rounded border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              value={value}
              placeholder={placeholder}
              onChange={(e) => {
                setter(e.target.value)
                // Never block typing; re-evaluate live.
                const nextL = label.startsWith('Applied') ? e.target.value : load
                const nextI = label.startsWith('Indication') ? e.target.value : indication
                runProvisional(nextL, nextI)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
              }}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="min-h-11 flex items-center">
          {provisional ? (
            <VerdictBadge state={provisional.verdict} provisional />
          ) : error ? (
            <span className="text-sm text-fail" role="alert">{error}</span>
          ) : (
            <span className="text-sm text-inkmuted">Enter L and I for a provisional verdict</span>
          )}
        </div>
        <button
          type="button"
          disabled={!provisional}
          onClick={commit}
          className="h-11 rounded bg-accent px-5 font-semibold text-white disabled:opacity-40 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          Commit row (Enter)
        </button>
      </div>
      {provisional && (
        <p className="mono mt-2 text-xs text-inkmuted">{provisional.message}</p>
      )}
    </div>
  )
}
