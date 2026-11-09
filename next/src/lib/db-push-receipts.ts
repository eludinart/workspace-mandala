/**
 * Envois Web Push + accusés delivered/opened (admin).
 */
import { createHash } from 'crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import { ensurePushTables } from './db-push'
import { platformFromUserAgent } from './push-platform'

const TSends = () => table('push_sends')
const TReceipts = () => table('push_receipts')
const TSubs = () => table('push_subscriptions')

export type PushSendStatus = 'accepted' | 'gone' | 'error'
export type PushReceiptEvent = 'delivered' | 'opened'

export type PushSendRow = {
  id: number
  notification_id: number | null
  user_id: number
  subscription_id: number | null
  endpoint_hash: string
  title: string
  status: PushSendStatus
  error_detail: string | null
  created_at: string | null
  delivered_at?: string | null
  opened_at?: string | null
}

function hashEndpoint(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex')
}

export async function ensurePushReceiptTables(): Promise<void> {
  if (!isDbConfigured()) return
  await ensurePushTables()
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TSends()} (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      notification_id INT NULL,
      user_id INT NOT NULL,
      subscription_id INT NULL,
      endpoint_hash CHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      status ENUM('accepted', 'gone', 'error') NOT NULL,
      error_detail VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_created (user_id, created_at),
      INDEX idx_notif (notification_id),
      INDEX idx_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TReceipts()} (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      send_id BIGINT NOT NULL,
      event ENUM('delivered', 'opened') NOT NULL,
      user_agent VARCHAR(512) NULL,
      platform VARCHAR(16) NULL,
      standalone TINYINT(1) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_send_event (send_id, event),
      INDEX idx_event_created (event, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function insertPushSend(input: {
  notificationId?: number | null
  userId: number
  subscriptionId: number | null
  endpoint: string
  title: string
  status: PushSendStatus
  errorDetail?: string | null
}): Promise<number> {
  await ensurePushReceiptTables()
  const pool = getPool()
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${TSends()}
      (notification_id, user_id, subscription_id, endpoint_hash, title, status, error_detail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.notificationId ?? null,
      input.userId,
      input.subscriptionId,
      hashEndpoint(input.endpoint),
      String(input.title).slice(0, 255),
      input.status,
      input.errorDetail ? String(input.errorDetail).slice(0, 255) : null,
    ]
  )
  return Number(res.insertId)
}

export async function updatePushSendStatus(
  sendId: number,
  status: PushSendStatus,
  errorDetail?: string | null
): Promise<void> {
  if (!sendId) return
  await ensurePushReceiptTables()
  const pool = getPool()
  await pool.execute(
    `UPDATE ${TSends()} SET status = ?, error_detail = ? WHERE id = ?`,
    [status, errorDetail ? String(errorDetail).slice(0, 255) : null, sendId]
  )
}

export async function getPushSendById(sendId: number): Promise<{
  id: number
  user_id: number
  subscription_id: number | null
  status: PushSendStatus
} | null> {
  await ensurePushReceiptTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, subscription_id, status FROM ${TSends()} WHERE id = ? LIMIT 1`,
    [sendId]
  )
  const r = rows?.[0]
  if (!r) return null
  return {
    id: Number(r.id),
    user_id: Number(r.user_id),
    subscription_id: r.subscription_id != null ? Number(r.subscription_id) : null,
    status: String(r.status) as PushSendStatus,
  }
}

export async function recordPushReceipt(input: {
  sendId: number
  event: PushReceiptEvent
  userAgent?: string | null
  standalone?: boolean | null
  platform?: string | null
}): Promise<'ok' | 'duplicate' | 'not_found'> {
  await ensurePushReceiptTables()
  const send = await getPushSendById(input.sendId)
  if (!send) return 'not_found'
  const pool = getPool()
  const ua = input.userAgent ? String(input.userAgent).slice(0, 512) : null
  const platform = input.platform || platformFromUserAgent(ua)
  const standalone =
    input.standalone == null ? null : input.standalone ? 1 : 0
  try {
    await pool.execute(
      `INSERT INTO ${TReceipts()} (send_id, event, user_agent, platform, standalone)
       VALUES (?, ?, ?, ?, ?)`,
      [input.sendId, input.event, ua, platform, standalone]
    )
  } catch (err: unknown) {
    const code = String((err as { code?: string })?.code ?? '')
    if (code === 'ER_DUP_ENTRY') return 'duplicate'
    throw err
  }

  if (send.subscription_id) {
    await pool
      .execute(
        `UPDATE ${TSubs()}
         SET last_seen_at = CURRENT_TIMESTAMP,
             platform = COALESCE(?, platform),
             standalone = COALESCE(?, standalone),
             user_agent = COALESCE(?, user_agent),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [platform, standalone, ua, send.subscription_id]
      )
      .catch(() => {})
  }
  return 'ok'
}

