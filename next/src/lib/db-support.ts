import { exec, getPool, isDbConfigured, table } from './db'
import { SUPPORT_MAX_IMAGES } from './support-images'

export type SupportKind = 'question' | 'bug'
export type SupportStatus = 'new' | 'read' | 'done'

export type SupportReportInput = {
  userId: number
  communitySlug: string | null
  page: string
  kind: SupportKind
  message: string
  userAgent: string | null
  images?: string[]
}

export type SupportReportItem = {
  id: number
  user_id: number
  author_name: string
  author_email: string
  community_slug: string | null
  page: string
  kind: SupportKind
  message: string
  user_agent: string | null
  status: SupportStatus
  created_at: string | null
  images: string[]
}

let _tableEnsured = false
let _imagesTableEnsured = false

export async function ensureSupportTable(): Promise<void> {
  if (_tableEnsured || !isDbConfigured()) return
  const pool = getPool()
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${table('support_reports')} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      community_slug VARCHAR(64) DEFAULT NULL,
      page VARCHAR(64) NOT NULL,
      kind VARCHAR(16) NOT NULL,
      message TEXT NOT NULL,
      user_agent VARCHAR(512) DEFAULT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status_created (status, created_at),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  _tableEnsured = true
}

export async function ensureSupportImagesTable(): Promise<void> {
  if (_imagesTableEnsured || !isDbConfigured()) return
  const pool = getPool()
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${table('support_report_images')} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_id INT NOT NULL,
      sort_order TINYINT NOT NULL DEFAULT 0,
      image_data MEDIUMTEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_report_sort (report_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  _imagesTableEnsured = true
}

function asIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
}

async function insertImagesForReport(reportId: number, images: string[]): Promise<void> {
  if (!images.length) return
  await ensureSupportImagesTable()
  const pool = getPool()
  const capped = images.slice(0, SUPPORT_MAX_IMAGES)
  for (let i = 0; i < capped.length; i++) {
    await exec(
      pool,
      `INSERT INTO ${table('support_report_images')} (report_id, sort_order, image_data)
       VALUES (?, ?, ?)`,
      [reportId, i, capped[i]]
    )
  }
}

async function loadImagesByReportIds(ids: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>()
  if (!ids.length) return map
  await ensureSupportImagesTable()
  const pool = getPool()
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await exec(
    pool,
    `SELECT report_id, image_data
     FROM ${table('support_report_images')}
     WHERE report_id IN (${placeholders})
     ORDER BY report_id ASC, sort_order ASC, id ASC`,
    ids
  )
  for (const row of (rows as Record<string, unknown>[]) ?? []) {
    const reportId = Number(row.report_id)
    const data = String(row.image_data || '')
    if (!reportId || !data) continue
    const list = map.get(reportId) ?? []
    if (list.length < SUPPORT_MAX_IMAGES) list.push(data)
    map.set(reportId, list)
  }
  return map
}

async function deleteImagesForReports(ids: number[]): Promise<void> {
  if (!ids.length) return
  await ensureSupportImagesTable()
  const pool = getPool()
  const placeholders = ids.map(() => '?').join(',')
  await exec(
    pool,
    `DELETE FROM ${table('support_report_images')} WHERE report_id IN (${placeholders})`,
    ids
  )
}

export async function insertSupportReport(input: SupportReportInput): Promise<number> {
  if (!isDbConfigured()) throw new Error('Base de données indisponible')
  await ensureSupportTable()
  const pool = getPool()
  const [result] = await exec(
    pool,
    `INSERT INTO ${table('support_reports')}
      (user_id, community_slug, page, kind, message, user_agent, status)
     VALUES (?, ?, ?, ?, ?, ?, 'new')`,
    [
      input.userId,
      input.communitySlug,
      input.page,
      input.kind,
      input.message,
      input.userAgent,
    ]
  )
  const id = Number((result as { insertId?: number }).insertId ?? 0)
  if (id && input.images?.length) {
    await insertImagesForReport(id, input.images)
  }
  return id
}

