/**
 * Connectivity store (P3-5): the header pill's source of truth.
 * navigator.onLine is optimistic; a lightweight fetch confirms reality.
 */
import { create } from 'zustand'

interface ConnectivityState {
  online: boolean
  setOnline: (online: boolean) => void
  recheck: () => Promise<void>
}

const BASE: string = import.meta.env.VITE_API_BASE ?? ''

export const useConnectivity = create<ConnectivityState>((set) => ({
  online: navigator.onLine,
  setOnline: (online) => set({ online }),
  recheck: async () => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${BASE}/health`, {
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timer)
      set({ online: res.ok })
    } catch {
      set({ online: false })
    }
  },
}))

export function startConnectivityWatcher(): () => void {
  const goOnline = () => void useConnectivity.getState().recheck()
  const goOffline = () => useConnectivity.getState().setOnline(false)
  window.addEventListener('online', goOnline)
  window.addEventListener('offline', goOffline)
  void goOnline()
  const interval = setInterval(goOnline, 30_000)
  return () => {
    window.removeEventListener('online', goOnline)
    window.removeEventListener('offline', goOffline)
    clearInterval(interval)
  }
}
