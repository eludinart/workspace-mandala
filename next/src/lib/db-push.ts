/**
 * Abonnements Web Push (VAPID) — table mdl_push_subscriptions.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

const T = () => table('push_subscriptions')

let _ensurePromise: Promise<void> | null = null

export type PushSubscriptionRow = {
  id: number
  user_id: number
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
}

export async function ensurePushTables(): Promise<void> {
  if (!isDbConfigured()) return
  if (!_ensurePromise) {
    _ensurePromise = _createPushTables().catch((err) => {
      _ensurePromise = null
      throw err
    })
  }
  await _ensurePromise
}

async function _createPushTables(): Promise<void> {
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${T()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      endpoint VARCHAR(512) NOT NULL,
      p256dh VARCHAR(255) NOT NULL,
      auth VARCHAR(255) NOT NULL,
      user_agent VARCHAR(512) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_endpoint (endpoint),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function upsertPushSubscription(input: {
  userId: number
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string | null
}): Promise<void> {
  await ensurePushTables()
  const pool = getPool()
  const endpoint = String(input.endpoint).slice(0, 512)
  const p256dh = String(input.p256dh).slice(0, 255)
  const auth = String(input.auth).slice(0, 255)
  const ua = input.userAgent ? String(input.userAgent).slice(0, 512) : null

  await pool.execute(
    `INSERT INTO ${T()} (user_id, endpoint, p256dh, auth, user_agent)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       p256dh = VALUES(p256dh),
       auth = VALUES(auth),
       user_agent = VALUES(user_agent),
       updated_at = CURRENT_TIMESTAMP`,
    [input.userId, endpoint, p256dh, auth, ua]
  )
}

export async function deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  await ensurePushTables()
  const pool = getPool()
  await pool.execute(`DELETE FROM ${T()} WHERE endpoint = ?`, [String(endpoint).slice(0, 512)])
}

export async function deletePushSubscriptionForUser(
  userId: number,
  endpoint: string
): Promise<void> {
  await ensurePushTables()
  const pool = getPool()
  await pool.execute(`DELETE FROM ${T()} WHERE user_id = ? AND endpoint = ?`, [
    userId,
    String(endpoint).slice(0, 512),
  ])
}

export async function listPushSubscriptionsForUser(userId: number): Promise<PushSubscriptionRow[]> {
  await ensurePushTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, endpoint, p256dh, auth, user_agent FROM ${T()} WHERE user_id = ?`,
    [userId]
  )
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    user_id: Number(r.user_id),
    endpoint: String(r.endpoint),
    p256dh: String(r.p256dh),
    auth: String(r.auth),
    user_agent: r.user_agent != null ? String(r.user_agent) : null,
  }))
}

export async function deletePushSubscriptionById(id: number): Promise<void> {
  await ensurePushTables()
  const pool = getPool()
  await pool.execute(`DELETE FROM ${T()} WHERE id = ?`, [id])
}

export async function countPushSubscriptionsForUser(userId: number): Promise<number> {
  await ensurePushTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM ${T()} WHERE user_id = ?`,
    [userId]
  )
  return Number((rows?.[0] as { c?: number })?.c ?? 0)
}
