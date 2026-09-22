/**
 * IndexedDB offline store (P3-5) — the offline-first core.
 *
 * Every observation typed in the field is durably queued here BEFORE any
 * network attempt; sync pushes the outbox when connectivity returns
 * (server-wins rule INV-6: the backend re-evaluates and its verdict wins).
 */
import Dexie, { type Table } from 'dexie'

export interface OfflineSession {
  id: string // client-generated UUID (or server id for upserted sessions)
  instrument_id: string
  status: 'draft' | 'in_progress' | 'completed' | 'approved'
  /** MPE regime pinned at creation (R 76-1 §3.5); default 1× Table 6. */
  evaluation_mode?: 'initial_verification' | 'in_service'
  start_temp_c?: string
  end_temp_c?: string
  humidity_pct?: string
  pressure_hpa?: string
  created_at: string
  server_id?: string // set after the server creates the session
}

export interface OfflineObservation {
  id?: number // local auto-increment
  session_id: string // client session id
  test_type: string
  position: string | null
  sequence_no: number
  revision_no: number
  applied_load: string
  indication: string
  additional_load: string
  zero_error: string
  /** Discrimination only: I2 after the 1.4 d extra load (null otherwise). */
  second_indication: string | null
  // Provisional (TS mirror) verdict — never authoritative (INV-8):
  provisional_verdict: 'PASS' | 'FAIL'
  provisional_corrected_error: string
  source: 'manual' | 'serial' | 'ocr'
  created_at: string
  sync_state: 'pending' | 'synced' | 'rejected'
  reject_reason?: string
}

export interface OutboxSession {
  id: string
  payload: Record<string, unknown>
  state: 'pending' | 'created'
}

export interface CachedInstrument {
  id: string
  manufacturer: string
  model: string
  serial_number: string
  accuracy_class: string
  max_capacity: string
  min_capacity: string
  verification_scale_interval: string
  display_interval: string | null
  base_unit: string
  n_max: string
  fetched_at: string
}

class OimlDatabase extends Dexie {
  sessions!: Table<OfflineSession, string>
  observations!: Table<OfflineObservation, number>
  outboxSessions!: Table<OutboxSession, string>
  instruments!: Table<CachedInstrument, string>

  constructor() {
    super('oiml_r76')
    this.version(1).stores({
      sessions: 'id, status, created_at',
      observations:
        '++id, session_id, [session_id+test_type+position+sequence_no+revision_no], sync_state',
      outboxSessions: 'id, state',
    })
    this.version(2).stores({
      instruments: 'id',
    })
  }
}

export const db = new OimlDatabase()

/** Latest-wins local view: highest revision per logical identity. */
export async function latestLocalObservations(
  sessionId: string,
): Promise<OfflineObservation[]> {
  const all = await db.observations.where('session_id').equals(sessionId).toArray()
  const winners = new Map<string, OfflineObservation>()
  for (const o of all) {
    const key = `${o.test_type}|${o.position ?? ''}|${o.sequence_no}`
    const current = winners.get(key)
    if (!current || o.revision_no > current.revision_no) winners.set(key, o)
  }
  return [...winners.values()].sort(
    (a, b) => a.test_type.localeCompare(b.test_type) || a.sequence_no - b.sequence_no,
  )
}
