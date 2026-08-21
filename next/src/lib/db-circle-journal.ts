/**
 * Journal des cercles matin / soir — photo du tableau + résumé.
 * Accès V1 : développeurs + gestionnaires (API).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

export type CircleSlot = 'morning' | 'evening'

export type CircleSession = {
  id: number
  community_id: number
  day: string
  slot: CircleSlot
  title: string | null
  summary: string | null
  image_data: string | null
  created_by: number
  created_by_pseudo: string | null
  created_at: string | null
  updated_at: string | null
}

let _ensured = false

function assertSlot(slot: string): CircleSlot {
  if (slot === 'morning' || slot === 'evening') return slot
  throw Object.assign(new Error('slot invalide (morning|evening)'), { status: 400 })
}

function assertDay(day: string): string {
  const d = String(day ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw Object.assign(new Error('Jour invalide (YYYY-MM-DD)'), { status: 400 })
  }
  return d
}

function mapRow(r: RowDataPacket): CircleSession {
  return {
    id: Number(r.id),
    community_id: Number(r.community_id),
    day: String(r.day).slice(0, 10),
    slot: assertSlot(String(r.slot)),
    title: r.title != null ? String(r.title) : null,
    summary: r.summary != null ? String(r.summary) : null,
    image_data: r.image_data != null ? String(r.image_data) : null,
    created_by: Number(r.created_by),
    created_by_pseudo: r.created_by_pseudo != null ? String(r.created_by_pseudo) : null,
    created_at: r.created_at != null ? new Date(r.created_at).toISOString() : null,
    updated_at: r.updated_at != null ? new Date(r.updated_at).toISOString() : null,
  }
}

export async function ensureCircleJournalTables(): Promise<void> {
  if (_ensured || !isDbConfigured()) return
  const pool = getPool()
  const t = table('circle_sessions')
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${t} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      community_id INT NOT NULL,
      day DATE NOT NULL,
      slot VARCHAR(16) NOT NULL,
      title VARCHAR(255) DEFAULT NULL,
      summary TEXT DEFAULT NULL,
      image_data MEDIUMTEXT DEFAULT NULL,
      created_by INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_comm_day_slot (community_id, day, slot),
      KEY idx_comm_day (community_id, day)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  _ensured = true
}

export async function listCircleSessionsMonth(params: {
  communityId: number
  ym: string
}): Promise<CircleSession[]> {
  await ensureCircleJournalTables()
  const ym = String(params.ym ?? '').trim()
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    throw Object.assign(new Error('Mois invalide (YYYY-MM)'), { status: 400 })
  }
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  const start = `${ym}-01`
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const endExclusive = `${String(nextY).padStart(4, '0')}-${String(nextM).padStart(2, '0')}-01`

  const pool = getPool()
  const t = table('circle_sessions')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.community_id, DATE_FORMAT(s.day, '%Y-%m-%d') AS day, s.slot,
            s.title, s.summary,
            CASE WHEN s.image_data IS NULL OR s.image_data = '' THEN NULL ELSE '1' END AS has_image,
            s.image_data,
            s.created_by, s.created_at, s.updated_at,
            COALESCE(pm.meta_value, u.display_name, CONCAT('user_', s.created_by)) AS created_by_pseudo
     FROM ${t} s
     LEFT JOIN ${tUsers} u ON u.ID = s.created_by
     LEFT JOIN ${tMeta} pm ON pm.user_id = s.created_by AND pm.meta_key = 'mdl_pseudo'
     WHERE s.community_id = ? AND s.day >= ? AND s.day < ?
     ORDER BY s.day ASC, s.slot ASC`,
    [params.communityId, start, endExclusive]
  )
  return (rows ?? []).map(mapRow)
}

/** Pour la grille mois : sans image_data pour alléger. */
export async function listCircleSessionMarkers(params: {
  communityId: number
  ym: string
}): Promise<Array<{ day: string; slot: CircleSlot; id: number; has_image: boolean }>> {
  await ensureCircleJournalTables()
  const ym = String(params.ym ?? '').trim()
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    throw Object.assign(new Error('Mois invalide (YYYY-MM)'), { status: 400 })
  }
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  const start = `${ym}-01`
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const endExclusive = `${String(nextY).padStart(4, '0')}-${String(nextM).padStart(2, '0')}-01`
  const pool = getPool()
  const t = table('circle_sessions')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, DATE_FORMAT(day, '%Y-%m-%d') AS day, slot,
            (image_data IS NOT NULL AND image_data <> '') AS has_image
     FROM ${t}
     WHERE community_id = ? AND day >= ? AND day < ?`,
    [params.communityId, start, endExclusive]
  )
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    day: String(r.day).slice(0, 10),
    slot: assertSlot(String(r.slot)),
    has_image: Number(r.has_image) === 1,
  }))
}

export async function getCircleSession(params: {
  communityId: number
  day: string
  slot: CircleSlot
}): Promise<CircleSession | null> {
  await ensureCircleJournalTables()
  const day = assertDay(params.day)
  const slot = assertSlot(params.slot)
  const pool = getPool()
  const t = table('circle_sessions')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.*, DATE_FORMAT(s.day, '%Y-%m-%d') AS day,
            COALESCE(pm.meta_value, u.display_name, CONCAT('user_', s.created_by)) AS created_by_pseudo
     FROM ${t} s
     LEFT JOIN ${tUsers} u ON u.ID = s.created_by
     LEFT JOIN ${tMeta} pm ON pm.user_id = s.created_by AND pm.meta_key = 'mdl_pseudo'
     WHERE s.community_id = ? AND s.day = ? AND s.slot = ?
     LIMIT 1`,
    [params.communityId, day, slot]
  )
  if (!rows[0]) return null
  return mapRow(rows[0])
}

