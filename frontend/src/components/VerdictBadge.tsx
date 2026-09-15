/**
 * Verdict badge — engine output only (design.md §7 rule 5). Glyphs
 * accompany color so meaning survives grayscale printing (§9).
 */
export type VerdictState = 'PASS' | 'FAIL' | 'PROVISIONAL' | 'SYNCING' | 'REJECTED'

const STYLES: Record<VerdictState, string> = {
  PASS: 'bg-pass/10 text-pass',
  FAIL: 'bg-fail/10 text-fail',
  PROVISIONAL: 'bg-warn/10 text-warn',
  SYNCING: 'bg-accent/10 text-accent',
  REJECTED: 'bg-fail/10 text-fail',
}

const GLYPHS: Record<VerdictState, string> = {
  PASS: '✓',
  FAIL: '✗',
  PROVISIONAL: '≈',
  SYNCING: '↻',
  REJECTED: '!',
}

export function VerdictBadge({ state, provisional }: { state: 'PASS' | 'FAIL'; provisional?: boolean }) {
  const resolved: VerdictState = provisional ? 'PROVISIONAL' : state
  return (
    <span
      className={`inline-flex h-11 items-center gap-2 rounded px-3 text-sm font-semibold ${STYLES[resolved]}`}
      aria-live="polite"
    >
      <span aria-hidden>{GLYPHS[resolved]}</span>
      {resolved}
    </span>
  )
}

export function SyncBadge({ syncState }: { syncState: 'pending' | 'synced' | 'rejected' }) {
  const map = {
    pending: { s: 'SYNCING' as const, label: 'PENDING SYNC' },
    synced: { s: 'PASS' as const, label: 'SYNCED' },
    rejected: { s: 'REJECTED' as const, label: 'REJECTED' },
  }
  const { s, label } = map[syncState]
  return (
    <span className={`inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-semibold ${STYLES[s]}`}>
      <span aria-hidden>{GLYPHS[s]}</span>
      {label}
    </span>
  )
}
