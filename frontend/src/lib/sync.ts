import { api } from '@/api/client'
import { db, type OfflineObservation } from '@/db/offline'

export interface SyncReport {
  pushed: number
  rejected: { index: string; reason: string }[]
}

async function syncSession(sessionId: string): Promise<SyncReport> {
  const rows = await db.observations.where('session_id').equals(sessionId).toArray()
  const pending = rows.filter((row) => row.sync_state === 'pending')
  if (!pending.length) return { pushed: 0, rejected: [] }
  const result = await api.syncBatch(
    sessionId,
    pending.map((row) => ({
      test_type: row.test_type,
      position: row.position,
      sequence_no: row.sequence_no,
      revision_no: row.revision_no,
      applied_load: row.applied_load,
      indication: row.indication,
      additional_load: row.additional_load,
      zero_error: row.zero_error,
      source: row.source,
    })),
  )
  const rejectedByIndex = new Map(result.rejected.map((item) => [Number(item.index), item]))
  await Promise.all(
    pending.map(async (row, index) => {
      const rejected = rejectedByIndex.get(index)
      if (rejected) {
        await db.observations.update(row.id!, { sync_state: 'rejected', reject_reason: rejected.reason })
      } else {
        await db.observations.update(row.id!, { sync_state: 'synced' })
      }
    }),
  )
  return { pushed: result.accepted.length, rejected: result.rejected }
}

async function createQueuedSessions(): Promise<void> {
  const queued = await db.outboxSessions.where('state').equals('pending').toArray()
  for (const item of queued) {
    try {
      const session = await api.createSession(item.payload)
      const local = await db.sessions.get(item.id)
      if (local) {
        await db.sessions.put({ ...local, server_id: session.id })
        const rows = await db.observations.where('session_id').equals(item.id).toArray()
        await Promise.all(rows.map((row) => db.observations.update(row.id!, { session_id: session.id })))
      }
      await db.outboxSessions.update(item.id, { state: 'created' })
    } catch {
      // Retain the pending session for the next connectivity attempt.
    }
  }
}

export async function syncOutbox(): Promise<SyncReport> {
  await createQueuedSessions()
  const sessions = await db.sessions.toArray()
  let pushed = 0
  const rejected: { index: string; reason: string }[] = []
  for (const session of sessions) {
    const serverId = session.server_id ?? (session.id.includes('-') ? session.id : undefined)
    if (!serverId) continue
    try {
      const report = await syncSession(serverId)
      pushed += report.pushed
      rejected.push(...report.rejected)
    } catch {
      // Offline or unavailable API: pending rows remain durable in Dexie.
    }
  }
  return { pushed, rejected }
}

export function observationPayload(row: OfflineObservation): Record<string, unknown> {
  return {
    test_type: row.test_type,
    position: row.position,
    sequence_no: row.sequence_no,
    revision_no: row.revision_no,
    applied_load: row.applied_load,
    indication: row.indication,
    additional_load: row.additional_load,
    zero_error: row.zero_error,
    source: row.source,
  }
}