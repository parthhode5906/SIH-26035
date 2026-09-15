/**
 * TypeScript mirror of the Python metrology engine (memory.md D-12).
 *
 * OFFLINE PROVISIONAL VERDICTS ONLY. The authoritative verdict is always
 * recomputed by the backend engine at insert (architecture.md §4.3 rule 3);
 * this module exists so a basement lab with no connectivity still sees a
 * verdict the instant a reading is typed (design.md personas).
 *
 * Mirror discipline: golden_vectors.json (backend/tests) is the shared
 * single source of truth; frontend/tests consume it directly so the two
 * engines can never drift. All math uses decimal.js — never JS numbers.
 *
 * Bands: OIML R 76-1 (2006) §3.5.1 Table 6, initial verification,
 * (lo, hi] edges. Verified 2026-09-15 against the official PDF (D-20);
 * in-service values (§3.5.2, 2×) are out of scope for v1 (D-19).
 */
import Decimal from 'decimal.js'

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })

export type AccuracyClass = 'I' | 'II' | 'III' | 'IIII'
export type Verdict = 'PASS' | 'FAIL'

export interface ScaleParameters {
  accuracy_class: AccuracyClass
  max_capacity: string
  min_capacity: string
  verification_scale_interval: string
  display_interval?: string | null
}

export interface Observation {
  applied_load: string
  indication: string
  additional_load?: string
  zero_error?: string
}

export interface EvaluationResult {
  error_prior: string
  corrected_error: string
  mpe_limit: string
  mpe_in_e: string
  load_in_e: string
  verdict: Verdict
  message: string
}

export class EngineValueError extends Error {}

/** MPE band: [lo, hi) in units of e... documented as (lo, hi]; rows carry hi=null for unbounded. */
interface Band {
  lo: string
  hi: string | null
  mpe_in_e: string
}

const BANDS: Record<AccuracyClass, Band[]> = {
  I: [
    { lo: '0', hi: '50000', mpe_in_e: '0.5' },
    { lo: '50000', hi: '200000', mpe_in_e: '1.0' },
    { lo: '200000', hi: null, mpe_in_e: '1.5' },
  ],
  II: [
    { lo: '0', hi: '5000', mpe_in_e: '0.5' },
    { lo: '5000', hi: '20000', mpe_in_e: '1.0' },
    { lo: '20000', hi: '100000', mpe_in_e: '1.5' },
  ],
  III: [
    { lo: '0', hi: '500', mpe_in_e: '0.5' },
    { lo: '500', hi: '2000', mpe_in_e: '1.0' },
    { lo: '2000', hi: '10000', mpe_in_e: '1.5' },
  ],
  IIII: [
    { lo: '0', hi: '50', mpe_in_e: '0.5' },
    { lo: '50', hi: '200', mpe_in_e: '1.0' },
    { lo: '200', hi: '1000', mpe_in_e: '1.5' },
  ],
}

const N_RANGE: Record<AccuracyClass, [Decimal | null, Decimal | null]> = {
  I: [new Decimal(50000), null],
  II: [new Decimal(5000), new Decimal(100000)],
  III: [new Decimal(100), new Decimal(10000)],
  IIII: [new Decimal(10), new Decimal(1000)],
}

const MIN_IN_E: Record<AccuracyClass, Decimal | null> = {
  I: new Decimal(100),
  II: new Decimal(50),
  III: new Decimal(20),
  IIII: new Decimal(10),
}

function fixed6(d: Decimal): string {
  return d.toFixed(6, Decimal.ROUND_HALF_UP)
}

/** Minimal plain-decimal string (Python str(Decimal) equivalent, never exponential). */
function plain(d: Decimal): string {
  return d.toFixed()
}

/** Parse a metrology value; JS numbers are rejected like the Python engine rejects floats. */
function dec(value: string | number, field: string): Decimal {
  if (typeof value === 'number') {
    throw new EngineValueError(
      `${field}: binary float is forbidden on metrology values (INV-4); send a string.`,
    )
  }
  const cleaned = value.trim()
  if (!cleaned) throw new EngineValueError(`${field}: empty string is not a number.`)
  let d: Decimal
  try {
    d = new Decimal(cleaned)
  } catch {
    throw new EngineValueError(`${field}: not a valid decimal number: '${value}'.`)
  }
  if (!d.isFinite()) throw new EngineValueError(`${field}: NaN/Infinity is not allowed.`)
  return d
}

