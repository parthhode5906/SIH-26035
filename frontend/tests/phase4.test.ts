/**
 * Phase 4 unit tests — the rulebook-sourced requirements, the creep
 * state machine, and module-status completion logic. Constants are
 * cross-checked against backend/tests/golden_vectors.json instruments.
 */
import { describe, expect, it } from 'vitest'

import {
  TEST_MODULES,
  moduleFor,
  moduleStatus,
  type RowShape,
} from '@/lib/requirements'
import {
  CAPTURE_POINTS_S,
  FULL_DURATION_S,
  canTerminateEarly,
  dueCapturePoint,
  formatElapsed,
  passedPoints,
} from '@/lib/creep'
import type { ScaleParameters } from '@/engine/mpe'

// The seeded demo instrument (backend/scripts/seed.py): Essae DS-415,
// Class III, Max 15 kg, Min 0.1 kg, e = 5 g = 0.005 kg.
const SCALE: ScaleParameters = {
  accuracy_class: 'III',
  max_capacity: '15',
  min_capacity: '0.1',
  verification_scale_interval: '0.005',
  display_interval: '0.001',
}

describe('test-module requirements (rulebook-sourced)', () => {
  it('covers all seventeen R 76-2 tests (P4c adds the long-duration/EMC set)', () => {
    expect(TEST_MODULES.map((m) => m.testType)).toEqual([
      // Tests 1-6, 9, 6.1, 6.2:
      'weighing_performance',
      'eccentricity',
      'repeatability',
      'tare',
      'creep',
      'zero_check',
      // P4b influence factors (2, 4.1, 11, B.2):
      'temperature_no_load',
      'discrimination',
      'damp_heat',
      'voltage_variations',
      // P4c (4.2, 7, 8, 10, 12, 14, 15):
      'sensitivity',
      'equilibrium',
      'tilting',
      'warm_up',
      'span_stability',
      'endurance',
      'emc_disturbances',
    ])
    expect(TEST_MODULES.length).toBe(17) // checklist (17) is a separate tab
  })

  it('every module cites a clause and carries a hint', () => {
    for (const m of TEST_MODULES) {
      expect(m.clause).toMatch(/^R 76-1 (§|Annex )/)
      expect(m.hint.length).toBeGreaterThan(20)
    }
  })

  it('eccentricity test load is 1/3 Max (§3.6.2.1)', () => {
    const m = moduleFor('eccentricity')!
    expect(m.suggestedLoads(SCALE)).toEqual(['5'])
  })

  it('zero check suggests the 10e break-out load (§A.4.2.3.2)', () => {
    const m = moduleFor('zero_check')!
    expect(m.suggestedLoads(SCALE)).toEqual(['0.05'])
  })

  it('weighing performance suggests MPE changeover points 500e/2000e', () => {
    const m = moduleFor('weighing_performance')!
    const loads = m.suggestedLoads(SCALE)
    expect(loads).toEqual(['0.1', '2.5', '10', '7.5', '15'])
  })

  it('repeatability suggests 50% and 100% Max (§A.4.10)', () => {
    const m = moduleFor('repeatability')!
    expect(m.suggestedLoads(SCALE)).toEqual(['7.5', '15'])
  })

  it('eccentricity requires all four quarter segments (A.4.7.1)', () => {
    const m = moduleFor('eccentricity')!
    expect(m.positions).toEqual(['1', '2', '3', '4'])
    expect(m.requiredPositions).toBe(true)
  })
})

