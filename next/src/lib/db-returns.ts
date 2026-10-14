/**
 * Retours après une présence déclarée.
 * Lieu et événement : une fois la date passée.
 * Moment entre deux personnes : la personne désignée accepte, puis chaque côté peut écrire.
 * Un retour publié reste si l'auteur quitte le lieu.
 */
import type { RowDataPacket } from 'mysql2'
import { ensureOnce, exec, getPool, isDbConfigured, table } from './db'
import { ensureCalendarTables } from './db-calendar'
import {
  ensureCommunitiesTables,
  getCommunityBySlug,
  type CommunityRecord,
} from './db-communities'
import { ensureEventsTables } from './db-mandala-events'
import { isCommunityManagerRole } from './community-role-labels'
import { createNotification } from './db-notifications'

const PAIR_DAYS = 14
const EDIT_HOURS = 48
const MIN_TEXT = 20
const MAX_BODY = 1000
const AVERAGE_FROM = 3

export type ReturnTarget = 'place' | 'event' | 'accompaniment'

export type ReturnScores = {
  clarity: number
  frame: number
  quality: number
  recommend: boolean
  body: string
}

export type ReturnSummary = {
  count: number
  removed_count: number
  show_average: boolean
  clarity: number | null
  frame: number | null
  quality: number | null
  recommend_yes: number
}

export type ReturnItem = {
  id: number
  target_type: ReturnTarget
  occasion_label: string
  occasion_date: string
  clarity: number
  frame: number
  quality: number
  recommend: boolean
  body: string
  author_name: string
  is_mine: boolean
  can_edit: boolean
  can_reply: boolean
  status: 'published' | 'pending_pair'
  pending_note: string | null
  reply_body: string | null
  reply_name: string | null
  created_at: string
}

export type WriteSlot = {
  kind: 'place' | 'event' | 'accompaniment'
  community_slug: string
  community_name: string
  occasion_date: string
  occasion_label: string
  event_id: number
  accompaniment_id: number
  other_name: string | null
}

export type ReturnsPage = {
  summary: ReturnSummary
  items: ReturnItem[]
  event_items: ReturnItem[]
  write_slots: WriteSlot[]
  blocked_reason: string | null
  can_alert: boolean
  returns_open: boolean
}

export type AccompanimentCard = {
  id: number
  status: 'pending' | 'accepted' | 'declined'
  community_slug: string
  community_name: string
  occasion_date: string
  occasion_label: string
  other_name: string
  direction: 'incoming' | 'outgoing'
  can_write: boolean
}

export type DesignateSlot = {
  community_slug: string
  community_name: string
  occasion_date: string
  occasion_label: string
  event_id: number
}

function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status })
}

function todayParis(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())
}

function formatFrDay(day: string): string {
  const [y, m, d] = day.split('-').map((n) => parseInt(n, 10))
  if (!y || !m || !d) return day
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)))
}

