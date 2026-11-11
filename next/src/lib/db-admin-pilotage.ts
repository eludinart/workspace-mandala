/**
 * Agrégats Admin Pilotage (P0–P2) + santé serveur/app (Charge/Push).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from '@/lib/db'
import { ensureProductPilotageTables } from '@/lib/db-product-events'
import { parisDayString } from '@/lib/paris-day'
import {
  buildAdminLoadDashboard,
  type AdminAlert,
  type AdminAlertLevel,
} from '@/lib/admin-load-alerts'

export type PilotageDays = 7 | 30 | 90

export type PilotageSeriesPoint = {
  day: string
  registrations: number
  joins: number
  dau: number
}

export type PilotageActivityItem = {
  at: string
  kind:
    | 'user.registered'
    | 'place.joined'
    | 'place.left'
    | 'onboarding.continue_without_place'
    | 'charter.accepted'
    | 'session.daily'
  user_id: number | null
  user_label: string | null
  community_id: number | null
  community_name: string | null
}

export type PilotagePlaceHealth = {
  id: number
  slug: string
  name: string
  members: number
  joins_30d: number
  left_30d: number
  active_members_7d: number
}

export type PilotageFunnel = {
  registered: number
  chose_place: number
  continue_without_place: number
  active_d1: number
  active_d7: number
}

export type PilotageKpis = {
  total_users: number
  registrations: number
  joins: number
  continue_without_place: number
  active_24h: number
  dau: number
  wau: number
  mau: number
}

export type PilotageDashboard = {
  days: PilotageDays
  range: { from: string; to: string }
  kpis: PilotageKpis
  series: PilotageSeriesPoint[]
  activity: PilotageActivityItem[]
  funnel: PilotageFunnel
  places: PilotagePlaceHealth[]
  product_alerts: AdminAlert[]
  health: Awaited<ReturnType<typeof buildAdminLoadDashboard>>
  alerts: AdminAlert[]
}

export function normalizePilotageDays(raw: string | null | undefined): PilotageDays {
  const n = Number(raw)
  if (n === 30 || n === 90) return n
  return 7
}

/** Liste des jours civils Paris de `from` inclus à `to` inclus (YYYY-MM-DD). */
export function enumerateParisDaysInclusive(from: string, to: string): string[] {
  const out: string[] = []
  const start = parseParisDayUtcNoon(from)
  const end = parseParisDayUtcNoon(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    out.push(parisDayString(new Date(t)))
  }
  return out
}

function parseParisDayUtcNoon(day: string): Date {
  return new Date(`${day}T12:00:00.000Z`)
}

export function shiftParisDay(day: string, deltaDays: number): string {
  const d = parseParisDayUtcNoon(day)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return parisDayString(d)
}

export function mergeSeriesCounts(
  days: string[],
  registrations: Map<string, number>,
  joins: Map<string, number>,
  dau: Map<string, number>
): PilotageSeriesPoint[] {
  return days.map((day) => ({
    day,
    registrations: registrations.get(day) ?? 0,
    joins: joins.get(day) ?? 0,
    dau: dau.get(day) ?? 0,
  }))
}

export function rowsToDayCountMap(
  rows: Array<{ day: string; n: number }>
): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) m.set(String(r.day).slice(0, 10), Number(r.n) || 0)
  return m
}

export function buildProductAlerts(params: {
  kpis: PilotageKpis
  funnel: PilotageFunnel
  places: PilotagePlaceHealth[]
  days: PilotageDays
}): AdminAlert[] {
  const alerts: AdminAlert[] = []
  const { kpis, funnel, places, days } = params

  if (kpis.registrations >= 5 && kpis.joins === 0) {
    alerts.push({
      id: 'pilotage-no-joins',
      level: 'warning',
      source: 'system',
      title: 'Inscriptions sans rejoindre un lieu',
      detail: `${kpis.registrations} inscriptions / 0 joins sur ${days} j.`,
      href: '/app?page=admin&adminTab=pilotage',
    })
  }

  if (funnel.registered >= 10) {
    const placeRate = funnel.chose_place / funnel.registered
    if (placeRate < 0.25) {
      alerts.push({
        id: 'pilotage-low-place-rate',
        level: 'warning',
        source: 'system',
        title: 'Faible passage vers un lieu',
        detail: `${Math.round(placeRate * 100)} % des inscrits de la période ont rejoint un lieu.`,
        href: '/app?page=admin&adminTab=pilotage',
      })
    }
  }

  if (kpis.dau === 0 && kpis.total_users > 0) {
    alerts.push({
      id: 'pilotage-zero-dau',
      level: 'info',
      source: 'system',
      title: 'Aucun actif aujourd’hui',
      detail: 'Pas encore de connexion enregistrée sur le jour civil Paris.',
      href: '/app?page=admin&adminTab=pilotage',
    })
  }

  const stagnant = places.filter((p) => p.members >= 3 && p.joins_30d === 0 && p.active_members_7d === 0)
  if (stagnant.length > 0) {
    alerts.push({
      id: 'pilotage-stagnant-places',
      level: stagnant.length >= 3 ? 'warning' : 'info',
      source: 'system',
      title: 'Lieux sans activité récente',
      detail: `${stagnant.length} lieu(x) ≥3 membres sans join 30 j ni membre actif 7 j.`,
      href: '/app?page=admin&adminTab=pilotage',
    })
  }

  const levelRank: Record<AdminAlertLevel, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => levelRank[a.level] - levelRank[b.level])
  return alerts
}

