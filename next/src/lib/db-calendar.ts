/**
 * Calendrier Mandala — présence par jour + jours désactivés + réglages d'affichage.
 * Portée : par communauté.
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { normalizeDbDateTime } from './format-datetime'
import { listEventsForCommunityBetween, type EventRecord } from './db-mandala-events'

export type CalendarSettings = {
  show_presence: boolean
  show_events: boolean
}

export type CalendarPresentUser = {
  user_id: number
  pseudo: string
  display_name: string
}

export type CalendarDaySummary = {
  day: string // YYYY-MM-DD
  is_disabled: boolean
  present_count: number
  i_am_present: boolean
  present_users: CalendarPresentUser[]
}

export type CalendarDayDetail = {
  day: string
  is_disabled: boolean
  present_users: Array<{ user_id: number; pseudo: string; display_name: string }>
  events: Array<Pick<EventRecord, 'id' | 'title' | 'starts_at' | 'ends_at' | 'location' | 'phase'>>
}

let _ensured = false

function assertDay(day: string): string {
  const d = String(day ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Jour invalide (YYYY-MM-DD)')
  return d
}

function assertYm(ym: string): string {
  const v = String(ym ?? '').trim()
  if (!/^\d{4}-\d{2}$/.test(v)) throw new Error('Mois invalide (YYYY-MM)')
  return v
}

function monthRange(ym: string): { start: string; endExclusive: string } {
  const safe = assertYm(ym)
  const [yStr, mStr] = safe.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  const start = `${yStr}-${mStr}-01`
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const endExclusive = `${String(nextY).padStart(4, '0')}-${String(nextM).padStart(2, '0')}-01`
  return { start, endExclusive }
}

export async function ensureCalendarTables(): Promise<void> {
  if (_ensured || !isDbConfigured()) return
  const pool = getPool()
  const tP = table('calendar_presence')
  const tD = table('calendar_day_settings')
  const tS = table('calendar_settings')

  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tP} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      community_id INT NOT NULL,
      day DATE NOT NULL,
      user_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_presence (community_id, day, user_id),
      KEY idx_comm_day (community_id, day),
      KEY idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )

  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tD} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      community_id INT NOT NULL,
      day DATE NOT NULL,
      is_disabled TINYINT(1) NOT NULL DEFAULT 0,
      disabled_by INT DEFAULT NULL,
      disabled_reason VARCHAR(255) DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_comm_day (community_id, day),
      KEY idx_comm_disabled (community_id, is_disabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )

  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tS} (
      community_id INT NOT NULL PRIMARY KEY,
      show_presence TINYINT(1) NOT NULL DEFAULT 1,
      show_events TINYINT(1) NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )

  _ensured = true
}

export async function getCalendarSettings(communityId: number): Promise<CalendarSettings> {
  await ensureCalendarTables()
  const pool = getPool()
  const tS = table('calendar_settings')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT show_presence, show_events FROM ${tS} WHERE community_id = ? LIMIT 1`,
    [communityId]
  )
  const r = rows[0]
  if (!r) return { show_presence: true, show_events: true }
  return { show_presence: Number(r.show_presence ?? 1) === 1, show_events: Number(r.show_events ?? 1) === 1 }
}

export async function upsertCalendarSettings(params: {
  communityId: number
  patch: Partial<CalendarSettings>
}): Promise<CalendarSettings> {
  await ensureCalendarTables()
  const pool = getPool()
  const tS = table('calendar_settings')
  const current = await getCalendarSettings(params.communityId)
  const next: CalendarSettings = {
    show_presence: params.patch.show_presence ?? current.show_presence,
    show_events: params.patch.show_events ?? current.show_events,
  }
  await pool.execute(
    `INSERT INTO ${tS} (community_id, show_presence, show_events)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE show_presence = VALUES(show_presence), show_events = VALUES(show_events)`,
    [params.communityId, next.show_presence ? 1 : 0, next.show_events ? 1 : 0]
  )
  return next
}

export async function setCalendarDayDisabled(params: {
  communityId: number
  day: string
  is_disabled: boolean
  byUserId: number
  reason?: string
}): Promise<void> {
  await ensureCalendarTables()
  const pool = getPool()
  const tD = table('calendar_day_settings')
  const day = assertDay(params.day)
  const reason = params.reason ? String(params.reason).trim().slice(0, 255) : null
  await pool.execute(
    `INSERT INTO ${tD} (community_id, day, is_disabled, disabled_by, disabled_reason)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE is_disabled = VALUES(is_disabled), disabled_by = VALUES(disabled_by), disabled_reason = VALUES(disabled_reason)`,
    [params.communityId, day, params.is_disabled ? 1 : 0, params.byUserId || null, reason]
  )
}

async function isDayDisabled(communityId: number, day: string): Promise<boolean> {
  await ensureCalendarTables()
  const pool = getPool()
  const tD = table('calendar_day_settings')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT is_disabled FROM ${tD} WHERE community_id = ? AND day = ? LIMIT 1`,
    [communityId, assertDay(day)]
  )
  return Number(rows[0]?.is_disabled ?? 0) === 1
}

export async function setPresence(params: {
  communityId: number
  day: string
  userId: number
  present: boolean
  /** Si true, autorise l'inscription même si la journée est désactivée (admin). */
  bypassDisabled?: boolean
}): Promise<{ present: boolean; user_id: number }> {
  await ensureCalendarTables()
  const pool = getPool()
  const tP = table('calendar_presence')
  const day = assertDay(params.day)
  if (!params.bypassDisabled && (await isDayDisabled(params.communityId, day))) {
    throw new Error('Cette journée est désactivée par un administrateur.')
  }
  if (params.present) {
    await pool.execute(
      `INSERT INTO ${tP} (community_id, day, user_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [params.communityId, day, params.userId]
    )
    return { present: true, user_id: params.userId }
  }
  await pool.execute(`DELETE FROM ${tP} WHERE community_id = ? AND day = ? AND user_id = ?`, [
    params.communityId,
    day,
    params.userId,
  ])
  return { present: false, user_id: params.userId }
}

async function fetchPresentUsersByDay(
  communityId: number,
  start: string,
  endExclusive: string
): Promise<Map<string, CalendarPresentUser[]>> {
  const pool = getPool()
  const tP = table('calendar_presence')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(p.day, '%Y-%m-%d') AS day, p.user_id,
            COALESCE(pm.meta_value, u.display_name, CONCAT('user_', p.user_id)) AS pseudo,
            COALESCE(u.display_name, '') AS display_name
     FROM ${tP} p
     JOIN ${tUsers} u ON u.ID = p.user_id
     LEFT JOIN ${tMeta} pm ON pm.user_id = p.user_id AND pm.meta_key = 'mdl_pseudo'
     WHERE p.community_id = ? AND p.day >= ? AND p.day < ?
     ORDER BY day ASC, pseudo ASC`,
    [communityId, start, endExclusive]
  )
  const map = new Map<string, CalendarPresentUser[]>()
  for (const r of rows ?? []) {
    const day = String(r.day)
    const list = map.get(day) ?? []
    list.push({
      user_id: Number(r.user_id),
      pseudo: String(r.pseudo || r.display_name || `user_${r.user_id}`),
      display_name: String(r.display_name || ''),
    })
    map.set(day, list)
  }
  return map
}

export async function getCalendarMonth(params: {
  communityId: number
  ym: string
  viewerUserId: number
}): Promise<{
  ym: string
  settings: CalendarSettings
  days: CalendarDaySummary[]
  events: Array<Pick<EventRecord, 'id' | 'title' | 'starts_at' | 'ends_at' | 'location' | 'phase'>>
}> {
  await ensureCalendarTables()
  const ym = assertYm(params.ym)
  const { start, endExclusive } = monthRange(ym)
  const pool = getPool()
  const tP = table('calendar_presence')
  const tD = table('calendar_day_settings')

  const settings = await getCalendarSettings(params.communityId)

  // Présences agrégées
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day, COUNT(*) AS c
     FROM ${tP}
     WHERE community_id = ? AND day >= ? AND day < ?
     GROUP BY day`,
    [params.communityId, start, endExclusive]
  )
  const countMap = new Map<string, number>()
  for (const r of countRows ?? []) {
    countMap.set(String(r.day), Number(r.c ?? 0))
  }

  const presentByDay = settings.show_presence
    ? await fetchPresentUsersByDay(params.communityId, start, endExclusive)
    : new Map<string, CalendarPresentUser[]>()

  const [disabledRows] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day, is_disabled
     FROM ${tD}
     WHERE community_id = ? AND day >= ? AND day < ?`,
    [params.communityId, start, endExclusive]
  )
  const disabledMap = new Map<string, boolean>()
  for (const r of disabledRows ?? []) {
    disabledMap.set(String(r.day), Number(r.is_disabled ?? 0) === 1)
  }

  // Construire toutes les journées du mois (1..N)
  const [yearStr, monthStr] = ym.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const daysInMonth = new Date(year, month, 0).getDate()
  const days: CalendarDaySummary[] = []
  for (let i = 1; i <= daysInMonth; i++) {
    const day = `${yearStr}-${monthStr}-${String(i).padStart(2, '0')}`
    const is_disabled = disabledMap.get(day) ?? false
    const present_users = presentByDay.get(day) ?? []
    days.push({
      day,
      is_disabled,
      present_count: present_users.length,
      i_am_present: present_users.some((u) => u.user_id === params.viewerUserId),
      present_users,
    })
  }

  const events = settings.show_events
    ? (await listEventsForCommunityBetween(params.communityId, `${start} 00:00:00`, `${endExclusive} 00:00:00`)).map(
        (e) => ({
          id: e.id,
          title: e.title,
          starts_at: e.starts_at,
          ends_at: e.ends_at,
          location: e.location,
          phase: e.phase,
        })
      )
    : []

  return { ym, settings, days, events }
}

