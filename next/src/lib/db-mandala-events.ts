/**
 * Événements Mandala — par communauté (phases, équipe, tâches).
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import {
  canOrganizeCommunityEvents,
  getCommunityBySlug,
  requireCommunityMembership,
  type CommunityRole,
} from './db-communities'
import { assertEndsAfterStarts } from './event-dates'
import { normalizeDbDateTime } from './format-datetime'

import { ensureWallPublicColumn, parseWallPublic, wallPublicFromRow } from './wall-public'

export type { EventPhase } from './event-constants'

export type EventStatus = 'draft' | 'published' | 'cancelled'

export type EventRecord = {
  id: number
  community_id: number
  title: string
  description: string | null
  location: string | null
  starts_at: string | null
  ends_at: string | null
  phase: EventPhase
  status: EventStatus
  created_by: number
  created_at: string | null
  cover_image: string | null
  wall_public: boolean
}

export type EventMediaRow = {
  id: number
  image_data: string
  caption: string | null
  sort_order: number
}

export type EventStaffRow = {
  id: number
  user_id: number
  role: string
  note: string | null
  pseudo: string
  display_name: string
}

export type EventTaskRow = {
  id: number
  phase: EventPhase
  title: string
  is_done: boolean
  assignee_user_id: number | null
  assignee_pseudo: string | null
  sort_order: number
}

let _ensured = false

export async function ensureEventsTables(): Promise<void> {
  if (_ensured || !isDbConfigured()) return
  const pool = getPool()
  const tE = table('events')
  const tS = table('event_staff')
  const tT = table('event_tasks')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      community_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      location VARCHAR(255) DEFAULT NULL,
      starts_at DATETIME DEFAULT NULL,
      ends_at DATETIME DEFAULT NULL,
      phase VARCHAR(24) NOT NULL DEFAULT 'preparation',
      status VARCHAR(24) NOT NULL DEFAULT 'draft',
      created_by INT NOT NULL,
      cover_image MEDIUMTEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_community_starts (community_id, starts_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  try {
    await exec(pool, `ALTER TABLE ${tE} ADD COLUMN cover_image MEDIUMTEXT NULL`)
  } catch {
    /* column exists */
  }
  await ensureWallPublicColumn(pool, tE)
  const tM = table('event_media')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tM} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      image_data MEDIUMTEXT NOT NULL,
      caption VARCHAR(255) DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      uploaded_by INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_event (event_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tS} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      user_id INT NOT NULL,
      role VARCHAR(64) NOT NULL DEFAULT 'volunteer',
      note VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_event_user (event_id, user_id),
      KEY idx_event (event_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tT} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      phase VARCHAR(24) NOT NULL DEFAULT 'preparation',
      title VARCHAR(255) NOT NULL,
      is_done TINYINT(1) NOT NULL DEFAULT 0,
      assignee_user_id INT DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_event_phase (event_id, phase, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  _ensured = true
}

function canManageEvents(role: CommunityRole, isAppAdmin: boolean): boolean {
  return isAppAdmin || canOrganizeCommunityEvents(role)
}