function presenceLabel(day: string): string {
  return `Présence du ${formatFrDay(day)}`
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function emptySummary(removed = 0): ReturnSummary {
  return {
    count: 0,
    removed_count: removed,
    show_average: false,
    clarity: null,
    frame: null,
    quality: null,
    recommend_yes: 0,
  }
}

function summarize(items: ReturnItem[], removed: number): ReturnSummary {
  if (items.length < AVERAGE_FROM) {
    return { ...emptySummary(removed), count: items.length }
  }
  const clarity = items.reduce((s, i) => s + i.clarity, 0) / items.length
  const frame = items.reduce((s, i) => s + i.frame, 0) / items.length
  const quality = items.reduce((s, i) => s + i.quality, 0) / items.length
  return {
    count: items.length,
    removed_count: removed,
    show_average: true,
    clarity: round1(clarity),
    frame: round1(frame),
    quality: round1(quality),
    recommend_yes: items.filter((i) => i.recommend).length,
  }
}

export function assertScores(input: ReturnScores): string {
  for (const n of [input.clarity, input.frame, input.quality]) {
    if (!Number.isInteger(n) || n < 1 || n > 5) fail(400, 'Chaque critère va de 1 à 5')
  }
  const text = input.body.trim()
  if (text.length > MAX_BODY) fail(400, 'Le texte est trop long')
  const needsText = !input.recommend || input.clarity < 4 || input.frame < 4 || input.quality < 4
  if (needsText && text.length < MIN_TEXT) {
    fail(400, 'Quelques mots sont demandés quand un critère est bas ou que vous ne recommandez pas')
  }
  return text
}

export async function ensureReturnTables(): Promise<void> {
  if (!isDbConfigured()) return
  return ensureOnce('returns-v1', async () => {
    await ensureCommunitiesTables()
    await ensureCalendarTables()
    await ensureEventsTables()
    const pool = getPool()
    await exec(
      pool,
      `CREATE TABLE IF NOT EXISTS ${table('return_opt_ins')} (
        user_id INT NOT NULL PRIMARY KEY,
        is_open TINYINT(1) NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )
    await exec(
      pool,
      `CREATE TABLE IF NOT EXISTS ${table('accompaniments')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        community_id INT NOT NULL,
        event_id INT NOT NULL DEFAULT 0,
        occasion_date DATE NOT NULL,
        occasion_label VARCHAR(200) NOT NULL,
        beneficiary_user_id INT NOT NULL,
        companion_user_id INT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        responded_at DATETIME NULL,
        UNIQUE KEY uk_pair_day (beneficiary_user_id, companion_user_id, community_id, event_id, occasion_date),
        KEY idx_companion_status (companion_user_id, status),
        KEY idx_beneficiary (beneficiary_user_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )
    await exec(
      pool,
      `CREATE TABLE IF NOT EXISTS ${table('returns')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        author_id INT NOT NULL,
        target_type VARCHAR(16) NOT NULL,
        community_id INT NOT NULL,
        event_id INT NOT NULL DEFAULT 0,
        accompaniment_id INT NOT NULL DEFAULT 0,
        subject_user_id INT NOT NULL DEFAULT 0,
        occasion_date DATE NOT NULL,
        occasion_label VARCHAR(200) NOT NULL,
        clarity TINYINT NOT NULL,
        frame TINYINT NOT NULL,
        quality TINYINT NOT NULL,
        recommend TINYINT(1) NOT NULL,
        body VARCHAR(1000) NOT NULL DEFAULT '',
        status VARCHAR(16) NOT NULL DEFAULT 'published',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL,
        reply_body VARCHAR(1000) NULL,
        reply_at DATETIME NULL,
        reply_user_id INT NULL,
        UNIQUE KEY uk_one (author_id, target_type, community_id, event_id, accompaniment_id, occasion_date),
        KEY idx_place (community_id, target_type, status),
        KEY idx_event (event_id, status),
        KEY idx_subject (subject_user_id, status),
        KEY idx_accomp (accompaniment_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )
    await exec(
      pool,
      `CREATE TABLE IF NOT EXISTS ${table('return_reports')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        return_id INT NOT NULL,
        reporter_id INT NOT NULL,
        reason VARCHAR(500) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_status (status, created_at),
        KEY idx_return (return_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )
    await exec(
      pool,
      `CREATE TABLE IF NOT EXISTS ${table('frame_alerts')} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        community_id INT NOT NULL,
        about_user_id INT NOT NULL DEFAULT 0,
        message VARCHAR(2000) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_status (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )
  })
}

async function publishDuePairs(): Promise<void> {
  const pool = getPool()
  const t = table('returns')
  const [due] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id
     FROM ${t} r
     WHERE r.status = 'pending_pair'
       AND (
         r.created_at < DATE_SUB(NOW(), INTERVAL ${PAIR_DAYS} DAY)
         OR EXISTS (
           SELECT 1 FROM ${t} o
           WHERE o.accompaniment_id = r.accompaniment_id
             AND o.accompaniment_id > 0
             AND o.author_id <> r.author_id
             AND o.status IN ('pending_pair', 'published')
         )
       )`
  )
  const ids = (due ?? []).map((row) => Number(row.id)).filter((id) => id > 0)
  if (!ids.length) return
  const placeholders = ids.map(() => '?').join(',')
  const [subjects] = await pool.execute<RowDataPacket[]>(
    `SELECT subject_user_id, occasion_label, author_id FROM ${t}
     WHERE id IN (${placeholders}) AND subject_user_id > 0`,
    ids
  )
  await exec(pool, `UPDATE ${t} SET status = 'published' WHERE id IN (${placeholders})`, ids)
  for (const row of subjects ?? []) {
    const subjectId = Number(row.subject_user_id)
    if (!subjectId) continue
    await notifyUser(
      subjectId,
      'Nouveau retour',
      `Un retour est visible (${String(row.occasion_label)}).`,
      Number(row.author_id) || null
    )
  }
}

type JoinedReturn = RowDataPacket & {
  id: number
  author_id: number
  target_type: string
  community_id: number
  event_id: number
  accompaniment_id: number
  subject_user_id: number
  occasion_label: string
  occasion_day: string
  clarity: number
  frame: number
  quality: number
  recommend: number
  body: string
  status: string
  created_label: string
  reply_body: string | null
  reply_user_id: number | null
  place_public: number
  author_exists: number | null
  author_still_member: number | null
  author_pseudo: string | null
  reply_exists: number | null
  reply_still_member: number | null
  reply_pseudo: string | null
  wall_public: number | null
  event_status: string | null
  editable: number
}

const RETURN_SELECT = `
  r.id, r.author_id, r.target_type, r.community_id, r.event_id, r.accompaniment_id, r.subject_user_id,
  r.occasion_label, DATE_FORMAT(r.occasion_date, '%Y-%m-%d') AS occasion_day,
  r.clarity, r.frame, r.quality, r.recommend, r.body, r.status,
  DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_label,
  r.reply_body, r.reply_user_id,
  COALESCE(c.profile_public, 0) AS place_public,
  u.ID AS author_exists,
  mem.user_id AS author_still_member,
  COALESCE(pm.meta_value, u.display_name, '') AS author_pseudo,
  ru.ID AS reply_exists,
  rmem.user_id AS reply_still_member,
  COALESCE(rpm.meta_value, ru.display_name, '') AS reply_pseudo,
  e.wall_public,
  e.status AS event_status,
  (r.created_at >= DATE_SUB(NOW(), INTERVAL ${EDIT_HOURS} HOUR)) AS editable
`

function returnFrom(whereSql: string): string {
  const tR = table('returns')
  const tC = table('mandala_communities')
  const tE = table('events')
  const tU = table('users')
  const tM = table('usermeta')
  const tMem = table('mandala_community_members')
  return `SELECT ${RETURN_SELECT}
    FROM ${tR} r
    JOIN ${tC} c ON c.id = r.community_id
    LEFT JOIN ${tE} e ON r.event_id > 0 AND e.id = r.event_id
    LEFT JOIN ${tU} u ON u.ID = r.author_id
    LEFT JOIN ${tM} pm ON pm.user_id = r.author_id AND pm.meta_key = 'mdl_pseudo'
    LEFT JOIN ${tMem} mem ON mem.community_id = r.community_id AND mem.user_id = r.author_id
    LEFT JOIN ${tU} ru ON ru.ID = r.reply_user_id
    LEFT JOIN ${tM} rpm ON rpm.user_id = r.reply_user_id AND rpm.meta_key = 'mdl_pseudo'
    LEFT JOIN ${tMem} rmem ON rmem.community_id = r.community_id AND rmem.user_id = r.reply_user_id
    ${whereSql}
    ORDER BY r.created_at DESC
    LIMIT 80`
}

function displayName(
  exists: number | null,
  stillMember: number | null,
  pseudo: string | null,
  viewerIsAuthor: boolean
): string {
  if (viewerIsAuthor) return 'Vous'
  if (!exists || !stillMember) return 'Ancien membre'
  const name = String(pseudo ?? '').trim()
  return name || 'Ancien membre'
}

async function viewerCommunityIds(userId: number | null): Promise<Set<number>> {
  if (!userId) return new Set()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT community_id FROM ${table('mandala_community_members')} WHERE user_id = ?`,
    [userId]
  )
  return new Set((rows ?? []).map((r) => Number(r.community_id)))
}

async function membershipRole(userId: number, communityId: number): Promise<string | null> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT role FROM ${table('mandala_community_members')} WHERE user_id = ? AND community_id = ? LIMIT 1`,
    [userId, communityId]
  )
  return rows[0] ? String(rows[0].role) : null
}

async function isManager(userId: number, communityId: number): Promise<boolean> {
  const role = await membershipRole(userId, communityId)
  return isCommunityManagerRole(role)
}

function canSeeRow(row: JoinedReturn, viewerId: number | null, memberOf: Set<number>, subjectSelf: boolean): boolean {
  const member = viewerId != null && memberOf.has(Number(row.community_id))
  if (row.status === 'removed') return false
  if (row.status === 'pending_pair') return viewerId != null && Number(row.author_id) === viewerId
  if (row.target_type === 'event') {
    if (String(row.event_status ?? '') === 'cancelled') return member || subjectSelf
    if (member || subjectSelf) return true
    const visibleStatus = String(row.event_status) === 'published' || String(row.event_status) === 'completed'
    return Number(row.place_public) === 1 && Number(row.wall_public ?? 0) === 1 && visibleStatus
  }
  if (member || subjectSelf) return true
  return Number(row.place_public) === 1
}

function toItem(row: JoinedReturn, viewerId: number | null, viewerIsManager: boolean): ReturnItem {
  const isMine = viewerId != null && Number(row.author_id) === viewerId
  const status = row.status === 'pending_pair' ? 'pending_pair' : 'published'
  const published = status === 'published'
  const subject = Number(row.subject_user_id)
  const canReply =
    published &&
    !row.reply_body &&
    !isMine &&
    viewerId != null &&
    (row.target_type === 'accompaniment' ? subject === viewerId : viewerIsManager)
  return {
    id: Number(row.id),
    target_type: row.target_type as ReturnTarget,
    occasion_label: String(row.occasion_label),
    occasion_date: String(row.occasion_day),
    clarity: Number(row.clarity),
    frame: Number(row.frame),
    quality: Number(row.quality),
    recommend: Number(row.recommend) === 1,
    body: String(row.body ?? ''),
    author_name: displayName(row.author_exists, row.author_still_member, row.author_pseudo, isMine),
    is_mine: isMine,
    can_edit: isMine && Number(row.editable) === 1 && row.status !== 'removed',
    can_reply: canReply,
    status,
    pending_note:
      status === 'pending_pair'
        ? 'Visible quand l’autre personne aura écrit, ou 14 jours après votre envoi.'
        : null,
    reply_body: row.reply_body ? String(row.reply_body) : null,
    reply_name: row.reply_body
      ? displayName(row.reply_exists, row.reply_still_member, row.reply_pseudo, viewerId != null && Number(row.reply_user_id) === viewerId)
      : null,
    created_at: String(row.created_label ?? ''),
  }
}

async function loadRows(whereSql: string, params: Array<string | number>): Promise<JoinedReturn[]> {
  const pool = getPool()
  const [rows] = await pool.execute<JoinedReturn[]>(returnFrom(whereSql), params)
  return rows ?? []
}

async function hadPastPresence(userId: number, communityId: number, today: string): Promise<boolean> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok FROM ${table('calendar_presence')}
     WHERE user_id = ? AND community_id = ? AND day < ? LIMIT 1`,
    [userId, communityId, today]
  )
  return !!rows[0]
}

async function placeWriteSlots(userId: number, communityId: number | null, today: string): Promise<WriteSlot[]> {
  const pool = getPool()
  const communityFilter = communityId ? 'AND p.community_id = ?' : ''
  const params: Array<string | number> = [userId, userId, today]
  if (communityId) params.push(communityId)
  params.push(userId)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(p.day, '%Y-%m-%d') AS day, c.slug, c.name
     FROM ${table('calendar_presence')} p
     JOIN ${table('mandala_community_members')} m
       ON m.community_id = p.community_id AND m.user_id = ? AND m.role = 'member'
     JOIN ${table('mandala_communities')} c ON c.id = p.community_id AND c.is_active = 1
     WHERE p.user_id = ? AND p.day < ? ${communityFilter}
       AND NOT EXISTS (
         SELECT 1 FROM ${table('returns')} r
         WHERE r.author_id = ? AND r.target_type = 'place'
           AND r.community_id = p.community_id AND r.occasion_date = p.day
           AND r.status <> 'removed'
       )
     ORDER BY p.day DESC
     LIMIT 8`,
    params
  )
  return (rows ?? []).map((r) => {
    const day = String(r.day)
    return {
      kind: 'place' as const,
      community_slug: String(r.slug),
      community_name: String(r.name),
      occasion_date: day,
      occasion_label: presenceLabel(day),
      event_id: 0,
      accompaniment_id: 0,
      other_name: null,
    }
  })
}

type EventRow = {
  id: number
  community_id: number
  title: string
  created_by: number
  status: string
  start_day: string | null
  end_day: string | null
  slug: string
  name: string
}

async function loadEvent(eventId: number): Promise<EventRow | null> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT e.id, e.community_id, e.title, e.created_by, e.status,
            DATE_FORMAT(e.starts_at, '%Y-%m-%d') AS start_day,
            DATE_FORMAT(COALESCE(e.ends_at, e.starts_at), '%Y-%m-%d') AS end_day,
            c.slug, c.name
     FROM ${table('events')} e
     JOIN ${table('mandala_communities')} c ON c.id = e.community_id
     WHERE e.id = ? LIMIT 1`,
    [eventId]
  )
  const r = rows[0]
  if (!r) return null
  return {
    id: Number(r.id),
    community_id: Number(r.community_id),
    title: String(r.title),
    created_by: Number(r.created_by),
    status: String(r.status),
    start_day: r.start_day ? String(r.start_day) : null,
    end_day: r.end_day ? String(r.end_day) : null,
    slug: String(r.slug),
    name: String(r.name),
  }
}

async function isEventStaff(eventId: number, userId: number): Promise<boolean> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok FROM ${table('event_staff')} WHERE event_id = ? AND user_id = ? LIMIT 1`,
    [eventId, userId]
  )
  return !!rows[0]
}

async function presenceOverlapsEvent(userId: number, event: EventRow, today: string): Promise<boolean> {
  if (!event.start_day || !event.end_day) return false
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok FROM ${table('calendar_presence')}
     WHERE user_id = ? AND community_id = ? AND day >= ? AND day <= ? AND day < ? LIMIT 1`,
    [userId, event.community_id, event.start_day, event.end_day, today]
  )
  return !!rows[0]
}

async function eventWriteSlot(userId: number, event: EventRow, today: string): Promise<WriteSlot | null> {
  if (event.status !== 'published' && event.status !== 'completed') return null
  if (!event.end_day || event.end_day >= today) return null
  const role = await membershipRole(userId, event.community_id)
  if (role !== 'member') return null
  if (event.created_by === userId) return null
  if (await isEventStaff(event.id, userId)) return null
  if (!(await presenceOverlapsEvent(userId, event, today))) return null
  const pool = getPool()
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok FROM ${table('returns')}
     WHERE author_id = ? AND target_type = 'event' AND event_id = ? AND status <> 'removed' LIMIT 1`,
    [userId, event.id]
  )
  if (existing[0]) return null
  return {
    kind: 'event',
    community_slug: event.slug,
    community_name: event.name,
    occasion_date: event.start_day || event.end_day,
    occasion_label: event.title,
    event_id: event.id,
    accompaniment_id: 0,
    other_name: null,
  }
}

async function eventBlockedReason(userId: number, event: EventRow, today: string): Promise<string | null> {
  if (event.status !== 'published' && event.status !== 'completed') return null
  if (!event.end_day || event.end_day >= today) return null
  if (!(await presenceOverlapsEvent(userId, event, today))) return null
  if (await isManager(userId, event.community_id)) {
    return 'Les gestionnaires ne rédigent pas de retour sur un événement de leur lieu.'
  }
  if (event.created_by === userId || (await isEventStaff(event.id, userId))) {
    return 'L’équipe de l’événement ne rédige pas de retour dessus.'
  }
  return null
}

async function notifyUser(userId: number, title: string, body: string, createdBy: number | null): Promise<void> {
  try {
    await createNotification({
      type: 'return',
      title,
      body,
      recipient_type: 'user',
      recipient_id: userId,
      action_url: '/app?page=account',
      action_label: 'Voir',
      created_by: createdBy,
      source_type: 'return',
    })
  } catch {
    /* une alerte manquée ne bloque pas le retour */
  }
}

async function notifyManagers(communityId: number, title: string, body: string, createdBy: number): Promise<void> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id FROM ${table('mandala_community_members')}
     WHERE community_id = ? AND role IN ('organizer', 'admin')`,
    [communityId]
  )
  for (const row of rows ?? []) {
    const id = Number(row.user_id)
    if (id && id !== createdBy) await notifyUser(id, title, body, createdBy)
  }
}

async function requirePlace(slug: string): Promise<CommunityRecord> {
  const community = await getCommunityBySlug(slug.trim().toLowerCase())
  if (!community) fail(404, 'Lieu introuvable')
  return community
}

function assertDay(day: string): string {
  const d = day.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) fail(400, 'Date invalide')
  return d
}

export async function getReturnsOpen(userId: number): Promise<boolean> {
  await ensureReturnTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT is_open FROM ${table('return_opt_ins')} WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  return Number(rows[0]?.is_open ?? 0) === 1
}

export async function setReturnsOpen(userId: number, open: boolean): Promise<boolean> {
  await ensureReturnTables()
  const pool = getPool()
  await exec(
    pool,
    `INSERT INTO ${table('return_opt_ins')} (user_id, is_open) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE is_open = VALUES(is_open)`,
    [userId, open ? 1 : 0]
  )
  return open
}

export async function listPlaceReturns(viewerId: number | null, slug: string): Promise<ReturnsPage> {
  await ensureReturnTables()
  await publishDuePairs()
  const community = await requirePlace(slug)
  const memberOf = await viewerCommunityIds(viewerId)
  const member = viewerId != null && memberOf.has(community.id)
  if (!community.profile_public && !member) fail(404, 'Lieu introuvable')
  const today = todayParis()
  const rows = await loadRows('WHERE r.community_id = ? AND r.target_type IN (\'place\', \'event\')', [community.id])
  const visible = rows.filter((row) => canSeeRow(row, viewerId, memberOf, false))
  const manager = viewerId != null && (await isManager(viewerId, community.id))
  const placeItems = visible.filter((row) => row.target_type === 'place' && row.status !== 'removed').map((row) => toItem(row, viewerId, manager))
  const eventItems = visible.filter((row) => row.target_type === 'event' && row.status !== 'removed').map((row) => toItem(row, viewerId, manager))
  const removed = rows.filter((row) => row.target_type === 'place' && row.status === 'removed' && (member || Number(row.place_public) === 1)).length
  let writeSlots: WriteSlot[] = []
  let blocked: string | null = null
  if (viewerId && member) {
    writeSlots = await placeWriteSlots(viewerId, community.id, today)
    if (!writeSlots.length && manager && (await hadPastPresence(viewerId, community.id, today))) {
      blocked = 'Les gestionnaires ne rédigent pas de retour sur leur lieu.'
    }
  }
  return {
    summary: summarize(placeItems.filter((i) => i.status === 'published'), removed),
    items: placeItems,
    event_items: eventItems,
    write_slots: writeSlots,
    blocked_reason: blocked,
    can_alert: member,
    returns_open: false,
  }
}

export async function listEventReturns(viewerId: number | null, eventId: number): Promise<ReturnsPage> {
  await ensureReturnTables()
  await publishDuePairs()
  if (!viewerId) fail(401, 'Authentification requise')
  const event = await loadEvent(eventId)
  if (!event) fail(404, 'Événement introuvable')
  const memberOf = await viewerCommunityIds(viewerId)
  if (!memberOf.has(event.community_id)) fail(403, 'Accès communauté refusé')
  const today = todayParis()
  const rows = await loadRows('WHERE r.target_type = \'event\' AND r.event_id = ?', [eventId])
  const manager = await isManager(viewerId, event.community_id)
  const items = rows
    .filter((row) => canSeeRow(row, viewerId, memberOf, false))
    .map((row) => toItem(row, viewerId, manager))
  const removed = rows.filter((row) => row.status === 'removed').length
  const slot = await eventWriteSlot(viewerId, event, today)
  return {
    summary: summarize(items.filter((i) => i.status === 'published'), removed),
    items,
    event_items: [],
    write_slots: slot ? [slot] : [],
    blocked_reason: slot ? null : await eventBlockedReason(viewerId, event, today),
    can_alert: true,
    returns_open: false,
  }
}

async function profileIsPublic(userId: number): Promise<boolean> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${table('usermeta')} WHERE user_id = ? AND meta_key = 'mdl_profile_public' LIMIT 1`,
    [userId]
  )
  return String(rows[0]?.meta_value ?? '') === '1'
}