export async function upsertCircleSession(params: {
  communityId: number
  day: string
  slot: CircleSlot
  title?: string | null
  summary?: string | null
  image_data?: string | null
  userId: number
}): Promise<CircleSession> {
  await ensureCircleJournalTables()
  const day = assertDay(params.day)
  const slot = assertSlot(params.slot)
  const title = params.title != null ? String(params.title).trim().slice(0, 255) || null : null
  const summary = params.summary != null ? String(params.summary).trim().slice(0, 4000) || null : null
  let imageData = params.image_data != null ? String(params.image_data) : null
  if (imageData != null && imageData.length > 0) {
    if (!imageData.startsWith('data:image/')) {
      throw Object.assign(new Error('image_data doit être une data URL image'), { status: 400 })
    }
    if (imageData.length > 280_000) {
      throw Object.assign(new Error('Image trop lourde (max ~200 Ko)'), { status: 400 })
    }
  } else {
    imageData = null
  }

  const existing = await getCircleSession({
    communityId: params.communityId,
    day,
    slot,
  })

  if (!existing && !imageData) {
    throw Object.assign(new Error('Photo du tableau requise pour publier le créneau'), { status: 400 })
  }

  const pool = getPool()
  const t = table('circle_sessions')

  if (existing) {
    await pool.execute(
      `UPDATE ${t}
       SET title = COALESCE(?, title),
           summary = COALESCE(?, summary),
           image_data = COALESCE(?, image_data),
           updated_at = NOW()
       WHERE id = ?`,
      [title, summary, imageData, existing.id]
    )
  } else {
    await pool.execute(
      `INSERT INTO ${t} (community_id, day, slot, title, summary, image_data, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [params.communityId, day, slot, title, summary, imageData, params.userId]
    )
  }

  const saved = await getCircleSession({ communityId: params.communityId, day, slot })
  if (!saved) throw new Error('Échec enregistrement cercle')
  return saved
}

export async function deleteCircleSession(params: {
  communityId: number
  day: string
  slot: CircleSlot
}): Promise<void> {
  await ensureCircleJournalTables()
  const pool = getPool()
  const t = table('circle_sessions')
  const [res] = await pool.execute(
    `DELETE FROM ${t} WHERE community_id = ? AND day = ? AND slot = ?`,
    [params.communityId, assertDay(params.day), assertSlot(params.slot)]
  )
  if (!Number((res as ResultSetHeader).affectedRows ?? 0)) {
    throw Object.assign(new Error('Créneau introuvable'), { status: 404 })
  }
}
