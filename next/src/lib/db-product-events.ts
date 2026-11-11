/**
 * Événements produit (Pilotage) + jours de session (DAU).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool, table } from '@/lib/db'
import { parisDayString } from '@/lib/paris-day'

export { parisDayString }

export type ProductEventType =
  | 'user.registered'
  | 'place.joined'
  | 'place.left'
  | 'onboarding.continue_without_place'
  | 'charter.accepted'
  | 'session.daily'

let ensured = false

export async function ensureProductPilotageTables(): Promise<void> {
  if (ensured) return
  const pool = getPool()
  const tE = table('product_events')
  const tS = table('user_session_days')
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tE} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(64) NOT NULL,
      user_id INT UNSIGNED NULL,
      community_id INT UNSIGNED NULL,
      payload_json JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_type_created (event_type, created_at),
      KEY idx_user_created (user_id, created_at),
      KEY idx_community_created (community_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tS} (
      user_id INT UNSIGNED NOT NULL,
      day_paris DATE NOT NULL,
      first_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      hit_count INT UNSIGNED NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, day_paris),
      KEY idx_day (day_paris)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  ensured = true
}

export async function emitProductEvent(params: {
  type: ProductEventType
  userId?: number | null
  communityId?: number | null
  payload?: Record<string, unknown> | null
}): Promise<void> {
  try {
    await ensureProductPilotageTables()
    const pool = getPool()
    const tE = table('product_events')
    const payload =
      params.payload && Object.keys(params.payload).length
        ? JSON.stringify(params.payload)
        : null
    await pool.execute(
      `INSERT INTO ${tE} (event_type, user_id, community_id, payload_json) VALUES (?, ?, ?, ?)`,
      [
        params.type,
        params.userId && params.userId > 0 ? params.userId : null,
        params.communityId && params.communityId > 0 ? params.communityId : null,
        payload,
      ]
    )
  } catch {
    /* non bloquant */
  }
}

/** Marque une activité le jour civil Paris (idempotent). */
export async function touchSessionDay(userId: number): Promise<void> {
  if (!userId) return
  try {
    await ensureProductPilotageTables()
    const pool = getPool()
    const tS = table('user_session_days')
    const day = parisDayString()
    await pool.execute<ResultSetHeader>(
      `INSERT INTO ${tS} (user_id, day_paris, hit_count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         hit_count = hit_count + 1,
         last_seen_at = CURRENT_TIMESTAMP(3)`,
      [userId, day]
    )
    // Premier hit du jour → event session.daily (évite spam)
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT hit_count FROM ${tS} WHERE user_id = ? AND day_paris = ? LIMIT 1`,
      [userId, day]
    )
    if (Number(rows[0]?.hit_count ?? 0) === 1) {
      await emitProductEvent({ type: 'session.daily', userId, payload: { day } })
    }
  } catch {
    /* non bloquant */
  }
}