async function sharesCommunity(viewerId: number, subjectId: number): Promise<boolean> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok
     FROM ${table('mandala_community_members')} a
     JOIN ${table('mandala_community_members')} b ON b.community_id = a.community_id
     WHERE a.user_id = ? AND b.user_id = ? LIMIT 1`,
    [viewerId, subjectId]
  )
  return !!rows[0]
}

export async function listPersonReturns(viewerId: number | null, subjectUserId: number): Promise<ReturnsPage> {
  await ensureReturnTables()
  await publishDuePairs()
  if (!subjectUserId) fail(400, 'Personne introuvable')
  const self = viewerId === subjectUserId
  const publicProfile = await profileIsPublic(subjectUserId)
  const shared = viewerId != null && !self ? await sharesCommunity(viewerId, subjectUserId) : false
  if (!self && !publicProfile && !shared) fail(404, 'Personne introuvable')
  const memberOf = await viewerCommunityIds(viewerId)
  const rows = await loadRows('WHERE r.target_type = \'accompaniment\' AND r.subject_user_id = ?', [subjectUserId])
  const items = rows
    .filter((row) => canSeeRow(row, viewerId, memberOf, self))
    .map((row) => toItem(row, viewerId, false))
  const removed = rows.filter((row) => row.status === 'removed' && canSeeRow({ ...row, status: 'published' }, viewerId, memberOf, self)).length
  return {
    summary: summarize(items.filter((i) => i.status === 'published'), removed),
    items,
    event_items: [],
    write_slots: [],
    blocked_reason: null,
    can_alert: shared,
    returns_open: await getReturnsOpen(subjectUserId),
  }
}

export async function listDesignateSlots(viewerId: number, companionUserId: number): Promise<DesignateSlot[]> {
  await ensureReturnTables()
  if (viewerId === companionUserId) return []
  if (!(await getReturnsOpen(companionUserId))) return []
  const today = todayParis()
  const pool = getPool()
  const [places] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name
     FROM ${table('mandala_community_members')} a
     JOIN ${table('mandala_community_members')} b ON b.community_id = a.community_id AND b.user_id = ?
     JOIN ${table('mandala_communities')} c ON c.id = a.community_id AND c.is_active = 1
     WHERE a.user_id = ?`,
    [companionUserId, viewerId]
  )
  if (!places?.length) return []
  const ids = places.map((p) => Number(p.id))
  const byId = new Map(places.map((p) => [Number(p.id), p]))
  const placeholders = ids.map(() => '?').join(',')
  const [days] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(p.day, '%Y-%m-%d') AS day, p.community_id
     FROM ${table('calendar_presence')} p
     WHERE p.user_id = ? AND p.community_id IN (${placeholders}) AND p.day < ?
       AND EXISTS (
         SELECT 1 FROM ${table('calendar_presence')} o
         WHERE o.user_id = ? AND o.community_id = p.community_id AND o.day = p.day
       )
     ORDER BY p.day DESC
     LIMIT 20`,
    [viewerId, ...ids, today, companionUserId]
  )
  const slots = new Map<string, DesignateSlot>()
  for (const row of days ?? []) {
    const place = byId.get(Number(row.community_id))
    if (!place) continue
    const day = String(row.day)
    const key = `${place.id}:${day}`
    slots.set(key, {
      community_slug: String(place.slug),
      community_name: String(place.name),
      occasion_date: day,
      occasion_label: presenceLabel(day),
      event_id: 0,
    })
  }
  const [events] = await pool.execute<RowDataPacket[]>(
    `SELECT e.id, e.community_id, e.title,
            DATE_FORMAT(e.starts_at, '%Y-%m-%d') AS start_day,
            DATE_FORMAT(COALESCE(e.ends_at, e.starts_at), '%Y-%m-%d') AS end_day
     FROM ${table('event_staff')} s
     JOIN ${table('events')} e ON e.id = s.event_id
     WHERE s.user_id = ? AND e.community_id IN (${placeholders})
       AND e.status IN ('published', 'completed')
       AND DATE_FORMAT(COALESCE(e.ends_at, e.starts_at), '%Y-%m-%d') < ?`,
    [companionUserId, ...ids, today]
  )
  for (const event of events ?? []) {
    const start = event.start_day ? String(event.start_day) : null
    const end = event.end_day ? String(event.end_day) : null
    if (!start || !end) continue
    const [present] = await pool.execute<RowDataPacket[]>(
      `SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day FROM ${table('calendar_presence')}
       WHERE user_id = ? AND community_id = ? AND day >= ? AND day <= ? AND day < ?
       ORDER BY day DESC LIMIT 1`,
      [viewerId, Number(event.community_id), start, end, today]
    )
    const day = present[0]?.day ? String(present[0].day) : null
    if (!day) continue
    const place = byId.get(Number(event.community_id))
    if (!place) continue
    slots.set(`${place.id}:${day}`, {
      community_slug: String(place.slug),
      community_name: String(place.name),
      occasion_date: day,
      occasion_label: String(event.title),
      event_id: Number(event.id),
    })
  }
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT community_id, event_id, DATE_FORMAT(occasion_date, '%Y-%m-%d') AS day, status
     FROM ${table('accompaniments')}
     WHERE beneficiary_user_id = ? AND companion_user_id = ?`,
    [viewerId, companionUserId]
  )
  const taken = new Set(
    (existing ?? [])
      .filter((r) => String(r.status) !== 'declined')
      .map((r) => `${r.community_id}:${String(r.day)}`)
  )
  return [...slots.values()]
    .filter((slot) => {
      const place = places.find((p) => String(p.slug) === slot.community_slug)
      return place && !taken.has(`${place.id}:${slot.occasion_date}`)
    })
    .sort((a, b) => b.occasion_date.localeCompare(a.occasion_date))
    .slice(0, 12)
}

