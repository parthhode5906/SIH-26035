/**
 * Web Serial connection hook (P6-1) — the ONLY module touching navigator.
 *
 * Chrome/Edge have `navigator.serial`; Firefox/Safari do not (design risk
 * #3). The hook degrades to a built-in simulator so the demo and offline
 * rehearsal never depend on hardware. Real serial requires a user gesture
 * (the Connect button calls `connect()`).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { drainFrames, feedReading, stableLabel, type ScaleFrame, type StablePolicy, type StableState } from '@/lib/serial'

export type LinkState = 'unsupported' | 'disconnected' | 'connecting' | 'live' | 'simulated'

export interface ScaleLink {
  state: LinkState
  /** Latest parsed frame, or null. */
  frame: ScaleFrame | null
  /** Stabilization state for the capture chip. */
  stable: StableState
  stableText: string
  /** The scale has settled on a reading. */
  ready: boolean
  lastError: string | null
  connect: () => Promise<void>
  startSimulator: (mode: 'stable' | 'drifty') => void
  disconnect: () => void
}

export function useScaleConnection(policy: StablePolicy): ScaleLink {
  const [state, setState] = useState<LinkState>(() =>
    typeof navigator !== 'undefined' && 'serial' in navigator ? 'disconnected' : 'unsupported',
  )
  const [frame, setFrame] = useState<ScaleFrame | null>(null)
  const [stable, setStable] = useState<StableState>({ phase: 'idle' })
  const [lastError, setLastError] = useState<string | null>(null)

  const policyRef = useRef(policy)
  policyRef.current = policy
  const bufRef = useRef('')
  const portRef = useRef<SerialPort | null>(null)
  const simRef = useRef<number | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null)

  const ingest = useCallback((f: ScaleFrame) => {
    setFrame(f)
    setStable((prev) => feedReading(prev, f.weightKg, policyRef.current, Date.now()))
  }, [])

  const readLoop = useCallback(
    async (port: SerialPort) => {
      const textDecoder = new TextDecoderStream()
      // The serial types declare the writable as BufferSource; the DOM lib's
      // pipeTo wants Uint8Array — same runtime stream, cast at the boundary.
      port.readable!
        .pipeTo(textDecoder.writable as unknown as WritableStream<Uint8Array>)
        .catch(() => {})
      const reader = textDecoder.readable.getReader()
      readerRef.current = reader
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          bufRef.current += value
          const drained = drainFrames(bufRef.current)
          bufRef.current = drained.rest
          if (drained.errors.length) setLastError(drained.errors[drained.errors.length - 1])
          for (const f of drained.frames) ingest(f)
        }
      } catch {
        /* port closed */
      }
    },
    [ingest],
  )

  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      setLastError('Web Serial unavailable in this browser — use Chrome/Edge, or run the simulator.')
      return
    }
    try {
      setState('connecting')
      setLastError(null)
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' })
      portRef.current = port
      setState('live')
      void readLoop(port)
    } catch (err) {
      setState('disconnected')
      setLastError(err instanceof Error ? err.message : 'could not open the port')
    }
  }, [readLoop])

  const startSimulator = useCallback((mode: 'stable' | 'drifty') => {
    stopAll()
    setState('simulated')
    setLastError(null)
    let base = 0
    let step = 0
    simRef.current = window.setInterval(() => {
      step += 1
      // Square-wave load profile: settle at 5.000, then 10.000 kg.
      base = Math.floor(step / 8) % 2 === 0 ? 5 : 10
      const jitter = mode === 'drifty' ? (Math.random() - 0.5) * 0.02 : 0
      ingest({ weightKg: Number((base + jitter).toFixed(3)), raw: 'SIM', format: 'simulator' })
    }, 600)
  }, [ingest])

  async function stopAll() {
    if (simRef.current !== null) {
      window.clearInterval(simRef.current)
      simRef.current = null
    }
    const reader = readerRef.current
    if (reader) {
      try {
        await reader.cancel()
      } catch {
        /* reader cancellation is best effort during teardown */
      } finally {
        if (readerRef.current === reader) readerRef.current = null
      }
    }
    const port = portRef.current
    if (port) {
      try {
        await port.close()
      } catch {
        /* port closure is best effort during teardown */
      } finally {
        if (portRef.current === port) portRef.current = null
      }
    }
    bufRef.current = ''
  }

  const disconnect = useCallback(() => {
    void stopAll()
    setFrame(null)
    setStable({ phase: 'idle' })
    setState(typeof navigator !== 'undefined' && 'serial' in navigator ? 'disconnected' : 'unsupported')
  }, [])

  useEffect(() => () => { void stopAll() }, [])

  return {
    state,
    frame,
    stable,
    stableText: stableLabel(stable, policy),
    ready: stable.phase === 'stable',
    lastError,
    connect,
    startSimulator,
    disconnect,
  }
}