async function getEventRow(eventId: number): Promise<EventRecord | null> {
  await ensureEventsTables()
  const pool = getPool()
  const tE = table('events')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, community_id, title, description, location, starts_at, ends_at, phase, status, created_by, created_at, cover_image, wall_public
     FROM ${tE} WHERE id = ? LIMIT 1`,
    [eventId]
  )
  const r = rows[0]
  if (!r) return null
  return mapEvent(r)
}

function mapEvent(r: RowDataPacket): EventRecord {
  return {
    id: Number(r.id),
    community_id: Number(r.community_id),
    title: String(r.title),
    description: r.description != null ? String(r.description) : null,
    location: r.location != null ? String(r.location) : null,
    starts_at: normalizeDbDateTime(r.starts_at),
    ends_at: normalizeDbDateTime(r.ends_at),
    phase: String(r.phase) as EventPhase,
    status: String(r.status) as EventStatus,
    created_by: Number(r.created_by),
    created_at: normalizeDbDateTime(r.created_at),
    cover_image: r.cover_image ? String(r.cover_image) : null,
    wall_public: wallPublicFromRow(r as Record<string, unknown>),
  }
}

async function requireEventManager(
  userId: number,
  communityId: number,
  isAppAdmin: boolean,
  eventCreatorId?: number
): Promise<CommunityRole> {
  const role = await requireCommunityMembership(userId, communityId)
  const isCreator = eventCreatorId != null && eventCreatorId === userId
  if (!canManageEvents(role, isAppAdmin) && !isCreator) {
    throw new Error('Droits organisateur requis pour cette action')
  }
  return role
}

export type EventListItem = EventRecord & {
  media_count: number
}

export async function listEventsForCommunity(communityId: number): Promise<EventListItem[]> {
  await ensureEventsTables()
  const pool = getPool()
  const tE = table('events')
  const tM = table('event_media')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT e.id, e.community_id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.phase, e.status, e.created_by, e.created_at, e.cover_image,
            COALESCE(mc.cnt, 0) AS media_count
     FROM ${tE} e
     LEFT JOIN (
       SELECT event_id, COUNT(*) AS cnt FROM ${tM} GROUP BY event_id
     ) mc ON mc.event_id = e.id
     WHERE e.community_id = ? AND e.status != 'cancelled'
     ORDER BY COALESCE(e.starts_at, e.created_at) ASC`,
    [communityId]
  )
  return (rows ?? []).map((r) => ({
    ...mapEvent(r),
    media_count: Number(r.media_count ?? 0),
  }))
}