async function userPseudo(userId: number): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(pm.meta_value, u.display_name, CONCAT('user_', u.ID)) AS pseudo
     FROM ${table('users')} u
     LEFT JOIN ${table('usermeta')} pm ON pm.user_id = u.ID AND pm.meta_key = 'mdl_pseudo'
     WHERE u.ID = ? LIMIT 1`,
    [userId]
  )
  return String(rows[0]?.pseudo ?? 'Un membre')
}

export async function createAccompaniment(input: {
  viewerId: number
  communitySlug: string
  companionUserId: number
  occasionDate: string
  eventId: number
}): Promise<void> {
  await ensureReturnTables()
  const day = assertDay(input.occasionDate)
  const today = todayParis()
  if (day >= today) fail(400, 'Le retour s’ouvre une fois la date passée')
  if (input.viewerId === input.companionUserId) fail(400, 'Choisissez une autre personne')
  if (!(await getReturnsOpen(input.companionUserId))) {
    fail(400, 'Cette personne n’a pas ouvert les retours sur ce qu’elle propose')
  }
  const community = await requirePlace(input.communitySlug)
  const beneficiaryRole = await membershipRole(input.viewerId, community.id)
  const companionRole = await membershipRole(input.companionUserId, community.id)
  if (!beneficiaryRole || !companionRole) fail(403, 'Vous devez partager ce lieu')
  const pool = getPool()
  const [mine] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok FROM ${table('calendar_presence')}
     WHERE user_id = ? AND community_id = ? AND day = ? LIMIT 1`,
    [input.viewerId, community.id, day]
  )
  if (!mine[0]) fail(400, 'Une présence déclarée, après la date, ouvre cette demande')
  let label = presenceLabel(day)
  const eventId = input.eventId > 0 ? input.eventId : 0
  if (eventId) {
    const event = await loadEvent(eventId)
    if (!event || event.community_id !== community.id || (event.status !== 'published' && event.status !== 'completed')) {
      fail(400, 'Événement introuvable')
    }
    if (!event.start_day || !event.end_day || day < event.start_day || day > event.end_day || event.end_day >= today) {
      fail(400, 'Cette date ne correspond pas à l’événement')
    }
    if (!(await isEventStaff(eventId, input.companionUserId))) {
      const [there] = await pool.execute<RowDataPacket[]>(
        `SELECT 1 AS ok FROM ${table('calendar_presence')}
         WHERE user_id = ? AND community_id = ? AND day = ? LIMIT 1`,
        [input.companionUserId, community.id, day]
      )
      if (!there[0]) fail(400, 'Cette personne n’était pas indiquée présente ce jour-là')
    }
    label = event.title
  } else {
    const [there] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 AS ok FROM ${table('calendar_presence')}
       WHERE user_id = ? AND community_id = ? AND day = ? LIMIT 1`,
      [input.companionUserId, community.id, day]
    )
    if (!there[0]) fail(400, 'Cette personne n’était pas indiquée présente ce jour-là')
  }
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id, status FROM ${table('accompaniments')}
     WHERE beneficiary_user_id = ? AND companion_user_id = ? AND community_id = ? AND event_id = ? AND occasion_date = ?
     LIMIT 1`,
    [input.viewerId, input.companionUserId, community.id, eventId, day]
  )
  if (existing[0] && String(existing[0].status) !== 'declined') {
    fail(400, 'Cette demande existe déjà pour ce jour')
  }
  if (existing[0]) {
    await exec(
      pool,
      `UPDATE ${table('accompaniments')}
       SET status = 'pending', occasion_label = ?, responded_at = NULL
       WHERE id = ?`,
      [label, Number(existing[0].id)]
    )
  } else {
    await exec(
      pool,
      `INSERT INTO ${table('accompaniments')}
        (community_id, event_id, occasion_date, occasion_label, beneficiary_user_id, companion_user_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [community.id, eventId, day, label, input.viewerId, input.companionUserId]
    )
  }
  const name = await userPseudo(input.viewerId)
  await notifyUser(
    input.companionUserId,
    'Un moment avec vous',
    `${name} indique un moment passé avec vous (${label}). Vous pouvez accepter ou refuser.`,
    input.viewerId
  )
}

export async function respondAccompaniment(viewerId: number, accompanimentId: number, accept: boolean): Promise<void> {
  await ensureReturnTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, status, companion_user_id, beneficiary_user_id, occasion_label
     FROM ${table('accompaniments')} WHERE id = ? LIMIT 1`,
    [accompanimentId]
  )
  const row = rows[0]
  if (!row) fail(404, 'Demande introuvable')
  if (Number(row.companion_user_id) !== viewerId) fail(403, 'Cette demande ne vous est pas adressée')
  if (String(row.status) !== 'pending') fail(400, 'Cette demande a déjà reçu une réponse')
  await exec(
    pool,
    `UPDATE ${table('accompaniments')} SET status = ?, responded_at = NOW() WHERE id = ?`,
    [accept ? 'accepted' : 'declined', accompanimentId]
  )
  if (accept) {
    await notifyUser(
      Number(row.beneficiary_user_id),
      'Moment accepté',
      `Vous pouvez écrire un retour (${String(row.occasion_label)}).`,
      viewerId
    )
  }
}