export async function getCalendarDayDetail(params: {
  communityId: number
  day: string
  viewerUserId: number
}): Promise<{ detail: CalendarDayDetail; settings: CalendarSettings }> {
  await ensureCalendarTables()
  const day = assertDay(params.day)
  const pool = getPool()
  const settings = await getCalendarSettings(params.communityId)

  const tD = table('calendar_day_settings')
  const [dRows] = await pool.execute<RowDataPacket[]>(
    `SELECT is_disabled, disabled_reason, disabled_by, updated_at
     FROM ${tD} WHERE community_id = ? AND day = ? LIMIT 1`,
    [params.communityId, day]
  )
  const is_disabled = Number(dRows[0]?.is_disabled ?? 0) === 1
  void normalizeDbDateTime(dRows[0]?.updated_at)

  const present_users: CalendarDayDetail['present_users'] = []
  if (settings.show_presence) {
    const tP = table('calendar_presence')
    const tUsers = table('users')
    const tMeta = table('usermeta')
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.user_id,
              COALESCE(pm.meta_value, u.display_name, CONCAT('user_', p.user_id)) AS pseudo,
              COALESCE(u.display_name, '') AS display_name
       FROM ${tP} p
       JOIN ${tUsers} u ON u.ID = p.user_id
       LEFT JOIN ${tMeta} pm ON pm.user_id = p.user_id AND pm.meta_key = 'mdl_pseudo'
       WHERE p.community_id = ? AND p.day = ?
       ORDER BY pseudo ASC`,
      [params.communityId, day]
    )
    for (const r of rows ?? []) {
      present_users.push({
        user_id: Number(r.user_id),
        pseudo: String(r.pseudo || r.display_name || `user_${r.user_id}`),
        display_name: String(r.display_name || ''),
      })
    }
  }

  const events = settings.show_events
    ? (
        await listEventsForCommunityBetween(
          params.communityId,
          `${day} 00:00:00`,
          `${day} 23:59:59`
        )
      ).map((e) => ({
        id: e.id,
        title: e.title,
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        location: e.location,
        phase: e.phase,
      }))
    : []

  return {
    settings,
    detail: {
      day,
      is_disabled,
      present_users,
      events,
    },
  }
}

