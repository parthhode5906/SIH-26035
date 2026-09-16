/**
 * PWA install hook (P6-4) — registers the service worker and surfaces the
 * browser's install prompt at a lab-friendly moment (header Install button).
 * Per Ponytail ladder: no library — beforeinstallprompt + sw.js is ~40 lines.
 */
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let registered = false

export function usePwaInstall(): { canInstall: boolean; installed: boolean; install: () => void } {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return
    if (!registered && 'serviceWorker' in navigator) {
      registered = true
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* dev quirk or insecure origin — the app still works fully online-capable */
      })
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  return {
    canInstall: promptEvent !== null && !installed,
    installed,
    install: () => {
      const event = promptEvent
      if (!event) return
      setPromptEvent(null)
      void event.prompt()
    },
  }
}