/** Événements dont starts_at est dans [from, to) (DATETIME strings). */
export async function listEventsForCommunityBetween(
  communityId: number,
  fromDateTime: string,
  toDateTime: string
): Promise<EventRecord[]> {
  await ensureEventsTables()
  const pool = getPool()
  const tE = table('events')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, community_id, title, description, location, starts_at, ends_at, phase, status, created_by, created_at, cover_image, wall_public
     FROM ${tE}
     WHERE community_id = ? AND status != 'cancelled'
       AND starts_at IS NOT NULL
       AND starts_at < ?
       AND (
         (ends_at IS NOT NULL AND ends_at >= ?)
         OR (ends_at IS NULL AND starts_at >= ?)
       )
     ORDER BY starts_at ASC, id ASC`,
    [communityId, toDateTime, fromDateTime, fromDateTime]
  )
  return (rows ?? []).map(mapEvent)
}

export async function getEventDetail(
  eventId: number,
  userId: number,
  isAppAdmin: boolean
): Promise<{
  event: EventRecord
  staff: EventStaffRow[]
  tasks: EventTaskRow[]
  media: EventMediaRow[]
  can_manage: boolean
}> {
  const event = await getEventRow(eventId)
  if (!event) throw new Error('Événement introuvable')

  let role: CommunityRole = 'member'
  try {
    role = await requireCommunityMembership(userId, event.community_id)
  } catch {
    throw new Error('Accès communauté refusé')
  }

  const pool = getPool()
  const tS = table('event_staff')
  const tT = table('event_tasks')
  const tUsers = table('users')
  const tMeta = table('usermeta')

  const [staffRows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.user_id, s.role, s.note,
            COALESCE(p.meta_value, '') AS pseudo,
            COALESCE(u.display_name, '') AS display_name
     FROM ${tS} s
     JOIN ${tUsers} u ON u.ID = s.user_id
     LEFT JOIN ${tMeta} p ON p.user_id = s.user_id AND p.meta_key = 'mdl_pseudo'
     WHERE s.event_id = ?
     ORDER BY s.id ASC`,
    [eventId]
  )

  const [taskRows] = await pool.execute<RowDataPacket[]>(
    `SELECT t.id, t.phase, t.title, t.is_done, t.assignee_user_id, t.sort_order,
            COALESCE(pm.meta_value, '') AS assignee_pseudo
     FROM ${tT} t
     LEFT JOIN ${tMeta} pm ON pm.user_id = t.assignee_user_id AND pm.meta_key = 'mdl_pseudo'
     WHERE t.event_id = ?
     ORDER BY t.phase ASC, t.sort_order ASC, t.id ASC`,
    [eventId]
  )

  const tMedia = table('event_media')
  const [mediaRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, image_data, caption, sort_order FROM ${tMedia} WHERE event_id = ? ORDER BY sort_order ASC, id ASC`,
    [eventId]
  )

  const isCreator = event.created_by === userId

  return {
    event,
    staff: (staffRows ?? []).map((r) => ({
      id: Number(r.id),
      user_id: Number(r.user_id),
      role: String(r.role),
      note: r.note != null ? String(r.note) : null,
      pseudo: String(r.pseudo || r.display_name || `user_${r.user_id}`),
      display_name: String(r.display_name || ''),
    })),
    tasks: (taskRows ?? []).map((r) => ({
      id: Number(r.id),
      phase: String(r.phase) as EventPhase,
      title: String(r.title),
      is_done: Number(r.is_done) === 1,
      assignee_user_id: r.assignee_user_id != null ? Number(r.assignee_user_id) : null,
      assignee_pseudo: r.assignee_pseudo ? String(r.assignee_pseudo) : null,
      sort_order: Number(r.sort_order ?? 0),
    })),
    media: (mediaRows ?? []).map((r) => ({
      id: Number(r.id),
      image_data: String(r.image_data),
      caption: r.caption != null ? String(r.caption) : null,
      sort_order: Number(r.sort_order ?? 0),
    })),
    can_manage: canManageEvents(role, isAppAdmin) || isCreator,
  }
}

export async function createEvent(params: {
  userId: number
  communitySlug: string
  isAppAdmin: boolean
  title: string
  description?: string
  location?: string
  starts_at?: string
  ends_at?: string
  phase?: EventPhase
}): Promise<EventRecord> {
  const community = await getCommunityBySlug(params.communitySlug)
  if (!community) throw new Error('Communauté introuvable')
  const role = await requireCommunityMembership(params.userId, community.id)
  if (!canManageEvents(role, params.isAppAdmin)) {
    throw new Error('Droits organisateur requis pour créer un événement')
  }

  const title = params.title?.trim()
  if (!title) throw new Error('Titre requis')
  assertEndsAfterStarts(params.starts_at, params.ends_at)

  await ensureEventsTables()
  const pool = getPool()
  const tE = table('events')
  await pool.execute(
    `INSERT INTO ${tE} (community_id, title, description, location, starts_at, ends_at, phase, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
    [
      community.id,
      title,
      params.description?.trim() || null,
      params.location?.trim() || null,
      params.starts_at || null,
      params.ends_at || null,
      params.phase || 'preparation',
      params.userId,
    ]
  )
  const [ins] = await pool.execute<RowDataPacket[]>(`SELECT LAST_INSERT_ID() as id`)
  const id = Number(ins[0]?.id ?? 0)
  if (!id) throw new Error('Création événement échouée')
  return (await getEventRow(id))!
}