async function insertReturn(input: {
  authorId: number
  target: ReturnTarget
  communityId: number
  eventId: number
  accompanimentId: number
  subjectUserId: number
  occasionDate: string
  occasionLabel: string
  scores: ReturnScores
  status: 'published' | 'pending_pair'
}): Promise<void> {
  const body = assertScores(input.scores)
  const pool = getPool()
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id, status FROM ${table('returns')}
     WHERE author_id = ? AND target_type = ? AND community_id = ? AND event_id = ? AND accompaniment_id = ? AND occasion_date = ?
     LIMIT 1`,
    [input.authorId, input.target, input.communityId, input.eventId, input.accompanimentId, input.occasionDate]
  )
  if (existing[0]) fail(400, 'Vous avez déjà écrit un retour pour cette occasion')
  await exec(
    pool,
    `INSERT INTO ${table('returns')}
      (author_id, target_type, community_id, event_id, accompaniment_id, subject_user_id,
       occasion_date, occasion_label, clarity, frame, quality, recommend, body, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.authorId,
      input.target,
      input.communityId,
      input.eventId,
      input.accompanimentId,
      input.subjectUserId,
      input.occasionDate,
      input.occasionLabel,
      input.scores.clarity,
      input.scores.frame,
      input.scores.quality,
      input.scores.recommend ? 1 : 0,
      body,
      input.status,
    ]
  )
}

