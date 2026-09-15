/** Connectivity pill (design.md §6.4): ONLINE green / OFFLINE amber. */
import { useEffect } from 'react'
import { useConnectivity } from '@/stores/connectivity'
import { syncOutbox } from '@/lib/sync'

export function ConnectivityPill() {
  const online = useConnectivity((s) => s.online)

  useEffect(() => {
    if (online) void syncOutbox()
  }, [online])

  return (
    <span
      className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold ${
        online ? 'bg-pass/10 text-pass' : 'bg-warn/10 text-warn'
      }`}
      role="status"
    >
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-pass' : 'bg-warn'}`} aria-hidden />
      {online ? 'ONLINE' : 'OFFLINE — saving locally'}
    </span>
  )
}
