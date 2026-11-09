/**
 * Abonnements push — table mdl_push_subscriptions.
 * provider: web_push (VAPID/iOS) | fcm (Android natif) | fcm_web (Firebase JS).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

const T = () => table('push_subscriptions')

let _ensurePromise: Promise<void> | null = null

export type PushProvider = 'web_push' | 'fcm' | 'fcm_web'

export type PushSubscriptionRow = {
  id: number
  user_id: number
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  platform: string | null
  standalone: boolean | null
  last_seen_at: string | null
  provider: PushProvider
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
      platform VARCHAR(16) DEFAULT NULL,
      standalone TINYINT(1) DEFAULT NULL,
      last_seen_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_endpoint (endpoint),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  for (const ddl of [
    `ALTER TABLE ${T()} ADD COLUMN platform VARCHAR(16) DEFAULT NULL`,
    `ALTER TABLE ${T()} ADD COLUMN standalone TINYINT(1) DEFAULT NULL`,
    `ALTER TABLE ${T()} ADD COLUMN last_seen_at DATETIME DEFAULT NULL`,
    `ALTER TABLE ${T()} ADD COLUMN provider VARCHAR(16) NOT NULL DEFAULT 'web_push'`,
  ]) {
    try {
      await pool.execute(ddl)
    } catch {
      /* colonne déjà présente */
    }
  }
}

function normalizeProvider(raw: string | null | undefined): PushProvider {
  const p = String(raw ?? 'web_push').toLowerCase()
  if (p === 'fcm' || p === 'fcm_web' || p === 'web_push') return p
  return 'web_push'
}

export async function upsertPushSubscription(input: {
  userId: number
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string | null
  platform?: string | null
  standalone?: boolean | null
  provider?: PushProvider | string | null
}): Promise<void> {
  await ensurePushTables()
  const pool = getPool()
  const endpoint = String(input.endpoint).slice(0, 512)
  const p256dh = String(input.p256dh).slice(0, 255)
  const auth = String(input.auth).slice(0, 255)
  const ua = input.userAgent ? String(input.userAgent).slice(0, 512) : null
  const platform = input.platform ? String(input.platform).slice(0, 16) : null
  const standalone = input.standalone == null ? null : input.standalone ? 1 : 0
  const provider = normalizeProvider(input.provider)

  await pool.execute(
    `INSERT INTO ${T()} (user_id, endpoint, p256dh, auth, user_agent, platform, standalone, last_seen_at, provider)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       p256dh = VALUES(p256dh),
       auth = VALUES(auth),
       user_agent = VALUES(user_agent),
       platform = COALESCE(VALUES(platform), platform),
       standalone = COALESCE(VALUES(standalone), standalone),
       provider = VALUES(provider),
       last_seen_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`,
    [input.userId, endpoint, p256dh, auth, ua, platform, standalone, provider]
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
    `SELECT id, user_id, endpoint, p256dh, auth, user_agent, platform, standalone, last_seen_at, provider
     FROM ${T()} WHERE user_id = ?`,
    [userId]
  )
  return (rows ?? []).map((r) => mapSubRow(r))
}

function mapSubRow(r: RowDataPacket): PushSubscriptionRow {
  return {
    id: Number(r.id),
    user_id: Number(r.user_id),
    endpoint: String(r.endpoint),
    p256dh: String(r.p256dh),
    auth: String(r.auth),
    user_agent: r.user_agent != null ? String(r.user_agent) : null,
    platform: r.platform != null ? String(r.platform) : null,
    standalone: r.standalone == null ? null : Boolean(Number(r.standalone)),
    last_seen_at: r.last_seen_at != null ? String(r.last_seen_at) : null,
    provider: normalizeProvider(r.provider != null ? String(r.provider) : 'web_push'),
  }
}

/** Appareils enregistrés (sans clés crypto) pour l’admin. */
export async function listPushDevicesForUser(userId: number): Promise<
  Array<{
    id: number
    platform: string | null
    standalone: boolean | null
    user_agent: string | null
    last_seen_at: string | null
    created_at: string | null
    updated_at: string | null
    provider: PushProvider
  }>
> {
  await ensurePushTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, platform, standalone, user_agent, last_seen_at, created_at, updated_at, provider
     FROM ${T()} WHERE user_id = ? ORDER BY updated_at DESC`,
    [userId]
  )
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    platform: r.platform != null ? String(r.platform) : null,
    standalone: r.standalone == null ? null : Boolean(Number(r.standalone)),
    user_agent: r.user_agent != null ? String(r.user_agent) : null,
    last_seen_at: r.last_seen_at != null ? String(r.last_seen_at) : null,
    created_at: r.created_at != null ? String(r.created_at) : null,
    updated_at: r.updated_at != null ? String(r.updated_at) : null,
    provider: normalizeProvider(r.provider != null ? String(r.provider) : 'web_push'),
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
