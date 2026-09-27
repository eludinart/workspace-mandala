import { exec, getPool, isDbConfigured, table } from './db'

export type SupportKind = 'question' | 'bug'
export type SupportStatus = 'new' | 'read' | 'done'

export type SupportReportInput = {
  userId: number
  communitySlug: string | null
  page: string
  kind: SupportKind
  message: string
  userAgent: string | null
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
}

let _tableEnsured = false

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

function asIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
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
  return Number((result as { insertId?: number }).insertId ?? 0)
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
  return ((rows as Record<string, unknown>[]) ?? []).map((row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    author_name: String(row.display_name || '').trim() || 'Membre',
    author_email: String(row.user_email || ''),
    community_slug: row.community_slug ? String(row.community_slug) : null,
    page: String(row.page || ''),
    kind: row.kind === 'question' ? 'question' : 'bug',
    message: String(row.message || ''),
    user_agent: row.user_agent ? String(row.user_agent) : null,
    status: row.status === 'done' || row.status === 'read' ? row.status : 'new',
    created_at: asIso(row.created_at),
  }))
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