export async function updateEvent(params: {
  userId: number
  eventId: number
  isAppAdmin: boolean
  patch: Record<string, unknown>
}): Promise<EventRecord> {
  const event = await getEventRow(params.eventId)
  if (!event) throw new Error('Événement introuvable')
  await requireEventManager(params.userId, event.community_id, params.isAppAdmin, event.created_by)

  const p = params.patch
  const nextStarts =
    p.starts_at !== undefined ? (p.starts_at ? String(p.starts_at) : null) : event.starts_at
  const nextEnds = p.ends_at !== undefined ? (p.ends_at ? String(p.ends_at) : null) : event.ends_at
  assertEndsAfterStarts(nextStarts, nextEnds)

  const fields: string[] = []
  const values: unknown[] = []

  if (p.title !== undefined) {
    fields.push('title = ?')
    values.push(String(p.title).trim())
  }
  if (p.description !== undefined) {
    fields.push('description = ?')
    values.push(String(p.description ?? '').trim() || null)
  }
  if (p.location !== undefined) {
    fields.push('location = ?')
    values.push(String(p.location ?? '').trim() || null)
  }
  if (p.starts_at !== undefined) {
    fields.push('starts_at = ?')
    values.push(p.starts_at || null)
  }
  if (p.ends_at !== undefined) {
    fields.push('ends_at = ?')
    values.push(p.ends_at || null)
  }
  if (p.phase !== undefined) {
    fields.push('phase = ?')
    values.push(String(p.phase))
  }
  if (p.status !== undefined) {
    fields.push('status = ?')
    values.push(String(p.status))
  }
  if (p.cover_image !== undefined) {
    const img = p.cover_image
    if (img === null || img === '') {
      fields.push('cover_image = ?')
      values.push(null)
    } else if (typeof img === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/i.test(img)) {
      const raw = Buffer.from(String(img).replace(/^data:image\/\w+;base64,/, ''), 'base64')
      if (raw.length <= 500000) {
        fields.push('cover_image = ?')
        values.push(img)
      }
    }
  }
  if (p.wall_public !== undefined) {
    fields.push('wall_public = ?')
    values.push(parseWallPublic(p.wall_public) ? 1 : 0)
  }

  if (fields.length === 0) return event

  const pool = getPool()
  const tE = table('events')
  await exec(pool, `UPDATE ${tE} SET ${fields.join(', ')} WHERE id = ?`, [...values, params.eventId])
  return (await getEventRow(params.eventId))!
}

export async function addEventStaff(params: {
  userId: number
  eventId: number
  targetUserId: number
  role: string
  note?: string
  isAppAdmin: boolean
}): Promise<void> {
  const event = await getEventRow(params.eventId)
  if (!event) throw new Error('Événement introuvable')
  await requireEventManager(params.userId, event.community_id, params.isAppAdmin, event.created_by)
  if (params.targetUserId <= 0) throw new Error('Utilisateur invalide')

  await requireCommunityMembership(params.targetUserId, event.community_id)

  const pool = getPool()
  const tS = table('event_staff')
  await pool.execute(
    `INSERT INTO ${tS} (event_id, user_id, role, note) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE role = VALUES(role), note = VALUES(note)`,
    [params.eventId, params.targetUserId, params.role || 'volunteer', params.note?.trim() || null]
  )
}

export async function removeEventStaff(params: {
  userId: number
  eventId: number
  targetUserId: number
  isAppAdmin: boolean
}): Promise<void> {
  const event = await getEventRow(params.eventId)
  if (!event) throw new Error('Événement introuvable')
  await requireEventManager(params.userId, event.community_id, params.isAppAdmin, event.created_by)

  const pool = getPool()
  const tS = table('event_staff')
  await pool.execute(`DELETE FROM ${tS} WHERE event_id = ? AND user_id = ?`, [
    params.eventId,
    params.targetUserId,
  ])
}

export async function addEventTask(params: {
  userId: number
  eventId: number
  title: string
  phase?: EventPhase
  isAppAdmin: boolean
}): Promise<number> {
  const event = await getEventRow(params.eventId)
  if (!event) throw new Error('Événement introuvable')
  await requireEventManager(params.userId, event.community_id, params.isAppAdmin, event.created_by)
  const title = params.title?.trim()
  if (!title) throw new Error('Titre de tâche requis')

  const pool = getPool()
  const tT = table('event_tasks')
  await pool.execute(
    `INSERT INTO ${tT} (event_id, phase, title, sort_order) VALUES (?, ?, ?, 0)`,
    [params.eventId, params.phase || event.phase, title]
  )
  const [ins] = await pool.execute<RowDataPacket[]>(`SELECT LAST_INSERT_ID() as id`)
  return Number(ins[0]?.id ?? 0)
}