/** R 76-1 Table 3 gate — mirrors engine/class_rules.py. */
export function validate_instrument_spec(scale: ScaleParameters): void {
  const e = dec(scale.verification_scale_interval, 'verification_scale_interval')
  const max = dec(scale.max_capacity, 'max_capacity')
  const min = dec(scale.min_capacity, 'min_capacity')
  if (e.lte(0)) throw new EngineValueError(`verification_scale_interval (e) must be > 0; got ${e}.`)
  if (max.lte(0)) throw new EngineValueError(`max_capacity (Max) must be > 0; got ${max}.`)
  if (min.gt(max))
    throw new EngineValueError(`min_capacity (Min) ${min} exceeds max_capacity (Max) ${max}.`)
  const n = max.div(e)
  if (!n.isInteger())
    throw new EngineValueError('max_capacity (Max) must be an integer multiple of e.')
  const [lo, hi] = N_RANGE[scale.accuracy_class]
  if (lo !== null && n.lt(lo))
    throw new EngineValueError(`n = Max/e >= ${lo} for class ${scale.accuracy_class}.`)
  if (hi !== null && n.gt(hi))
    throw new EngineValueError(`n = Max/e <= ${hi} for class ${scale.accuracy_class}.`)
  const minFloor = MIN_IN_E[scale.accuracy_class]
  if (minFloor !== null && min.lt(minFloor.mul(e)))
    throw new EngineValueError(`min_capacity (Min) must be >= ${minFloor}e for class ${scale.accuracy_class}.`)
  if (scale.display_interval) {
    const d = dec(scale.display_interval, 'display_interval')
    if (d.gt(e)) throw new EngineValueError('display_interval (d) must not exceed e (3.2.2).')
  }
}

/** MPE lookup: band edges (lo, hi] in units of e. */
export function mpe_for_load(
  accuracy_class: AccuracyClass,
  load: string,
  e: string,
): { mpe_limit: string; mpe_in_e: string; load_in_e: string } {
  const eDec = dec(e, 'e')
  const loadDec = dec(load, 'applied_load')
  const loadInE = loadDec.div(eDec)
  for (const band of BANDS[accuracy_class]) {
    const lo = new Decimal(band.lo)
    const aboveLo = loadInE.gt(lo)
    const belowHi = band.hi === null || loadInE.lte(new Decimal(band.hi))
    if (aboveLo && belowHi) {
      return {
        mpe_limit: plain(new Decimal(band.mpe_in_e).mul(eDec)),
        mpe_in_e: fixed6(new Decimal(band.mpe_in_e)),
        load_in_e: fixed6(loadInE),
      }
    }
  }
  throw new EngineValueError(
    `applied load ${load} (${fixed6(loadInE)}e) exceeds the class ${accuracy_class} range.`,
  )
}

/** Full evaluation chain: E → Ec → MPE → verdict. Mirrors engine/mpe_rules.py::evaluate. */
export function evaluate(scale: ScaleParameters, observation: Observation): EvaluationResult {
  validate_instrument_spec(scale)
  const e = dec(scale.verification_scale_interval, 'verification_scale_interval')
  const max = dec(scale.max_capacity, 'max_capacity')
  const L = dec(observation.applied_load, 'applied_load')
  const I = dec(observation.indication, 'indication')
  const dL = dec(observation.additional_load ?? '0', 'additional_load')
  const E0 = dec(observation.zero_error ?? '0', 'zero_error')

  if (L.gt(max)) throw new EngineValueError(`applied_load ${L} exceeds max_capacity ${max}.`)
  if (dL.gt(e))
    throw new EngineValueError(`additional_load (ΔL) ${dL} exceeds e (${e}); transcription error.`)

  // E = I + ½e − ΔL − L   (R 76-1 A.4.4.3)
  const halfE = e.div(2)
  const errorPrior = I.plus(halfE).minus(dL).minus(L)
  // Ec = E − E0
  const corrected = errorPrior.minus(E0)

  const { mpe_limit, mpe_in_e, load_in_e } = mpe_for_load(scale.accuracy_class, L.toString(), e.toString())
  const mpeDec = dec(mpe_limit, 'mpe_limit')
  const verdict: Verdict = corrected.abs().lte(mpeDec) ? 'PASS' : 'FAIL'

  return {
    error_prior: plain(errorPrior),
    corrected_error: plain(corrected),
    mpe_limit,
    mpe_in_e,
    load_in_e,
    verdict,
    message:
      `Corrected error ${fixed6(corrected)} ` +
      `${verdict === 'PASS' ? 'within' : 'exceeds'} MPE ±${fixed6(mpeDec)} ` +
      `(${mpe_in_e}e) at ${load_in_e}e -> ${verdict}`,
  }
}