export async function createReturn(input: {
  viewerId: number
  target: ReturnTarget
  communitySlug?: string
  eventId?: number
  occasionDate?: string
  accompanimentId?: number
  scores: ReturnScores
}): Promise<void> {
  await ensureReturnTables()
  const today = todayParis()
  if (input.target === 'place') {
    const community = await requirePlace(input.communitySlug ?? '')
    const day = assertDay(input.occasionDate ?? '')
    if (day >= today) fail(400, 'Le retour s’ouvre une fois la date passée')
    const role = await membershipRole(input.viewerId, community.id)
    if (!role) fail(403, 'Accès communauté refusé')
    if (isCommunityManagerRole(role)) fail(403, 'Les gestionnaires ne rédigent pas de retour sur leur lieu')
    const pool = getPool()
    const [present] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 AS ok FROM ${table('calendar_presence')}
       WHERE user_id = ? AND community_id = ? AND day = ? LIMIT 1`,
      [input.viewerId, community.id, day]
    )
    if (!present[0]) fail(400, 'Une présence déclarée, après la date, ouvre un retour')
    await insertReturn({
      authorId: input.viewerId,
      target: 'place',
      communityId: community.id,
      eventId: 0,
      accompanimentId: 0,
      subjectUserId: 0,
      occasionDate: day,
      occasionLabel: presenceLabel(day),
      scores: input.scores,
      status: 'published',
    })
    await notifyManagers(community.id, 'Nouveau retour sur le lieu', presenceLabel(day), input.viewerId)
    return
  }
  if (input.target === 'event') {
    const event = await loadEvent(Number(input.eventId))
    if (!event) fail(404, 'Événement introuvable')
    const slot = await eventWriteSlot(input.viewerId, event, today)
    if (!slot) fail(403, 'Vous ne pouvez pas écrire de retour sur cet événement')
    await insertReturn({
      authorId: input.viewerId,
      target: 'event',
      communityId: event.community_id,
      eventId: event.id,
      accompanimentId: 0,
      subjectUserId: 0,
      occasionDate: slot.occasion_date,
      occasionLabel: event.title,
      scores: input.scores,
      status: 'published',
    })
    await notifyManagers(event.community_id, 'Nouveau retour sur un événement', event.title, input.viewerId)
    return
  }
  const accompanimentId = Number(input.accompanimentId)
  if (!accompanimentId) fail(400, 'Moment requis')
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, community_id, event_id, occasion_label, DATE_FORMAT(occasion_date, '%Y-%m-%d') AS occasion_day,
            beneficiary_user_id, companion_user_id, status
     FROM ${table('accompaniments')} WHERE id = ? LIMIT 1`,
    [accompanimentId]
  )
  const row = rows[0]
  if (!row || String(row.status) !== 'accepted') fail(400, 'Le moment doit être accepté avant d’écrire')
  const beneficiary = Number(row.beneficiary_user_id)
  const companion = Number(row.companion_user_id)
  if (input.viewerId !== beneficiary && input.viewerId !== companion) fail(403, 'Ce retour ne vous concerne pas')
  const subject = input.viewerId === beneficiary ? companion : beneficiary
  await insertReturn({
    authorId: input.viewerId,
    target: 'accompaniment',
    communityId: Number(row.community_id),
    eventId: Number(row.event_id) || 0,
    accompanimentId,
    subjectUserId: subject,
    occasionDate: String(row.occasion_day),
    occasionLabel: String(row.occasion_label),
    scores: input.scores,
    status: 'pending_pair',
  })
  await publishDuePairs()
}