/** Jour civil approximatif (DATETIME stocké sans TZ explicite). */
function sqlDayExpr(column: string): string {
  return `DATE(${column})`
}

type SqlParam = string | number | null

async function countScalar(sql: string, params: SqlParam[] = []): Promise<number> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params)
  return Number(rows[0]?.n ?? 0) || 0
}

async function dayCountRows(
  sql: string,
  params: SqlParam[] = []
): Promise<Array<{ day: string; n: number }>> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params)
  return rows.map((r) => ({
    day: String(r.day).slice(0, 10),
    n: Number(r.n) || 0,
  }))
}

export async function buildAdminPilotageDashboard(
  days: PilotageDays
): Promise<PilotageDashboard> {
  await ensureProductPilotageTables()
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const tMembers = table('mandala_community_members')
  const tCommunities = table('mandala_communities')
  const tEvents = table('product_events')
  const tSessions = table('user_session_days')

  const to = parisDayString()
  const from = shiftParisDay(to, -(days - 1))
  const fromDt = `${from} 00:00:00`
  const toExclusive = `${shiftParisDay(to, 1)} 00:00:00`
  const dayList = enumerateParisDaysInclusive(from, to)

  const [
    totalUsers,
    registrations,
    joins,
    continueWithoutPlace,
    active24h,
    dau,
    wau,
    mau,
    regSeries,
    joinSeries,
    dauSeries,
    health,
  ] = await Promise.all([
    countScalar(`SELECT COUNT(*) AS n FROM ${tUsers}`),
    countScalar(
      `SELECT COUNT(*) AS n FROM ${tUsers}
       WHERE user_registered >= ? AND user_registered < ?`,
      [fromDt, toExclusive]
    ),
    countScalar(
      `SELECT COUNT(*) AS n FROM ${tMembers}
       WHERE joined_at >= ? AND joined_at < ?`,
      [fromDt, toExclusive]
    ),
    countScalar(
      `SELECT COUNT(DISTINCT user_id) AS n FROM ${tMeta}
       WHERE meta_key = 'mdl_continue_without_place' AND meta_value = '1'`
    ),
    countScalar(
      `SELECT COUNT(*) AS n FROM ${tMeta}
       WHERE meta_key = 'mdl_social_last_seen_at'
         AND meta_value IS NOT NULL
         AND meta_value <> ''
         AND STR_TO_DATE(meta_value, '%Y-%m-%d %H:%i:%s') >= (UTC_TIMESTAMP() - INTERVAL 24 HOUR)`
    ),
    countScalar(`SELECT COUNT(DISTINCT user_id) AS n FROM ${tSessions} WHERE day_paris = ?`, [to]),
    countScalar(
      `SELECT COUNT(DISTINCT user_id) AS n FROM ${tSessions}
       WHERE day_paris >= ? AND day_paris <= ?`,
      [shiftParisDay(to, -6), to]
    ),
    countScalar(
      `SELECT COUNT(DISTINCT user_id) AS n FROM ${tSessions}
       WHERE day_paris >= ? AND day_paris <= ?`,
      [shiftParisDay(to, -29), to]
    ),
    dayCountRows(
      `SELECT ${sqlDayExpr('user_registered')} AS day, COUNT(*) AS n
       FROM ${tUsers}
       WHERE user_registered >= ? AND user_registered < ?
       GROUP BY day`,
      [fromDt, toExclusive]
    ),
    dayCountRows(
      `SELECT ${sqlDayExpr('joined_at')} AS day, COUNT(*) AS n
       FROM ${tMembers}
       WHERE joined_at >= ? AND joined_at < ?
       GROUP BY day`,
      [fromDt, toExclusive]
    ),
    dayCountRows(
      `SELECT day_paris AS day, COUNT(DISTINCT user_id) AS n
       FROM ${tSessions}
       WHERE day_paris >= ? AND day_paris <= ?
       GROUP BY day_paris`,
      [from, to]
    ),
    buildAdminLoadDashboard(),
  ])

  const series = mergeSeriesCounts(
    dayList,
    rowsToDayCountMap(regSeries),
    rowsToDayCountMap(joinSeries),
    rowsToDayCountMap(dauSeries)
  )

  const [activityRows] = await pool.execute<RowDataPacket[]>(
    `SELECT e.id, e.event_type, e.user_id, e.community_id, e.created_at,
            u.display_name, u.user_email, u.user_login,
            c.name AS community_name
     FROM ${tEvents} e
     LEFT JOIN ${tUsers} u ON u.ID = e.user_id
     LEFT JOIN ${tCommunities} c ON c.id = e.community_id
     WHERE e.created_at >= ? AND e.created_at < ?
       AND e.event_type IN (
         'user.registered','place.joined','place.left',
         'onboarding.continue_without_place','charter.accepted'
       )
     ORDER BY e.created_at DESC
     LIMIT 80`,
    [fromDt, toExclusive]
  )

  // Fallback fil : tables legacy si peu d’events
  let activity: PilotageActivityItem[] = activityRows.map((r) => ({
    at: r.created_at ? String(r.created_at) : '',
    kind: String(r.event_type) as PilotageActivityItem['kind'],
    user_id: r.user_id != null ? Number(r.user_id) : null,
    user_label:
      (r.display_name && String(r.display_name).trim()) ||
      (r.user_login && String(r.user_login).trim()) ||
      (r.user_email && String(r.user_email).trim()) ||
      null,
    community_id: r.community_id != null ? Number(r.community_id) : null,
    community_name: r.community_name != null ? String(r.community_name) : null,
  }))

  if (activity.length < 5) {
    const [regRows] = await pool.execute<RowDataPacket[]>(
      `SELECT ID AS user_id, display_name, user_login, user_email, user_registered AS at
       FROM ${tUsers}
       WHERE user_registered >= ? AND user_registered < ?
       ORDER BY user_registered DESC
       LIMIT 40`,
      [fromDt, toExclusive]
    )
    const [joinRows] = await pool.execute<RowDataPacket[]>(
      `SELECT m.user_id, m.community_id, m.joined_at AS at,
              u.display_name, u.user_login, u.user_email, c.name AS community_name
       FROM ${tMembers} m
       LEFT JOIN ${tUsers} u ON u.ID = m.user_id
       LEFT JOIN ${tCommunities} c ON c.id = m.community_id
       WHERE m.joined_at >= ? AND m.joined_at < ?
       ORDER BY m.joined_at DESC
       LIMIT 40`,
      [fromDt, toExclusive]
    )
    const legacy: PilotageActivityItem[] = [
      ...regRows.map((r) => ({
        at: r.at ? String(r.at) : '',
        kind: 'user.registered' as const,
        user_id: Number(r.user_id) || null,
        user_label:
          (r.display_name && String(r.display_name).trim()) ||
          (r.user_login && String(r.user_login).trim()) ||
          (r.user_email && String(r.user_email).trim()) ||
          null,
        community_id: null,
        community_name: null,
      })),
      ...joinRows.map((r) => ({
        at: r.at ? String(r.at) : '',
        kind: 'place.joined' as const,
        user_id: Number(r.user_id) || null,
        user_label:
          (r.display_name && String(r.display_name).trim()) ||
          (r.user_login && String(r.user_login).trim()) ||
          (r.user_email && String(r.user_email).trim()) ||
          null,
        community_id: r.community_id != null ? Number(r.community_id) : null,
        community_name: r.community_name != null ? String(r.community_name) : null,
      })),
    ]
    legacy.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    const seen = new Set(activity.map((a) => `${a.kind}:${a.at}:${a.user_id}:${a.community_id}`))
    for (const item of legacy) {
      const key = `${item.kind}:${item.at}:${item.user_id}:${item.community_id}`
      if (seen.has(key)) continue
      activity.push(item)
      seen.add(key)
      if (activity.length >= 80) break
    }
    activity.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  }

  const funnelRegistered = registrations
  const [chosePlace, funnelContinue, activeD1, activeD7] = await Promise.all([
    countScalar(
      `SELECT COUNT(DISTINCT m.user_id) AS n
       FROM ${tMembers} m
       INNER JOIN ${tUsers} u ON u.ID = m.user_id
       WHERE u.user_registered >= ? AND u.user_registered < ?`,
      [fromDt, toExclusive]
    ),
    countScalar(
      `SELECT COUNT(DISTINCT um.user_id) AS n
       FROM ${tMeta} um
       INNER JOIN ${tUsers} u ON u.ID = um.user_id
       WHERE um.meta_key = 'mdl_continue_without_place' AND um.meta_value = '1'
         AND u.user_registered >= ? AND u.user_registered < ?`,
      [fromDt, toExclusive]
    ),
    countScalar(
      `SELECT COUNT(DISTINCT s.user_id) AS n
       FROM ${tSessions} s
       INNER JOIN ${tUsers} u ON u.ID = s.user_id
       WHERE u.user_registered >= ? AND u.user_registered < ?
         AND s.day_paris = DATE_ADD(${sqlDayExpr('u.user_registered')}, INTERVAL 1 DAY)`,
      [fromDt, toExclusive]
    ),
    countScalar(
      `SELECT COUNT(DISTINCT s.user_id) AS n
       FROM ${tSessions} s
       INNER JOIN ${tUsers} u ON u.ID = s.user_id
       WHERE u.user_registered >= ? AND u.user_registered < ?
         AND s.day_paris BETWEEN ${sqlDayExpr('u.user_registered')}
           AND DATE_ADD(${sqlDayExpr('u.user_registered')}, INTERVAL 7 DAY)`,
      [fromDt, toExclusive]
    ),
  ])

  const [placeRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name,
            (SELECT COUNT(*) FROM ${tMembers} m WHERE m.community_id = c.id) AS members,
            (SELECT COUNT(*) FROM ${tMembers} m
              WHERE m.community_id = c.id
                AND m.joined_at >= (UTC_TIMESTAMP() - INTERVAL 30 DAY)) AS joins_30d,
            (SELECT COUNT(*) FROM ${tEvents} e
              WHERE e.community_id = c.id
                AND e.event_type = 'place.left'
                AND e.created_at >= (UTC_TIMESTAMP() - INTERVAL 30 DAY)) AS left_30d,
            (SELECT COUNT(DISTINCT m.user_id) FROM ${tMembers} m
              INNER JOIN ${tSessions} s ON s.user_id = m.user_id
              WHERE m.community_id = c.id
                AND s.day_paris >= ?) AS active_members_7d
     FROM ${tCommunities} c
     WHERE c.is_active = 1
     ORDER BY members DESC, c.name ASC
     LIMIT 50`,
    [shiftParisDay(to, -6)]
  )

  const places: PilotagePlaceHealth[] = placeRows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    members: Number(r.members) || 0,
    joins_30d: Number(r.joins_30d) || 0,
    left_30d: Number(r.left_30d) || 0,
    active_members_7d: Number(r.active_members_7d) || 0,
  }))

  const kpis: PilotageKpis = {
    total_users: totalUsers,
    registrations,
    joins,
    continue_without_place: continueWithoutPlace,
    active_24h: active24h,
    dau,
    wau,
    mau,
  }

  const funnel: PilotageFunnel = {
    registered: funnelRegistered,
    chose_place: chosePlace,
    continue_without_place: funnelContinue,
    active_d1: activeD1,
    active_d7: activeD7,
  }

  const product_alerts = buildProductAlerts({ kpis, funnel, places, days })
  const alerts = [...health.alerts, ...product_alerts]
  const levelRank: Record<AdminAlertLevel, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => levelRank[a.level] - levelRank[b.level])

  return {
    days,
    range: { from, to },
    kpis,
    series,
    activity,
    funnel,
    places,
    product_alerts,
    health,
    alerts,
  }
}

export function pilotageSeriesToCsv(series: PilotageSeriesPoint[]): string {
  const header = 'day,registrations,joins,dau'
  const lines = series.map(
    (s) => `${s.day},${s.registrations},${s.joins},${s.dau}`
  )
  return [header, ...lines].join('\n')
}

export function pilotageActivityToCsv(activity: PilotageActivityItem[]): string {
  const header = 'at,kind,user_id,user_label,community_id,community_name'
  const esc = (v: string | number | null) => {
    if (v == null) return ''
    const s = String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = activity.map(
    (a) =>
      [
        esc(a.at),
        esc(a.kind),
        esc(a.user_id),
        esc(a.user_label),
        esc(a.community_id),
        esc(a.community_name),
      ].join(',')
  )
  return [header, ...lines].join('\n')
}
