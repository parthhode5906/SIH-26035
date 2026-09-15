/**
 * Interactive Eccentricity Grid (design.md §5.1) — SVG top-down view of
 * the weighing pan: center + 4 quarter segments numbered 1–4 per the
 * R 76-2 layout (A.4.7.1: four quarter segments loaded in turn).
 * Click a quadrant → numeric entry for that position; completed positions
 * fill green/red per verdict; the next required position is highlighted.
 */
import { useMemo } from 'react'

export interface GridRow {
  position: string
  verdict: 'PASS' | 'FAIL'
  provisional?: boolean
}

export function EccentricityGrid({
  requiredPositions = ['1', '2', '3', '4'],
  rows,
  activePosition,
  onSelect,
}: {
  requiredPositions?: readonly string[]
  rows: readonly GridRow[]
  activePosition?: string | null
  onSelect: (position: string) => void
}) {
  const verdictByPosition = useMemo(
    () => new Map(rows.map((r) => [r.position, r])),
    [rows],
  )
  const nextRequired = requiredPositions.find((p) => !verdictByPosition.has(p))

  // Pan layout: 400×300 pan with a center square and 4 quarter segments
  // (R 76-2 Figure: segments numbered clockwise from top-left).
  const segments: { id: string; x: number; y: number }[] = [
    { id: '1', x: 20, y: 20 },
    { id: '2', x: 210, y: 20 },
    { id: '3', x: 20, y: 155 },
    { id: '4', x: 210, y: 155 },
  ]

  function fill(pos: string): string {
    const row = verdictByPosition.get(pos)
    if (row?.verdict === 'PASS') return 'fill-pass/25 stroke-pass'
    if (row?.verdict === 'FAIL') return 'fill-fail/25 stroke-fail'
    if (pos === activePosition || pos === nextRequired)
      return 'fill-accent/15 stroke-accent stroke-[2.5]'
    return 'fill-slate-50 stroke-slate-300'
  }

  return (
    <svg
      viewBox="0 0 400 300"
      className="mx-auto block h-56 w-full max-w-md"
      role="group"
      aria-label="Eccentricity positions on the weighing pan"
    >
      {/* Pan outline */}
      <rect x="8" y="8" width="384" height="284" rx="12" className="fill-none stroke-slate-400" />
      {/* Center reference (loaded only when positions are symmetric — not required by A.4.7.1) */}
      <rect
        x="170"
        y="115"
        width="60"
        height="70"
        rx="6"
        className="fill-slate-100 stroke-slate-300"
      />
      <text x="200" y="155" textAnchor="middle" className="fill-slate-400 text-[11px]">
        center
      </text>
      {segments.map((s) => {
        const row = verdictByPosition.get(s.id)
        const isNext = s.id === nextRequired
        return (
          <g
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="cursor-pointer focus:outline-none"
            role="button"
            aria-label={`Load position ${s.id}${row ? `: ${row.verdict}` : ' — not recorded'}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(s.id)
              }
            }}
          >
            <rect
              x={s.x}
              y={s.y}
              width="170"
              height="125"
              rx="8"
              strokeWidth={isNext ? 2.5 : 1.5}
              className={`${fill(s.id)} transition-colors`}
            />
            <text
              x={s.x + 85}
              y={s.y + 60}
              textAnchor="middle"
              className="pointer-events-none fill-slate-600 text-2xl font-bold"
            >
              {s.id}
            </text>
            {row && (
              <text
                x={s.x + 85}
                y={s.y + 85}
                textAnchor="middle"
                className={`pointer-events-none text-sm font-bold ${row.verdict === 'PASS' ? 'fill-pass' : 'fill-fail'}`}
              >
                {row.verdict === 'PASS' ? '✓' : '✗'}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
