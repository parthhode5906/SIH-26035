/**
 * ScaleConnectPanel (P6-1) — connect / simulate / capture-into-entry UI.
 *
 * Presentational: the workspace owns the useScaleConnection hook (it needs
 * the link for capture wiring) and passes it down. Real scale over Web
 * Serial (Chrome/Edge) or a built-in simulator so the demo and offline
 * rehearsal never need hardware. Capture fills the Indication field of the
 * active LiveValidationRow — never auto-commits (§7 rule 3, human in loop).
 */
import type { ScaleLink } from '@/hooks/useScaleConnection'

const STATE_CHIP: Record<ScaleLink['state'], { text: string; cls: string }> = {
  unsupported: { text: 'SERIAL N/A', cls: 'bg-slate-200 text-inkmuted' },
  disconnected: { text: 'DISCONNECTED', cls: 'bg-slate-200 text-inkmuted' },
  connecting: { text: 'CONNECTING…', cls: 'bg-amber-100 text-amber-800' },
  live: { text: 'LIVE SCALE', cls: 'bg-pass/15 text-pass' },
  simulated: { text: 'SIMULATOR', cls: 'bg-accent/10 text-accent' },
}

export function ScaleConnectPanel({
  link,
  dLabel,
  onCapture,
}: {
  link: ScaleLink
  /** Display interval label (e.g. "d = 1 g") for the capture hint. */
  dLabel: string
  /** Called with the stable reading when the tester presses Capture. */
  onCapture: (indication: string) => void
}) {
  const chip = STATE_CHIP[link.state]

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-raised p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded px-2 py-1 text-xs font-semibold ${chip.cls}`}>{chip.text}</span>
        <span className="text-sm text-inkmuted">{link.stableText}</span>

        {link.state === 'disconnected' && (
          <button type="button" onClick={() => void link.connect()} className="h-9 rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40">
            Connect scale
          </button>
        )}
        {(link.state === 'disconnected' || link.state === 'unsupported') && (
          <>
            <button type="button" onClick={() => link.startSimulator('stable')} className="h-9 rounded border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100">
              Demo simulator
            </button>
            <button type="button" onClick={() => link.startSimulator('drifty')} className="h-9 rounded border border-slate-300 px-4 text-sm hover:bg-slate-100">
              Drifty mode
            </button>
          </>
        )}
        {(link.state === 'live' || link.state === 'simulated') && (
          <>
            <button
              type="button"
              disabled={!link.ready}
              onClick={() => link.stable.phase === 'stable' && onCapture(link.stable.weightKg.toFixed(3))}
              title={link.ready ? 'Fill the indication field with the stable reading' : 'Wait for a stable reading'}
              className="h-9 rounded bg-pass px-4 text-sm font-semibold text-white disabled:opacity-40 hover:bg-pass/90 focus:outline-none focus:ring-2 focus:ring-pass/40"
            >
              Capture into row
            </button>
            <button type="button" onClick={link.disconnect} className="h-9 rounded border border-slate-300 px-4 text-sm hover:bg-slate-100">
              Disconnect
            </button>
          </>
        )}
      </div>

      <div className="mono mt-3 flex items-baseline gap-6">
        <span className="text-3xl font-semibold tabular-nums">
          {link.frame ? link.frame.weightKg.toFixed(3) : '—'} <span className="text-sm font-normal text-inkmuted">kg</span>
        </span>
        {link.frame && <span className="text-xs text-inkmuted">{link.frame.format}</span>}
        <span className="text-xs text-inkmuted">{dLabel}</span>
      </div>
      {link.lastError && (
        <p className="mt-2 text-xs text-fail" role="alert">{link.lastError}</p>
      )}
      <p className="mt-2 text-xs text-inkmuted">
        Web Serial works in Chrome/Edge (9600 8N1). Firefox/Safari: use the simulator or type readings manually.
      </p>
    </div>
  )
}