export async function toggleEventTask(params: {
  userId: number
  eventId: number
  taskId: number
  is_done: boolean
  isAppAdmin: boolean
}): Promise<void> {
  const event = await getEventRow(params.eventId)
  if (!event) throw new Error('Événement introuvable')
  await requireEventManager(params.userId, event.community_id, params.isAppAdmin, event.created_by)

  const pool = getPool()
  const tT = table('event_tasks')
  await pool.execute(`UPDATE ${tT} SET is_done = ? WHERE id = ? AND event_id = ?`, [
    params.is_done ? 1 : 0,
    params.taskId,
    params.eventId,
  ])
}

/** Membres de la communauté (pour picker équipe) */
export async function listCommunityMembersForPicker(communityId: number): Promise<
  Array<{ user_id: number; pseudo: string; display_name: string }>
> {
  const pool = getPool()
  const tM = table('mandala_community_members')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID AS user_id,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', u.ID)) AS pseudo,
            COALESCE(u.display_name, '') AS display_name
     FROM ${tM} m
     JOIN ${tUsers} u ON u.ID = m.user_id
     LEFT JOIN ${tMeta} p ON p.user_id = u.ID AND p.meta_key = 'mdl_pseudo'
     WHERE m.community_id = ?
     ORDER BY pseudo ASC`,
    [communityId]
  )
  return (rows ?? []).map((r) => ({
    user_id: Number(r.user_id),
    pseudo: String(r.pseudo),
    display_name: String(r.display_name),
  }))
}

export async function addEventMedia(params: {
  userId: number
  eventId: number
  image_data: string
  caption?: string
  isAppAdmin: boolean
}): Promise<number> {
  const event = await getEventRow(params.eventId)
  if (!event) throw new Error('Événement introuvable')
  await requireEventManager(params.userId, event.community_id, params.isAppAdmin, event.created_by)
  const img = params.image_data
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/i.test(img)) {
    throw new Error('Image invalide')
  }
  const raw = Buffer.from(img.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  if (raw.length > 500000) throw new Error('Image trop volumineuse (max 500 Ko)')

  const pool = getPool()
  const tM = table('event_media')
  await pool.execute(
    `INSERT INTO ${tM} (event_id, image_data, caption, uploaded_by) VALUES (?, ?, ?, ?)`,
    [params.eventId, img, params.caption?.trim() || null, params.userId]
  )
  const [ins] = await pool.execute<RowDataPacket[]>(`SELECT LAST_INSERT_ID() as id`)
  return Number(ins[0]?.id ?? 0)
}

export async function removeEventMedia(params: {
  userId: number
  eventId: number
  mediaId: number
  isAppAdmin: boolean
}): Promise<void> {
  const event = await getEventRow(params.eventId)
  if (!event) throw new Error('Événement introuvable')
  await requireEventManager(params.userId, event.community_id, params.isAppAdmin, event.created_by)
  const pool = getPool()
  const tM = table('event_media')
  await pool.execute(`DELETE FROM ${tM} WHERE id = ? AND event_id = ?`, [params.mediaId, params.eventId])
}

export async function seedDemoEventsIfEmpty(communityId: number, createdBy: number): Promise<void> {
  await ensureEventsTables()
  const pool = getPool()
  const tE = table('events')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as c FROM ${tE} WHERE community_id = ?`,
    [communityId]
  )
  if (Number(rows[0]?.c ?? 0) > 0) return

  const demos = [
    {
      title: 'Accueil & méditation',
      description: 'Préparation du lieu, accueil des participants, méditation d’ouverture.',
      phase: 'preparation',
      location: 'Salle principale',
    },
    {
      title: 'Journée portes ouvertes',
      description: 'Visites, ateliers, échanges avec les visiteurs.',
      phase: 'day',
      location: 'Jardin & bâtiment',
    },
    {
      title: 'Bilan & rangement',
      description: 'Débrief équipe, rangement, clôture logistique.',
      phase: 'after',
      location: 'Salle commune',
    },
  ]

  for (const d of demos) {
    await pool.execute(
      `INSERT INTO ${tE} (community_id, title, description, location, phase, status, created_by, starts_at)
       VALUES (?, ?, ?, ?, ?, 'published', ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [communityId, d.title, d.description, d.location, d.phase, createdBy]
    )
  }
}