export async function updateReturn(viewerId: number, returnId: number, scores: ReturnScores): Promise<void> {
  await ensureReturnTables()
  const body = assertScores(scores)
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, author_id, status, (created_at >= DATE_SUB(NOW(), INTERVAL ${EDIT_HOURS} HOUR)) AS editable
     FROM ${table('returns')} WHERE id = ? LIMIT 1`,
    [returnId]
  )
  const row = rows[0]
  if (!row) fail(404, 'Retour introuvable')
  if (Number(row.author_id) !== viewerId) fail(403, 'Vous ne pouvez modifier que votre retour')
  if (String(row.status) === 'removed') fail(400, 'Ce retour a été retiré')
  if (Number(row.editable) !== 1) fail(400, 'Le délai de modification de 48 heures est passé')
  await exec(
    pool,
    `UPDATE ${table('returns')}
     SET clarity = ?, frame = ?, quality = ?, recommend = ?, body = ?, updated_at = NOW()
     WHERE id = ?`,
    [scores.clarity, scores.frame, scores.quality, scores.recommend ? 1 : 0, body, returnId]
  )
}

export async function replyToReturn(viewerId: number, returnId: number, body: string): Promise<void> {
  await ensureReturnTables()
  const text = body.trim()
  if (text.length < MIN_TEXT || text.length > MAX_BODY) fail(400, 'La réponse demande quelques mots')
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, author_id, target_type, community_id, subject_user_id, status, reply_body
     FROM ${table('returns')} WHERE id = ? LIMIT 1`,
    [returnId]
  )
  const row = rows[0]
  if (!row || String(row.status) !== 'published') fail(404, 'Retour introuvable')
  if (row.reply_body) fail(400, 'Une réponse a déjà été publiée')
  if (Number(row.author_id) === viewerId) fail(403, 'Vous ne répondez pas à votre propre retour')
  if (String(row.target_type) === 'accompaniment') {
    if (Number(row.subject_user_id) !== viewerId) fail(403, 'Seule la personne concernée peut répondre')
  } else if (!(await isManager(viewerId, Number(row.community_id)))) {
    fail(403, 'Seuls les gestionnaires du lieu peuvent répondre')
  }
  await exec(
    pool,
    `UPDATE ${table('returns')} SET reply_body = ?, reply_at = NOW(), reply_user_id = ? WHERE id = ? AND reply_body IS NULL`,
    [text, viewerId, returnId]
  )
}

export async function reportReturn(viewerId: number, returnId: number, reason: string): Promise<void> {
  await ensureReturnTables()
  const text = reason.trim()
  if (text.length < 10 || text.length > 500) fail(400, 'Précisez le motif en quelques mots')
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, status FROM ${table('returns')} WHERE id = ? LIMIT 1`,
    [returnId]
  )
  if (!rows[0] || String(rows[0].status) === 'removed') fail(404, 'Retour introuvable')
  await exec(
    pool,
    `INSERT INTO ${table('return_reports')} (return_id, reporter_id, reason, status) VALUES (?, ?, ?, 'new')`,
    [returnId, viewerId, text]
  )
}

export async function createFrameAlert(input: {
  viewerId: number
  communitySlug: string
  aboutUserId: number
  message: string
}): Promise<void> {
  await ensureReturnTables()
  const text = input.message.trim()
  if (text.length < MIN_TEXT || text.length > 2000) fail(400, 'Décrivez le cadre en quelques mots')
  const community = await requirePlace(input.communitySlug)
  const role = await membershipRole(input.viewerId, community.id)
  if (!role) fail(403, 'Accès communauté refusé')
  let about = input.aboutUserId > 0 ? input.aboutUserId : 0
  if (about) {
    const aboutRole = await membershipRole(about, community.id)
    if (!aboutRole) fail(400, 'Cette personne n’est pas membre de ce lieu')
  }
  const pool = getPool()
  await exec(
    pool,
    `INSERT INTO ${table('frame_alerts')} (user_id, community_id, about_user_id, message, status) VALUES (?, ?, ?, ?, 'new')`,
    [input.viewerId, community.id, about, text]
  )
}

export async function listMyInbox(userId: number): Promise<{
  returns_open: boolean
  incoming: AccompanimentCard[]
  outgoing: AccompanimentCard[]
  to_write: WriteSlot[]
}> {
  await ensureReturnTables()
  await publishDuePairs()
  const today = todayParis()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.id, a.status, a.beneficiary_user_id, a.companion_user_id, a.occasion_label,
            DATE_FORMAT(a.occasion_date, '%Y-%m-%d') AS occasion_day,
            c.slug, c.name,
            COALESCE(pm.meta_value, u.display_name, '') AS other_pseudo,
            (
              SELECT 1 FROM ${table('returns')} r
              WHERE r.accompaniment_id = a.id AND r.author_id = ? AND r.status <> 'removed'
              LIMIT 1
            ) AS wrote
     FROM ${table('accompaniments')} a
     JOIN ${table('mandala_communities')} c ON c.id = a.community_id
     JOIN ${table('users')} u ON u.ID = IF(a.beneficiary_user_id = ?, a.companion_user_id, a.beneficiary_user_id)
     LEFT JOIN ${table('usermeta')} pm ON pm.user_id = u.ID AND pm.meta_key = 'mdl_pseudo'
     WHERE a.beneficiary_user_id = ? OR a.companion_user_id = ?
     ORDER BY a.created_at DESC
     LIMIT 40`,
    [userId, userId, userId, userId]
  )
  const incoming: AccompanimentCard[] = []
  const outgoing: AccompanimentCard[] = []
  const toWrite: WriteSlot[] = []
  for (const row of rows ?? []) {
    const incomingRequest = Number(row.companion_user_id) === userId
    const card: AccompanimentCard = {
      id: Number(row.id),
      status: String(row.status) as AccompanimentCard['status'],
      community_slug: String(row.slug),
      community_name: String(row.name),
      occasion_date: String(row.occasion_day),
      occasion_label: String(row.occasion_label),
      other_name: String(row.other_pseudo || 'Un membre'),
      direction: incomingRequest ? 'incoming' : 'outgoing',
      can_write: String(row.status) === 'accepted' && !row.wrote,
    }
    if (card.status === 'pending' && card.direction === 'incoming') incoming.push(card)
    if (card.status === 'pending' && card.direction === 'outgoing') outgoing.push(card)
    if (card.can_write) {
      toWrite.push({
        kind: 'accompaniment',
        community_slug: card.community_slug,
        community_name: card.community_name,
        occasion_date: card.occasion_date,
        occasion_label: card.occasion_label,
        event_id: 0,
        accompaniment_id: card.id,
        other_name: card.other_name,
      })
    }
  }
  const placeSlots = await placeWriteSlots(userId, null, today)
  const [eventRows] = await pool.execute<RowDataPacket[]>(
    `SELECT e.id
     FROM ${table('events')} e
     JOIN ${table('mandala_community_members')} m
       ON m.community_id = e.community_id AND m.user_id = ? AND m.role = 'member'
     WHERE e.status IN ('published', 'completed')
       AND DATE_FORMAT(COALESCE(e.ends_at, e.starts_at), '%Y-%m-%d') < ?
       AND e.created_by <> ?
       AND NOT EXISTS (
         SELECT 1 FROM ${table('event_staff')} s WHERE s.event_id = e.id AND s.user_id = ?
       )
       AND NOT EXISTS (
         SELECT 1 FROM ${table('returns')} r
         WHERE r.author_id = ? AND r.target_type = 'event' AND r.event_id = e.id AND r.status <> 'removed'
       )
     ORDER BY e.starts_at DESC
     LIMIT 12`,
    [userId, today, userId, userId, userId]
  )
  const eventSlots: WriteSlot[] = []
  for (const row of eventRows ?? []) {
    const event = await loadEvent(Number(row.id))
    if (!event) continue
    const slot = await eventWriteSlot(userId, event, today)
    if (slot) eventSlots.push(slot)
    if (eventSlots.length >= 6) break
  }
  return {
    returns_open: await getReturnsOpen(userId),
    incoming,
    outgoing,
    to_write: [...toWrite, ...placeSlots.slice(0, 6), ...eventSlots],
  }
}

