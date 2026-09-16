/**
 * Phase 6 tests: serial protocol parsing, capture-on-stable state machine.
 * Essae DS-415/DS-215 vectors are demo-proven formats; Mettler and the
 * generic 16-byte frame are implemented from public protocol literature
 * and marked provenance-pending (P6-1 human gate).
 */
import { describe, expect, it } from 'vitest'

import { drainFrames, feedReading, parseScaleFrame, stableLabel } from '@/lib/serial'

describe('parseScaleFrame — Essae DS-215 continuous kg', () => {
  it('parses a plain kg frame with CRLF', () => {
    const r = parseScaleFrame('5.006kg\r\n')
    expect(r.frame).not.toBeNull()
    expect(r.frame!.weightKg).toBeCloseTo(5.006, 6)
    expect(r.frame!.format).toMatch(/DS-215/)
    expect(r.consumed).toBe('5.006kg\r\n'.length)
  })

  it('parses grams and converts to kg', () => {
    const r = parseScaleFrame('5006g\n')
    expect(r.frame!.weightKg).toBeCloseTo(5.006, 6)
  })

  it('returns consumed=0 for an incomplete frame', () => {
    expect(parseScaleFrame('5.0').frame).toBeNull()
    expect(parseScaleFrame('5.0').consumed).toBe(0)
  })
})

describe('parseScaleFrame — Essae DS-415 STX frame', () => {
  it('parses the STX..ETX gram frame', () => {
    const payload = '\x02500600   kg\x03' // 500600 g integer-grams payload
    const r = parseScaleFrame(payload)
    expect(r.frame).not.toBeNull()
    expect(r.frame!.weightKg).toBeCloseTo(500.6, 3)
    expect(r.frame!.format).toMatch(/DS-415/)
  })

  it('waits for ETX before consuming', () => {
    const r = parseScaleFrame('\x02500600   kg')
    expect(r.frame).toBeNull()
    expect(r.consumed).toBe(0)
  })

  it('discards garbage STX payloads with a reason', () => {
    const r = parseScaleFrame('\x02garbage\x03')
    expect(r.frame).toBeNull()
    expect(r.consumed).toBeGreaterThan(0)
    expect(r.error).toBeTruthy()
  })
})

describe('parseScaleFrame — provenance-pending formats', () => {
  it('parses Mettler MT-SICS stable-data frame', () => {
    const r = parseScaleFrame('S S 1234.5 g\r\n')
    expect(r.frame!.weightKg).toBeCloseTo(1.2345, 4)
    expect(r.frame!.format).toMatch(/Mettler/)
  })

  it('parses the generic 16-byte fixed frame', () => {
    const frame = 'SST 10.0000kr   ' // exactly 16 chars
    expect(frame.length).toBe(16)
    const r = parseScaleFrame(frame)
    expect(r.frame!.weightKg).toBeCloseTo(10.0, 3)
    expect(r.consumed).toBe(16)
  })
})

describe('drainFrames', () => {
  it('drains two back-to-back frames and keeps the tail', () => {
    const { rest, frames, errors } = drainFrames('5.000kg\r\n10.000kg\r\n5.0')
    expect(frames).toHaveLength(2)
    expect(frames[0]!.weightKg).toBeCloseTo(5, 3)
    expect(frames[1]!.weightKg).toBeCloseTo(10, 3)
    expect(rest).toBe('5.0')
    expect(errors).toHaveLength(0)
  })

  it('reports errors but keeps going', () => {
    const { frames, errors } = drainFrames('\x02bad\x037.000kg\r\n')
    expect(errors).toHaveLength(1)
    expect(frames).toHaveLength(1)
  })
})

describe('capture-on-stable state machine (3 matching, ±1 d)', () => {
  const policy = { n: 3, toleranceDivisions: 1, d: 0.001 }
  const t0 = 1_000_000

  it('goes stable after three matching readings', () => {
    let s = feedReading({ phase: 'idle' }, 5.0, policy, t0)
    expect(s.phase).toBe('collecting')
    s = feedReading(s, 5.0005, policy, t0 + 600) // within 1 d
    s = feedReading(s, 4.9996, policy, t0 + 1200)
    expect(s.phase).toBe('stable')
    expect((s as { weightKg: number }).weightKg).toBeCloseTo(4.9996, 6)
  })

  it('restarts collection when readings jump', () => {
    let s = feedReading({ phase: 'idle' }, 5.0, policy, t0)
    s = feedReading(s, 5.0005, policy, t0 + 600)
    s = feedReading(s, 7.5, policy, t0 + 1200) // jump
    expect(s.phase).toBe('collecting')
    expect((s as { readings: number[] }).readings).toHaveLength(1)
  })

  it('latches stable while identical readings keep arriving', () => {
    let s = feedReading({ phase: 'idle' }, 5.0, policy, t0)
    s = feedReading(s, 5.0005, policy, t0 + 600)
    s = feedReading(s, 4.9996, policy, t0 + 1200)
    expect(s.phase).toBe('stable')
    // Two more identical frames — must remain stable (capture window open).
    s = feedReading(s, 5.0002, policy, t0 + 1800)
    expect(s.phase).toBe('stable')
    s = feedReading(s, 4.9998, policy, t0 + 2400)
    expect(s.phase).toBe('stable')
    // A real load change breaks the latch.
    s = feedReading(s, 7.5, policy, t0 + 3000)
    expect(s.phase).toBe('collecting')
  })

  it('labels the state for the UI chip', () => {
    expect(stableLabel({ phase: 'idle' }, policy)).toMatch(/Waiting/i)
    expect(stableLabel({ phase: 'collecting', readings: [5], startedAt: t0 }, policy)).toMatch(/1\/3/)
    expect(stableLabel({ phase: 'stable', weightKg: 5, raw: '', elapsedMs: 10 }, policy)).toMatch(/ready/i)
  })
})