export type PushOverviewStats = {
  range: string
  accepted: number
  gone: number
  error: number
  delivered: number
  opened: number
  delivery_rate: number | null
  open_rate: number | null
  pending_accepted: number
  recent_failures: Array<{
    id: number
    user_id: number
    title: string
    status: string
    error_detail: string | null
    created_at: string | null
  }>
  users_never_delivered: Array<{
    user_id: number
    devices: number
    last_accepted_at: string | null
  }>
}

function rangeHours(range: string): number {
  if (range === '7d') return 24 * 7
  return 24
}

export async function getPushOverview(range: '24h' | '7d' = '24h'): Promise<PushOverviewStats> {
  await ensurePushReceiptTables()
  const pool = getPool()
  const hours = rangeHours(range)
  const [statusRows] = await pool.execute<RowDataPacket[]>(
    `SELECT status, COUNT(*) AS c FROM ${TSends()}
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     GROUP BY status`,
    [hours]
  )
  let accepted = 0
  let gone = 0
  let error = 0
  for (const r of statusRows ?? []) {
    const c = Number(r.c)
    if (r.status === 'accepted') accepted = c
    else if (r.status === 'gone') gone = c
    else if (r.status === 'error') error = c
  }

  const [receiptRows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.event, COUNT(*) AS c
     FROM ${TReceipts()} r
     INNER JOIN ${TSends()} s ON s.id = r.send_id
     WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     GROUP BY r.event`,
    [hours]
  )
  let delivered = 0
  let opened = 0
  for (const r of receiptRows ?? []) {
    if (r.event === 'delivered') delivered = Number(r.c)
    if (r.event === 'opened') opened = Number(r.c)
  }

  const [pendingRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM ${TSends()} s
     WHERE s.status = 'accepted'
       AND s.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       AND s.created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
       AND NOT EXISTS (
         SELECT 1 FROM ${TReceipts()} r WHERE r.send_id = s.id AND r.event = 'delivered'
       )`,
    [hours]
  )
  const pending_accepted = Number(pendingRows?.[0]?.c ?? 0)

  const [failRows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.user_id, s.title, s.status, s.error_detail, s.created_at
     FROM ${TSends()} s
     WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       AND (
         s.status IN ('gone', 'error')
         OR (
           s.status = 'accepted'
           AND s.created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
           AND NOT EXISTS (
             SELECT 1 FROM ${TReceipts()} r WHERE r.send_id = s.id AND r.event = 'delivered'
           )
         )
       )
     ORDER BY s.created_at DESC
     LIMIT 40`,
    [hours]
  )

  const [neverRows] = await pool.execute<RowDataPacket[]>(
    `SELECT sub.user_id,
            COUNT(*) AS devices,
            MAX(s.created_at) AS last_accepted_at
     FROM ${TSubs()} sub
     LEFT JOIN ${TSends()} s
       ON s.user_id = sub.user_id
      AND s.status = 'accepted'
      AND s.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     WHERE NOT EXISTS (
       SELECT 1 FROM ${TReceipts()} r
       INNER JOIN ${TSends()} s2 ON s2.id = r.send_id
       WHERE s2.user_id = sub.user_id
         AND r.event = 'delivered'
         AND s2.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     )
     GROUP BY sub.user_id
     HAVING last_accepted_at IS NOT NULL
     ORDER BY last_accepted_at DESC
     LIMIT 30`,
    [hours, hours]
  )

  return {
    range,
    accepted,
    gone,
    error,
    delivered,
    opened,
    delivery_rate: accepted > 0 ? delivered / accepted : null,
    open_rate: delivered > 0 ? opened / delivered : null,
    pending_accepted,
    recent_failures: (failRows ?? []).map((r) => ({
      id: Number(r.id),
      user_id: Number(r.user_id),
      title: String(r.title),
      status: String(r.status),
      error_detail: r.error_detail != null ? String(r.error_detail) : null,
      created_at: r.created_at != null ? String(r.created_at) : null,
    })),
    users_never_delivered: (neverRows ?? []).map((r) => ({
      user_id: Number(r.user_id),
      devices: Number(r.devices),
      last_accepted_at: r.last_accepted_at != null ? String(r.last_accepted_at) : null,
    })),
  }
}

export async function listPushSendsForUser(userId: number, limit = 30): Promise<PushSendRow[]> {
  await ensurePushReceiptTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.notification_id, s.user_id, s.subscription_id, s.endpoint_hash,
            s.title, s.status, s.error_detail, s.created_at,
            (SELECT r.created_at FROM ${TReceipts()} r WHERE r.send_id = s.id AND r.event = 'delivered' LIMIT 1) AS delivered_at,
            (SELECT r.created_at FROM ${TReceipts()} r WHERE r.send_id = s.id AND r.event = 'opened' LIMIT 1) AS opened_at
     FROM ${TSends()} s
     WHERE s.user_id = ?
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [userId, Math.min(Math.max(limit, 1), 100)]
  )
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    notification_id: r.notification_id != null ? Number(r.notification_id) : null,
    user_id: Number(r.user_id),
    subscription_id: r.subscription_id != null ? Number(r.subscription_id) : null,
    endpoint_hash: String(r.endpoint_hash),
    title: String(r.title),
    status: String(r.status) as PushSendStatus,
    error_detail: r.error_detail != null ? String(r.error_detail) : null,
    created_at: r.created_at != null ? String(r.created_at) : null,
    delivered_at: r.delivered_at != null ? String(r.delivered_at) : null,
    opened_at: r.opened_at != null ? String(r.opened_at) : null,
  }))
}

export async function purgeOldPushReceipts(days = 30): Promise<{ sends: number; receipts: number }> {
  await ensurePushReceiptTables()
  const pool = getPool()
  const d = Math.min(Math.max(days, 7), 365)
  const [rec] = await pool.execute<ResultSetHeader>(
    `DELETE r FROM ${TReceipts()} r
     INNER JOIN ${TSends()} s ON s.id = r.send_id
     WHERE s.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [d]
  )
  const [sen] = await pool.execute<ResultSetHeader>(
    `DELETE FROM ${TSends()} WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [d]
  )
  return { receipts: Number(rec.affectedRows ?? 0), sends: Number(sen.affectedRows ?? 0) }
}

/** Taux delivered/accepted sur une fenêtre courte (alertes seuil). */
export async function getDeliveryRateWindow(hours = 6): Promise<{
  accepted: number
  delivered: number
  rate: number | null
}> {
  await ensurePushReceiptTables()
  const pool = getPool()
  const h = Math.min(Math.max(hours, 1), 72)
  const [accRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM ${TSends()}
     WHERE status = 'accepted' AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [h]
  )
  const accepted = Number(accRows?.[0]?.c ?? 0)
  const [delRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c
     FROM ${TReceipts()} r
     INNER JOIN ${TSends()} s ON s.id = r.send_id
     WHERE r.event = 'delivered'
       AND s.status = 'accepted'
       AND s.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [h]
  )
  const delivered = Number(delRows?.[0]?.c ?? 0)
  return { accepted, delivered, rate: accepted > 0 ? delivered / accepted : null }
}
