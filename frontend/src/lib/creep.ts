export const CAPTURE_POINTS_S = [0, 300, 900, 1800] as const
export const FULL_DURATION_S = 14_400

const DUE_WINDOW_S = 30

export function dueCapturePoint(elapsedS: number): number | null {
  if (elapsedS < 0) return null
  return CAPTURE_POINTS_S.find((point) => elapsedS >= point && elapsedS < point + DUE_WINDOW_S) ?? null
}

export function passedPoints(elapsedS: number): number[] {
  return CAPTURE_POINTS_S.filter((point) => elapsedS >= point).map(Number)
}

export function formatElapsed(elapsedS: number): string {
  const total = Math.max(0, Math.floor(elapsedS))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function canTerminateEarly(
  driftOverThirtyMinInE: string,
  driftFromFifteenToThirtyMinInE: string,
  fullCaptureWindow: boolean,
): boolean {
  if (!fullCaptureWindow) return false
  const total = Number(driftOverThirtyMinInE)
  const late = Number(driftFromFifteenToThirtyMinInE)
  return Number.isFinite(total) && Number.isFinite(late) && total < 0.5 && late < 0.2
}