describe('moduleStatus completion predicates', () => {
  const row = (test_type: string, position: string | null = null): RowShape => ({
    test_type,
    position,
    sequence_no: 1,
  })

  it('weighing performance is incomplete below 5 rows and complete at 5', () => {
    const m = moduleFor('weighing_performance')!
    expect(moduleStatus(m, [row('weighing_performance')], SCALE).complete).toBe(false)
    const five = Array.from({ length: 5 }, () => row('weighing_performance'))
    expect(moduleStatus(m, five, SCALE).complete).toBe(true)
  })

  it('eccentricity is incomplete until all 4 positions exist, regardless of count', () => {
    const m = moduleFor('eccentricity')!
    const three = ['1', '2', '3'].map((p) => row('eccentricity', p))
    const four = ['1', '2', '3', '4'].map((p) => row('eccentricity', p))
    const dupes = [...four, row('eccentricity', '1')]
    expect(moduleStatus(m, three, SCALE).missingPositions).toEqual(['4'])
    expect(moduleStatus(m, four, SCALE).complete).toBe(true)
    expect(moduleStatus(m, dupes, SCALE).complete).toBe(true)
  })

  it('creep needs all 4 capture points (positions 1-4)', () => {
    const m = moduleFor('creep')!
    const partial = ['1', '2'].map((p) => row('creep', p))
    expect(moduleStatus(m, partial, SCALE).complete).toBe(false)
    const all = ['1', '2', '3', '4'].map((p) => row('creep', p))
    expect(moduleStatus(m, all, SCALE).complete).toBe(true)
  })

  it('ignores rows from other test types', () => {
    const m = moduleFor('tare')!
    const noise = [row('weighing_performance'), row('repeatability'), row('zero_check')]
    const st = moduleStatus(m, noise, SCALE)
    expect(st.have).toBe(0)
    expect(st.complete).toBe(false)
  })

  it('finalize gate: incomplete while any module lacks rows', () => {
    const rows: RowShape[] = [
      ...Array.from({ length: 5 }, () => row('weighing_performance')),
      ...['1', '2', '3', '4'].map((p) => row('eccentricity', p)),
      ...Array.from({ length: 10 }, () => row('repeatability')),
      ...Array.from({ length: 5 }, () => row('tare')),
      ...['1', '2', '3', '4'].map((p) => row('creep', p)),
      row('zero_check'),
      // P4b influence-factor modules:
      ...Array.from({ length: 2 }, () => row('temperature_no_load')),
      ...Array.from({ length: 3 }, () => row('discrimination')),
      ...Array.from({ length: 5 }, () => row('damp_heat')),
      ...Array.from({ length: 2 }, () => row('voltage_variations')),
      // P4c modules:
      ...Array.from({ length: 2 }, () => row('sensitivity')),
      row('equilibrium'),
      ...Array.from({ length: 2 }, () => row('tilting')),
      ...Array.from({ length: 4 }, () => row('warm_up')),
      ...Array.from({ length: 2 }, () => row('span_stability')),
      ...Array.from({ length: 2 }, () => row('endurance')),
      row('emc_disturbances'),
    ]
    const allComplete = TEST_MODULES.every((m) => moduleStatus(m, rows, SCALE).complete)
    expect(allComplete).toBe(true)

    const shortRows = rows.filter((r) => r.test_type !== 'zero_check')
    const anyIncomplete = TEST_MODULES.some((m) =>
      moduleStatus(m, shortRows, SCALE).complete === false,
    )
    expect(anyIncomplete).toBe(true)
  })
})

describe('creep timer state machine (§A.4.11.1)', () => {
  it('capture points are 0, 5, 15, 30 min and the full test is 4 h', () => {
    expect(CAPTURE_POINTS_S).toEqual([0, 300, 900, 1800])
    expect(FULL_DURATION_S).toBe(14400)
  })

  it('a capture point stays due for its 30-second window', () => {
    expect(dueCapturePoint(0)).toBe(0)
    expect(dueCapturePoint(29)).toBe(0)
    expect(dueCapturePoint(30)).toBeNull()
    expect(dueCapturePoint(300)).toBe(300)
    expect(dueCapturePoint(45 * 60)).toBeNull() // no mandatory point after 30
    expect(dueCapturePoint(-1)).toBeNull()
  })

  it('passedPoints grows monotonically', () => {
    expect(passedPoints(0)).toEqual([0])
    expect(passedPoints(60)).toEqual([0])
    expect(passedPoints(300)).toEqual([0, 300])
    expect(passedPoints(1800)).toEqual([0, 300, 900, 1800])
  })

  it('early termination follows the 0.5e / 0.2e rule', () => {
    expect(canTerminateEarly('0.4', '0.1', true)).toBe(true)
    expect(canTerminateEarly('0.5', '0.1', true)).toBe(false) // 0.5e is not < 0.5e
    expect(canTerminateEarly('0.4', '0.2', true)).toBe(false) // 0.2e is not < 0.2e
    expect(canTerminateEarly('0.1', '0.05', false)).toBe(false) // too early
  })

  it('formats the timer as mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(65)).toBe('01:05')
    expect(formatElapsed(600)).toBe('10:00')
  })
})
