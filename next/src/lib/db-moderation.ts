/**
 * Signalements UGC + blocage utilisateurs (Play / UGC policy).
 */
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'

export const CONTENT_TARGET_TYPES = [
  'user',
  'message',
  'post',
  'event',
  'skill',
  'announcement',
  'other',
] as const

export type ContentTargetType = (typeof CONTENT_TARGET_TYPES)[number]

export const CONTENT_REASON_CODES = [
  'harassment',
  'hate',
  'spam',
  'illegal',
  'sexual',
  'impersonation',
  'other',
] as const

export type ContentReasonCode = (typeof CONTENT_REASON_CODES)[number]

export type ContentReportStatus = 'new' | 'reviewing' | 'actioned' | 'dismissed'

export type ContentReportItem = {
  id: number
  reporter_id: number
  reporter_name: string | null
  target_type: ContentTargetType
  target_id: string
  target_user_id: number | null
  community_id: number | null
  reason_code: ContentReasonCode
  details: string | null
  status: ContentReportStatus
  created_at: string | null
}

let _ensure: Promise<void> | null = null

export async function ensureModerationTables(): Promise<void> {
  if (!isDbConfigured()) return
  if (_ensure) return _ensure
  const pool = getPool()
  const tReports = table('content_reports')
  const tBlocks = table('user_blocks')
  _ensure = (async () => {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${tReports} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        reporter_id BIGINT UNSIGNED NOT NULL,
        target_type VARCHAR(32) NOT NULL,
        target_id VARCHAR(64) NOT NULL,
        target_user_id BIGINT UNSIGNED DEFAULT NULL,
        community_id INT DEFAULT NULL,
        reason_code VARCHAR(40) NOT NULL,
        details TEXT DEFAULT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'new',
        reviewed_at DATETIME DEFAULT NULL,
        reviewer_id BIGINT UNSIGNED DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_status_created (status, created_at),
        KEY idx_reporter (reporter_id),
        KEY idx_target (target_type, target_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${tBlocks} (
        blocker_id BIGINT UNSIGNED NOT NULL,
        blocked_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (blocker_id, blocked_id),
        KEY idx_blocked (blocked_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  })().catch((err) => {
    _ensure = null
    throw err
  })
  return _ensure
}

export function isContentTargetType(v: unknown): v is ContentTargetType {
  return CONTENT_TARGET_TYPES.includes(v as ContentTargetType)
}

export function isContentReasonCode(v: unknown): v is ContentReasonCode {
  return CONTENT_REASON_CODES.includes(v as ContentReasonCode)
}

export async function insertContentReport(input: {
  reporterId: number
  targetType: ContentTargetType
  targetId: string
  targetUserId?: number | null
  communityId?: number | null
  reasonCode: ContentReasonCode
  details?: string | null
}): Promise<number> {
  await ensureModerationTables()
  const pool = getPool()
  const t = table('content_reports')
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${t}
      (reporter_id, target_type, target_id, target_user_id, community_id, reason_code, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.reporterId,
      input.targetType,
      String(input.targetId).slice(0, 64),
      input.targetUserId && input.targetUserId > 0 ? input.targetUserId : null,
      input.communityId && input.communityId > 0 ? input.communityId : null,
      input.reasonCode,
      input.details?.trim().slice(0, 2000) || null,
    ]
  )
  return Number(res.insertId)
}

export async function listContentReports(limit = 100): Promise<ContentReportItem[]> {
  await ensureModerationTables()
  const pool = getPool()
  const t = table('content_reports')
  const users = table('users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.*, u.display_name AS reporter_name
     FROM ${t} r
     LEFT JOIN ${users} u ON u.ID = r.reporter_id
     ORDER BY FIELD(r.status, 'new', 'reviewing', 'actioned', 'dismissed'), r.created_at DESC
     LIMIT ?`,
    [Math.min(Math.max(limit, 1), 200)]
  )
  return rows.map((r) => ({
    id: Number(r.id),
    reporter_id: Number(r.reporter_id),
    reporter_name: r.reporter_name ? String(r.reporter_name) : null,
    target_type: String(r.target_type) as ContentTargetType,
    target_id: String(r.target_id),
    target_user_id: r.target_user_id != null ? Number(r.target_user_id) : null,
    community_id: r.community_id != null ? Number(r.community_id) : null,
    reason_code: String(r.reason_code) as ContentReasonCode,
    details: r.details ? String(r.details) : null,
    status: String(r.status) as ContentReportStatus,
    created_at: r.created_at ? String(r.created_at) : null,
  }))
}

export async function updateContentReportStatus(
  id: number,
  status: ContentReportStatus,
  reviewerId: number
): Promise<boolean> {
  await ensureModerationTables()
  const pool = getPool()
  const t = table('content_reports')
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE ${t}
     SET status = ?, reviewer_id = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, reviewerId, id]
  )
  return res.affectedRows > 0
}

export async function blockUser(blockerId: number, blockedId: number): Promise<void> {
  if (blockerId <= 0 || blockedId <= 0 || blockerId === blockedId) {
    throw Object.assign(new Error('Blocage invalide'), { status: 400 })
  }
  await ensureModerationTables()
  const pool = getPool()
  const t = table('user_blocks')
  await pool.execute(
    `INSERT IGNORE INTO ${t} (blocker_id, blocked_id) VALUES (?, ?)`,
    [blockerId, blockedId]
  )
}

export async function unblockUser(blockerId: number, blockedId: number): Promise<void> {
  await ensureModerationTables()
  const pool = getPool()
  const t = table('user_blocks')
  await pool.execute(`DELETE FROM ${t} WHERE blocker_id = ? AND blocked_id = ?`, [
    blockerId,
    blockedId,
  ])
}

export async function isBlockedEitherWay(a: number, b: number): Promise<boolean> {
  if (a <= 0 || b <= 0 || a === b) return false
  await ensureModerationTables()
  const pool = getPool()
  const t = table('user_blocks')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM ${t}
     WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
     LIMIT 1`,
    [a, b, b, a]
  )
  return rows.length > 0
}

export async function listBlockedIds(blockerId: number): Promise<number[]> {
  await ensureModerationTables()
  const pool = getPool()
  const t = table('user_blocks')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT blocked_id FROM ${t} WHERE blocker_id = ? ORDER BY created_at DESC`,
    [blockerId]
  )
  return rows.map((r) => Number(r.blocked_id))
}

export async function isUserBlockedBy(blockerId: number, blockedId: number): Promise<boolean> {
  await ensureModerationTables()
  const pool = getPool()
  const t = table('user_blocks')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM ${t} WHERE blocker_id = ? AND blocked_id = ? LIMIT 1`,
    [blockerId, blockedId]
  )
  return rows.length > 0
}