export type AdminReport = {
  id: number
  return_id: number
  reason: string
  reporter_name: string
  occasion_label: string
  body: string
  created_at: string
}

export type AdminAlert = {
  id: number
  author_name: string
  place_name: string
  about_name: string | null
  message: string
  status: string
  created_at: string
}

export async function listAdminQueue(): Promise<{ reports: AdminReport[]; alerts: AdminAlert[] }> {
  await ensureReturnTables()
  const pool = getPool()
  const [reports] = await pool.execute<RowDataPacket[]>(
    `SELECT rp.id, rp.return_id, rp.reason, r.occasion_label, r.body,
            DATE_FORMAT(rp.created_at, '%Y-%m-%d %H:%i') AS created_label,
            COALESCE(pm.meta_value, u.display_name, 'Ancien membre') AS reporter_name
     FROM ${table('return_reports')} rp
     JOIN ${table('returns')} r ON r.id = rp.return_id
     LEFT JOIN ${table('users')} u ON u.ID = rp.reporter_id
     LEFT JOIN ${table('usermeta')} pm ON pm.user_id = rp.reporter_id AND pm.meta_key = 'mdl_pseudo'
     WHERE rp.status = 'new'
     ORDER BY rp.created_at DESC
     LIMIT 50`
  )
  const [alerts] = await pool.execute<RowDataPacket[]>(
    `SELECT a.id, a.message, a.status, c.name AS place_name,
            DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i') AS created_label,
            COALESCE(pm.meta_value, u.display_name, 'Ancien membre') AS author_name,
            COALESCE(apm.meta_value, au.display_name, '') AS about_name
     FROM ${table('frame_alerts')} a
     JOIN ${table('mandala_communities')} c ON c.id = a.community_id
     LEFT JOIN ${table('users')} u ON u.ID = a.user_id
     LEFT JOIN ${table('usermeta')} pm ON pm.user_id = a.user_id AND pm.meta_key = 'mdl_pseudo'
     LEFT JOIN ${table('users')} au ON a.about_user_id > 0 AND au.ID = a.about_user_id
     LEFT JOIN ${table('usermeta')} apm ON apm.user_id = a.about_user_id AND apm.meta_key = 'mdl_pseudo'
     WHERE a.status IN ('new', 'read')
     ORDER BY a.created_at DESC
     LIMIT 50`
  )
  return {
    reports: (reports ?? []).map((r) => ({
      id: Number(r.id),
      return_id: Number(r.return_id),
      reason: String(r.reason),
      reporter_name: String(r.reporter_name),
      occasion_label: String(r.occasion_label),
      body: String(r.body ?? ''),
      created_at: String(r.created_label ?? ''),
    })),
    alerts: (alerts ?? []).map((r) => ({
      id: Number(r.id),
      author_name: String(r.author_name),
      place_name: String(r.place_name),
      about_name: String(r.about_name || '') || null,
      message: String(r.message),
      status: String(r.status),
      created_at: String(r.created_label ?? ''),
    })),
  }
}

export async function adminRemoveReturn(returnId: number): Promise<void> {
  await ensureReturnTables()
  const pool = getPool()
  await exec(pool, `UPDATE ${table('returns')} SET status = 'removed' WHERE id = ?`, [returnId])
  await exec(
    pool,
    `UPDATE ${table('return_reports')} SET status = 'removed' WHERE return_id = ? AND status = 'new'`,
    [returnId]
  )
}

export async function adminDismissReport(reportId: number): Promise<void> {
  await ensureReturnTables()
  await exec(getPool(), `UPDATE ${table('return_reports')} SET status = 'dismissed' WHERE id = ?`, [reportId])
}

export async function adminSetAlertStatus(alertId: number, status: 'read' | 'done'): Promise<void> {
  await ensureReturnTables()
  await exec(getPool(), `UPDATE ${table('frame_alerts')} SET status = ? WHERE id = ?`, [status, alertId])
}
