/**
 * Annonces importantes du lieu (accueil — messages des organisateurs, hors événements).
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { ensureWallPublicColumn, parseWallPublic, wallPublicFromRow } from './wall-public'
import { canManageCommunityInContext, ensureCommunitiesTables, requireCommunityMembership, type CommunityRole } from './db-communities'

let _tablesEnsured = false

export type PlaceAnnouncementRow = {
  id: number
  community_id: number
  author_id: number
  title: string
  body: string
  image_data: string | null
  created_at: string
  updated_at: string | null
  author_pseudo: string
  author_avatar_emoji: string
  author_avatar: string | null
  wall_public: boolean
}

function normalizeImageData(img: unknown): string | null | undefined {
  if (img === undefined) return undefined
  if (img === null || img === '') return null
  if (typeof img !== 'string') return undefined
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/i.test(img)) return undefined
  const raw = Buffer.from(img.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  if (raw.length > 500_000) {
    throw Object.assign(new Error('Image trop lourde (500 Ko max.)'), { status: 400 })
  }
  return img
}

export async function ensurePlaceAnnouncementTables(): Promise<void> {
  if (_tablesEnsured || !isDbConfigured()) return
  await ensureCommunitiesTables()
  const pool = getPool()
  const t = table('mandala_place_announcements')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${t} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      community_id INT NOT NULL,
      author_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      image_data MEDIUMTEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_community_created (community_id, created_at DESC),
      KEY idx_author (author_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await ensureWallPublicColumn(pool, t)
  _tablesEnsured = true
}

export function canManagePlaceAnnouncements(role: CommunityRole, isAppSiteManager = false): boolean {
  return canManageCommunityInContext(role, isAppSiteManager)
}

async function getAnnouncementMeta(
  announcementId: number
): Promise<{ id: number; community_id: number; author_id: number } | null> {
  await ensurePlaceAnnouncementTables()
  const pool = getPool()
  const t = table('mandala_place_announcements')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, community_id, author_id FROM ${t} WHERE id = ? LIMIT 1`,
    [announcementId]
  )
  const r = rows[0]
  if (!r) return null
  return {
    id: Number(r.id),
    community_id: Number(r.community_id),
    author_id: Number(r.author_id),
  }
}

async function requireManageAnnouncements(
  userId: number,
  communityId: number,
  isAppSiteManager: boolean
): Promise<void> {
  let role: CommunityRole = 'member'
  try {
    role = await requireCommunityMembership(userId, communityId)
  } catch {
    throw Object.assign(new Error('Accès refusé'), { status: 403 })
  }
  if (!canManagePlaceAnnouncements(role, isAppSiteManager)) {
    throw Object.assign(new Error('Droits organisateur requis'), { status: 403 })
  }
}

function mapAnnouncementRow(r: RowDataPacket): PlaceAnnouncementRow {
  return {
    id: Number(r.id),
    community_id: Number(r.community_id),
    author_id: Number(r.author_id),
    title: String(r.title ?? ''),
    body: String(r.body ?? ''),
    image_data: r.image_data ? String(r.image_data) : null,
    created_at: r.created_at ? String(r.created_at) : new Date().toISOString(),
    updated_at: r.updated_at ? String(r.updated_at) : null,
    author_pseudo: String(r.author_pseudo ?? ''),
    author_avatar_emoji: String(r.author_avatar_emoji || '🌸'),
    author_avatar: r.author_avatar ? String(r.author_avatar) : null,
    wall_public: wallPublicFromRow(r as Record<string, unknown>),
  }
}

const ANNOUNCEMENT_SELECT = `
  SELECT a.id, a.community_id, a.author_id, a.title, a.body, a.image_data, a.created_at, a.updated_at, a.wall_public,
         COALESCE(pm.meta_value, u.display_name, CONCAT('user_', a.author_id)) AS author_pseudo,
         COALESCE(em.meta_value, '🌸') AS author_avatar_emoji,
         COALESCE(am.meta_value, '') AS author_avatar
  FROM %TABLE% a
  JOIN ${table('users')} u ON u.ID = a.author_id
  LEFT JOIN ${table('usermeta')} pm ON pm.user_id = a.author_id AND pm.meta_key = 'mdl_pseudo'
  LEFT JOIN ${table('usermeta')} em ON em.user_id = a.author_id AND em.meta_key = 'mdl_avatar_emoji'
  LEFT JOIN ${table('usermeta')} am ON am.user_id = a.author_id AND am.meta_key = 'mdl_avatar'
`

export async function listPlaceAnnouncements(
  communityId: number,
  limit = 20
): Promise<PlaceAnnouncementRow[]> {
  await ensurePlaceAnnouncementTables()
  const pool = getPool()
  const t = table('mandala_place_announcements')
  const safeLimit = Math.min(Math.max(1, limit), 50)
  const sql = ANNOUNCEMENT_SELECT.replace('%TABLE%', t) + ` WHERE a.community_id = ? ORDER BY a.created_at DESC LIMIT ${safeLimit}`

  const [rows] = await pool.execute<RowDataPacket[]>(sql, [communityId])
  return (rows ?? []).map(mapAnnouncementRow)
}

export async function getPlaceAnnouncementById(id: number): Promise<PlaceAnnouncementRow | null> {
  await ensurePlaceAnnouncementTables()
  const pool = getPool()
  const t = table('mandala_place_announcements')
  const sql = ANNOUNCEMENT_SELECT.replace('%TABLE%', t) + ` WHERE a.id = ? LIMIT 1`
  const [rows] = await pool.execute<RowDataPacket[]>(sql, [id])
  const r = rows[0]
  return r ? mapAnnouncementRow(r) : null
}

export async function createPlaceAnnouncement(params: {
  communityId: number
  authorId: number
  title: string
  body: string
  image_data?: string | null
  wall_public?: boolean
  isAppSiteManager: boolean
}): Promise<PlaceAnnouncementRow> {
  await requireManageAnnouncements(params.authorId, params.communityId, params.isAppSiteManager)
  const title = String(params.title ?? '').trim()
  const body = String(params.body ?? '').trim()
  if (!title) throw Object.assign(new Error('Le titre est requis'), { status: 400 })
  if (!body) throw Object.assign(new Error('Le message est requis'), { status: 400 })
  if (title.length > 255) throw Object.assign(new Error('Titre trop long'), { status: 400 })
  if (body.length > 8000) throw Object.assign(new Error('Message trop long'), { status: 400 })

  const image = normalizeImageData(params.image_data ?? null)
  const wallPublic = parseWallPublic(params.wall_public) ? 1 : 0
  await ensurePlaceAnnouncementTables()
  const pool = getPool()
  const t = table('mandala_place_announcements')
  const [result] = await pool.execute(
    `INSERT INTO ${t} (community_id, author_id, title, body, image_data, wall_public) VALUES (?, ?, ?, ?, ?, ?)`,
    [params.communityId, params.authorId, title, body, image ?? null, wallPublic]
  )
  const id = Number((result as { insertId?: number }).insertId)
  const created = await getPlaceAnnouncementById(id)
  if (!created) throw new Error('Impossible de récupérer l\'annonce créée')
  return created
}

export async function updatePlaceAnnouncement(params: {
  announcementId: number
  userId: number
  isAppSiteManager: boolean
  title?: string
  body?: string
  image_data?: string | null
  wall_public?: boolean
}): Promise<PlaceAnnouncementRow> {
  const meta = await getAnnouncementMeta(params.announcementId)
  if (!meta) throw Object.assign(new Error('Annonce introuvable'), { status: 404 })
  await requireManageAnnouncements(params.userId, meta.community_id, params.isAppSiteManager)

  const fields: string[] = []
  const values: unknown[] = []
  if (params.title !== undefined) {
    const title = String(params.title).trim()
    if (!title) throw Object.assign(new Error('Le titre est requis'), { status: 400 })
    fields.push('title = ?')
    values.push(title)
  }
  if (params.body !== undefined) {
    const body = String(params.body).trim()
    if (!body) throw Object.assign(new Error('Le message est requis'), { status: 400 })
    fields.push('body = ?')
    values.push(body)
  }
  const image = normalizeImageData(params.image_data)
  if (image !== undefined) {
    fields.push('image_data = ?')
    values.push(image)
  }
  if (params.wall_public !== undefined) {
    fields.push('wall_public = ?')
    values.push(parseWallPublic(params.wall_public) ? 1 : 0)
  }
  if (!fields.length) {
    const row = await getPlaceAnnouncementById(params.announcementId)
    if (!row) throw Object.assign(new Error('Annonce introuvable'), { status: 404 })
    return row
  }

  const pool = getPool()
  const t = table('mandala_place_announcements')
  await exec(pool, `UPDATE ${t} SET ${fields.join(', ')} WHERE id = ?`, [...values, params.announcementId])
  const updated = await getPlaceAnnouncementById(params.announcementId)
  if (!updated) throw Object.assign(new Error('Annonce introuvable'), { status: 404 })
  return updated
}

export async function deletePlaceAnnouncement(params: {
  announcementId: number
  userId: number
  isAppSiteManager: boolean
}): Promise<void> {
  const meta = await getAnnouncementMeta(params.announcementId)
  if (!meta) throw Object.assign(new Error('Annonce introuvable'), { status: 404 })
  await requireManageAnnouncements(params.userId, meta.community_id, params.isAppSiteManager)
  const pool = getPool()
  const t = table('mandala_place_announcements')
  await pool.execute(`DELETE FROM ${t} WHERE id = ?`, [params.announcementId])
}
