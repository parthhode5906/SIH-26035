/**
 * Golden-vector conformance test: the TS mirror must agree with the Python
 * engine on every shared case (memory.md D-12). Vectors live ONCE in
 * backend/tests/golden_vectors.json and are consumed directly — a change
 * to engine behavior must update that file and both suites together.
 */
import { describe, expect, it } from 'vitest'

import vectors from '../../backend/tests/golden_vectors.json'
import {
  type EvaluationMode,
  EngineValueError,
  evaluate,
  validate_instrument_spec,
  type AccuracyClass,
  type Observation,
  type ScaleParameters,
} from '@/engine/mpe'

interface InstrumentSpec {
  accuracy_class: AccuracyClass
  max_capacity: string
  min_capacity: string
  verification_scale_interval: string
  display_interval?: string
  base_unit?: 'kg' | 'g'
}

const instruments = vectors.instruments as Record<string, InstrumentSpec>

function resolveInstrument(ref: string | InstrumentSpec): ScaleParameters {
  const spec = typeof ref === 'string' ? instruments[ref] : ref
  return {
    accuracy_class: spec.accuracy_class,
    max_capacity: spec.max_capacity,
    min_capacity: spec.min_capacity,
    verification_scale_interval: spec.verification_scale_interval,
    display_interval: spec.display_interval ?? null,
    base_unit: spec.base_unit ?? 'kg',
  }
}

describe('TS mirror: evaluation cases (shared golden vectors)', () => {
  for (const v of vectors.evaluation_cases) {
    it(`${v.id}: ${v.description}`, () => {
      const result = evaluate(
        resolveInstrument(v.instrument as string | InstrumentSpec),
        v.observation as Observation,
        // EVAL-MODE-01 pins the §3.5.2 in-service regime (2× Table 6).
        (v as { mode?: EvaluationMode }).mode ?? 'initial_verification',
        // P4b: DISC/TNL vectors exercise the discrimination and fixed-1e
        // no-load branches — the mirror must agree branch-for-branch.
        (v as { test_type?: string }).test_type,
      )
      expect(result.error_prior).toBe(v.expected.error_prior)
      expect(result.corrected_error).toBe(v.expected.corrected_error)
      expect(result.mpe_limit).toBe(v.expected.mpe_limit)
      expect(result.mpe_in_e).toBe(v.expected.mpe_in_e)
      expect(result.load_in_e).toBe(v.expected.load_in_e)
      expect(result.verdict).toBe(v.expected.verdict)
    })
  }
})

describe('TS mirror: validation cases (shared golden vectors)', () => {
  for (const v of vectors.validation_cases) {
    it(`${v.id}: ${v.description}`, () => {
      const spec = resolveInstrument(v.instrument as string | InstrumentSpec)
      if (v.expect_error === null) {
        expect(() => validate_instrument_spec(spec)).not.toThrow()
      } else {
        let message = ''
        try {
          validate_instrument_spec(spec)
        } catch (err) {
          message = err instanceof Error ? err.message : String(err)
          expect(err).toBeInstanceOf(EngineValueError)
        }
        for (const fragment of v.expect_error_contains) {
          expect(message).toContain(fragment)
        }
      }
    })
  }
})
