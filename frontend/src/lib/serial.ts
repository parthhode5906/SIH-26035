export interface ScaleFrame {
  weightKg: number
  raw: string
  format: string
}

export interface StablePolicy {
  n: number
  toleranceDivisions: number
  d: number
}

export type StableState =
  | { phase: 'idle' }
  | { phase: 'collecting'; readings: number[]; startedAt: number }
  | { phase: 'stable'; weightKg: number; raw: string; elapsedMs: number }

export interface ParsedFrame {
  frame: ScaleFrame | null
  consumed: number
  error?: string
}

function numeric(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDelimitedLine(input: string): ParsedFrame {
  const match = input.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*(kg|g)\s*(\r?\n)/i)
  if (!match) return { frame: null, consumed: 0 }
  const value = numeric(match[1]!)
  if (value === null) return { frame: null, consumed: match[0].length, error: 'invalid numeric scale value' }
  const weightKg = match[2]!.toLowerCase() === 'g' ? value / 1000 : value
  return {
    frame: { weightKg, raw: match[0], format: 'Essae DS-215 continuous' },
    consumed: match[0].length,
  }
}

function parseStx(input: string): ParsedFrame {
  const end = input.indexOf('\x03', 1)
  if (end < 0) return { frame: null, consumed: 0 }
  const raw = input.slice(0, end + 1)
  const payload = input.slice(1, end)
  const match = payload.match(/^\s*(\d+)\s+kg\s*$/i)
  if (!match) return { frame: null, consumed: raw.length, error: 'invalid DS-415 STX frame' }
  const grams = numeric(match[1]!)
  if (grams === null) return { frame: null, consumed: raw.length, error: 'invalid DS-415 gram value' }
  return {
    frame: { weightKg: grams / 1000, raw, format: 'Essae DS-415 STX' },
    consumed: raw.length,
  }
}

function parseMettler(input: string): ParsedFrame {
  const match = input.match(/^S\s+S\s+([+-]?\d+(?:\.\d+)?)\s*(kg|g)\s*(\r?\n)/i)
  if (!match) return { frame: null, consumed: 0 }
  const value = numeric(match[1]!)
  if (value === null) return { frame: null, consumed: match[0].length, error: 'invalid Mettler value' }
  return {
    frame: {
      weightKg: match[2]!.toLowerCase() === 'g' ? value / 1000 : value,
      raw: match[0],
      format: 'Mettler MT-SICS',
    },
    consumed: match[0].length,
  }
}

function parseGeneric(input: string): ParsedFrame {
  if (input.length < 16 || !/^SST\s/.test(input)) return { frame: null, consumed: 0 }
  const raw = input.slice(0, 16)
  const match = raw.match(/^SST\s+([+-]?\d+(?:\.\d+)?)k/i)
  if (!match) return { frame: null, consumed: 16, error: 'invalid generic 16-byte scale frame' }
  const value = numeric(match[1]!)
  if (value === null) return { frame: null, consumed: 16, error: 'invalid generic scale value' }
  return { frame: { weightKg: value, raw, format: 'generic 16-byte' }, consumed: 16 }
}

export function parseScaleFrame(input: string): ParsedFrame {
  if (!input) return { frame: null, consumed: 0 }
  if (input[0] === '\x02') return parseStx(input)
  if (input.startsWith('SST ')) return parseGeneric(input)
  if (/^S\s+S\s+/i.test(input)) return parseMettler(input)
  return parseDelimitedLine(input)
}

export function drainFrames(input: string): {
  rest: string
  frames: ScaleFrame[]
  errors: string[]
} {
  let rest = input
  const frames: ScaleFrame[] = []
  const errors: string[] = []
  for (;;) {
    const parsed = parseScaleFrame(rest)
    if (parsed.consumed > 0) {
      if (parsed.frame) frames.push(parsed.frame)
      if (parsed.error) errors.push(parsed.error)
      rest = rest.slice(parsed.consumed)
      continue
    }
    if (rest.startsWith('\x02')) break
    const lineEnd = rest.search(/[\r\n]/)
    if (lineEnd >= 0) {
      errors.push('unrecognized scale frame')
      rest = rest.slice(lineEnd + 1)
      continue
    }
    break
  }
  return { rest, frames, errors }
}

export function feedReading(
  state: StableState,
  weightKg: number,
  policy: StablePolicy,
  nowMs: number,
): StableState {
  const tolerance = Math.max(0, policy.toleranceDivisions * policy.d)
  if (!Number.isFinite(weightKg) || policy.n <= 0 || tolerance < 0) return state
  if (state.phase === 'stable') {
    if (Math.abs(weightKg - state.weightKg) <= tolerance) {
      return { ...state, weightKg, elapsedMs: Math.max(0, nowMs - (nowMs - state.elapsedMs)) }
    }
    return { phase: 'collecting', readings: [weightKg], startedAt: nowMs }
  }
  if (state.phase === 'collecting' && state.readings.length > 0) {
    const previous = state.readings[state.readings.length - 1]!
    if (Math.abs(weightKg - previous) > tolerance) {
      return { phase: 'collecting', readings: [weightKg], startedAt: nowMs }
    }
  }
  const readings = state.phase === 'collecting' ? [...state.readings, weightKg] : [weightKg]
  const startedAt = state.phase === 'collecting' ? state.startedAt : nowMs
  const recent = readings.slice(-policy.n)
  const spread = Math.max(...recent) - Math.min(...recent)
  if (recent.length >= policy.n && spread <= tolerance) {
    return { phase: 'stable', weightKg, raw: '', elapsedMs: Math.max(0, nowMs - startedAt) }
  }
  return { phase: 'collecting', readings, startedAt }
}

export function stableLabel(state: StableState, policy: StablePolicy): string {
  if (state.phase === 'idle') return 'Waiting for a scale reading'
  if (state.phase === 'stable') return `Stable — ready to capture (${state.weightKg.toFixed(3)} kg)`
  return `Stabilizing ${Math.min(state.readings.length, policy.n)}/${policy.n}`
}