export async function listSupportReports(limit = 100): Promise<SupportReportItem[]> {
  if (!isDbConfigured()) return []
  await ensureSupportTable()
  const pool = getPool()
  const capped = Math.min(200, Math.max(1, limit))
  const [rows] = await exec(
    pool,
    `SELECT r.id, r.user_id, r.community_slug, r.page, r.kind, r.message, r.user_agent, r.status, r.created_at,
            u.display_name, u.user_email
     FROM ${table('support_reports')} r
     LEFT JOIN ${table('users')} u ON u.ID = r.user_id
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [capped]
  )
  const items = ((rows as Record<string, unknown>[]) ?? []).map((row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    author_name: String(row.display_name || '').trim() || 'Membre',
    author_email: String(row.user_email || ''),
    community_slug: row.community_slug ? String(row.community_slug) : null,
    page: String(row.page || ''),
    kind: (row.kind === 'question' ? 'question' : 'bug') as SupportKind,
    message: String(row.message || ''),
    user_agent: row.user_agent ? String(row.user_agent) : null,
    status: (row.status === 'done' || row.status === 'read' ? row.status : 'new') as SupportStatus,
    created_at: asIso(row.created_at),
    images: [] as string[],
  }))
  const imageMap = await loadImagesByReportIds(items.map((item) => item.id))
  for (const item of items) {
    item.images = imageMap.get(item.id) ?? []
  }
  return items
}

export async function updateSupportReportStatus(
  id: number,
  status: SupportStatus
): Promise<boolean> {
  if (!isDbConfigured()) return false
  await ensureSupportTable()
  const pool = getPool()
  const [result] = await exec(
    pool,
    `UPDATE ${table('support_reports')} SET status = ? WHERE id = ?`,
    [status, id]
  )
  return ((result as { affectedRows?: number }).affectedRows ?? 0) > 0
}

/** Supprime un retour uniquement s'il est déjà traité. */
export async function deleteDoneSupportReport(
  id: number
): Promise<'deleted' | 'not_found' | 'not_done'> {
  if (!isDbConfigured()) return 'not_found'
  await ensureSupportTable()
  const pool = getPool()
  const [rows] = await exec(
    pool,
    `SELECT status FROM ${table('support_reports')} WHERE id = ?`,
    [id]
  )
  const row = ((rows as Record<string, unknown>[]) ?? [])[0]
  if (!row) return 'not_found'
  if (row.status !== 'done') return 'not_done'
  await deleteImagesForReports([id])
  const [result] = await exec(
    pool,
    `DELETE FROM ${table('support_reports')} WHERE id = ? AND status = 'done'`,
    [id]
  )
  return ((result as { affectedRows?: number }).affectedRows ?? 0) > 0 ? 'deleted' : 'not_found'
}

/**
 * Supprime plusieurs retours traités. Tout ou rien : si un ID manque ou n’est pas `done`,
 * aucune suppression.
 */
export async function deleteDoneSupportReportsBatch(
  ids: number[]
): Promise<'deleted' | 'not_found' | 'not_done' | 'empty'> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))]
  if (!unique.length) return 'empty'
  if (!isDbConfigured()) return 'not_found'
  await ensureSupportTable()
  await ensureSupportImagesTable()
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const placeholders = unique.map(() => '?').join(',')
    const [rows] = await conn.execute(
      `SELECT id, status FROM ${table('support_reports')} WHERE id IN (${placeholders})`,
      unique
    )
    const found = (rows as Record<string, unknown>[]) ?? []
    if (found.length !== unique.length) {
      await conn.rollback()
      return 'not_found'
    }
    if (found.some((row) => row.status !== 'done')) {
      await conn.rollback()
      return 'not_done'
    }
    await conn.execute(
      `DELETE FROM ${table('support_report_images')} WHERE report_id IN (${placeholders})`,
      unique
    )
    const [result] = await conn.execute(
      `DELETE FROM ${table('support_reports')} WHERE id IN (${placeholders}) AND status = 'done'`,
      unique
    )
    const affected = (result as { affectedRows?: number }).affectedRows ?? 0
    if (affected !== unique.length) {
      await conn.rollback()
      return 'not_found'
    }
    await conn.commit()
    return 'deleted'
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
