import Decimal from 'decimal.js'
import type { ScaleParameters } from '@/engine/mpe'

export interface RowShape {
  test_type: string
  position: string | null
  sequence_no: number
}

export interface TestModule {
  testType: string
  title: string
  clause: string
  hint: string
  need: number
  positions?: readonly string[]
  requiredPositions?: boolean
  suggestedLoads: (scale: ScaleParameters) => string[]
}

function decimal(value: string): Decimal {
  return new Decimal(value)
}

const loads = {
  weighing: (scale: ScaleParameters) => {
    const max = decimal(scale.max_capacity)
    const min = decimal(scale.min_capacity)
    const e = decimal(scale.verification_scale_interval)
    return [min, e.mul(500), e.mul(2000), max.div(2), max].map((v) => v.toString())
  },
  thirdMax: (scale: ScaleParameters) => [decimal(scale.max_capacity).div(3).toString()],
  repeatability: (scale: ScaleParameters) => {
    const max = decimal(scale.max_capacity)
    return [max.div(2), max].map((v) => v.toString())
  },
  zero: (scale: ScaleParameters) => [decimal(scale.verification_scale_interval).mul(10).toString()],
  tare: (scale: ScaleParameters) => [decimal(scale.min_capacity), decimal(scale.verification_scale_interval).mul(500)].map((v) => v.toString()),
  creep: (scale: ScaleParameters) => [decimal(scale.max_capacity).toString()],
}

export const TEST_MODULES: readonly TestModule[] = [
  {
    testType: 'weighing_performance',
    title: 'Weighing performance',
    clause: 'R 76-1 §A.4.4',
    hint: 'Use increasing and decreasing loads, including MPE changeover points at 500e and 2000e.',
    need: 5,
    suggestedLoads: loads.weighing,
  },
  {
    testType: 'eccentricity',
    title: 'Eccentricity',
    clause: 'R 76-1 §3.6.2.1 / §A.4.7.1',
    hint: 'Apply one-third Max in each of the four quarter segments.',
    need: 4,
    positions: ['1', '2', '3', '4'],
    requiredPositions: true,
    suggestedLoads: loads.thirdMax,
  },
  {
    testType: 'repeatability',
    title: 'Repeatability',
    clause: 'R 76-1 §A.4.10',
    hint: 'Record at least ten consecutive readings at half Max and Max.',
    need: 10,
    suggestedLoads: loads.repeatability,
  },
  {
    testType: 'tare',
    title: 'Tare',
    clause: 'R 76-1 §A.4.6.1',
    hint: 'Record at least five net tare steps, including Min and changeover points.',
    need: 5,
    suggestedLoads: loads.tare,
  },
  {
    testType: 'creep',
    title: 'Creep / return to zero',
    clause: 'R 76-1 §A.4.11.1',
    hint: 'Capture readings at 0, 5, 15, and 30 minutes; early termination remains rule-bound.',
    need: 4,
    positions: ['1', '2', '3', '4'],
    requiredPositions: true,
    suggestedLoads: loads.creep,
  },
  {
    testType: 'zero_check',
    title: 'Zero check',
    clause: 'R 76-1 §A.4.2.3.2',
    hint: 'Use the 10e break-out load to check initial zero tracking.',
    need: 1,
    suggestedLoads: loads.zero,
  },
]

export function moduleFor(testType: string): TestModule | undefined {
  return TEST_MODULES.find((module) => module.testType === testType)
}

export function moduleStatus(
  module: TestModule,
  rows: readonly RowShape[],
  _scale: ScaleParameters,
): { have: number; need: number; complete: boolean; missingPositions: string[] } {
  const ownRows = rows.filter((row) => row.test_type === module.testType)
  const missingPositions = module.requiredPositions
    ? (module.positions ?? []).filter((position) => !ownRows.some((row) => row.position === position))
    : []
  const complete = module.requiredPositions
    ? missingPositions.length === 0
    : ownRows.length >= module.need
  return { have: ownRows.length, need: module.need, complete, missingPositions }
}