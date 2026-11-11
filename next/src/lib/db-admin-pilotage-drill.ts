/**
 * Drill-down listes pour l’onglet Admin Pilotage.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from '@/lib/db'
import { ensureProductPilotageTables } from '@/lib/db-product-events'
import { parisDayString } from '@/lib/paris-day'
import {
  normalizePilotageDays,
  shiftParisDay,
  type PilotageDays,
} from '@/lib/db-admin-pilotage'

export const PILOTAGE_DRILL_KINDS = [
  'total_users',
  'registrations',
  'joins',
  'continue_without_place',
  'active_24h',
  'dau',
  'wau',
  'mau',
  'funnel_registered',
  'funnel_place',
  'funnel_no_place',
  'funnel_d1',
  'funnel_d7',
  'series_day',
  'place',
  'alert',
] as const

export type PilotageDrillKind = (typeof PILOTAGE_DRILL_KINDS)[number]

export type PilotageSeriesMetric = 'registrations' | 'joins' | 'dau'

export type PilotageDrillItem = {
  user_id: number | null
  label: string | null
  at: string | null
  community_id: number | null
  community_name: string | null
  meta: string | null
}

export type PilotageDrillResult = {
  title: string
  kind: PilotageDrillKind
  items: PilotageDrillItem[]
  next_cursor: string | null
}

export function isPilotageDrillKind(raw: string | null | undefined): raw is PilotageDrillKind {
  return !!raw && (PILOTAGE_DRILL_KINDS as readonly string[]).includes(raw)
}

export function normalizeSeriesMetric(raw: string | null | undefined): PilotageSeriesMetric {
  if (raw === 'joins' || raw === 'dau') return raw
  return 'registrations'
}

export function pilotageDrillTitle(params: {
  kind: PilotageDrillKind
  days: PilotageDays
  day?: string | null
  metric?: PilotageSeriesMetric
  alertId?: string | null
  placeName?: string | null
}): string {
  const { kind, days, day, metric, alertId, placeName } = params
  switch (kind) {
    case 'total_users':
      return 'Tous les comptes'
    case 'registrations':
      return `Inscriptions (${days} j)`
    case 'joins':
      return `Joins — rejoindre un lieu (${days} j)`
    case 'continue_without_place':
      return 'Continuer sans lieu'
    case 'active_24h':
      return 'Actifs (dernières 24 h)'
    case 'dau':
      return 'DAU — visiteurs uniques aujourd’hui'
    case 'wau':
      return 'WAU — visiteurs uniques 7 j'
    case 'mau':
      return 'MAU — visiteurs uniques 30 j'
    case 'funnel_registered':
      return `Funnel — inscrits (${days} j)`
    case 'funnel_place':
      return `Funnel — ont rejoint un lieu (${days} j)`
    case 'funnel_no_place':
      return `Funnel — sans lieu (${days} j)`
    case 'funnel_d1':
      return `Funnel — actifs J+1 (${days} j)`
    case 'funnel_d7':
      return `Funnel — actifs ≤ J+7 (${days} j)`
    case 'series_day': {
      const m =
        metric === 'joins' ? 'Joins' : metric === 'dau' ? 'DAU' : 'Inscriptions'
      return `${m} — ${day ?? 'jour'}`
    }
    case 'place':
      return placeName ? `Lieu — ${placeName}` : 'Lieu'
    case 'alert':
      return alertId ? `Alerte — ${alertId}` : 'Alerte'
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

function userLabel(r: RowDataPacket): string | null {
  return (
    (r.display_name && String(r.display_name).trim()) ||
    (r.user_login && String(r.user_login).trim()) ||
    (r.user_email && String(r.user_email).trim()) ||
    null
  )
}

function mapUserRows(rows: RowDataPacket[]): PilotageDrillItem[] {
  return rows.map((r) => ({
    user_id: r.user_id != null ? Number(r.user_id) : r.ID != null ? Number(r.ID) : null,
    label: userLabel(r),
    at: r.at != null ? String(r.at) : r.user_registered != null ? String(r.user_registered) : null,
    community_id: r.community_id != null ? Number(r.community_id) : null,
    community_name: r.community_name != null ? String(r.community_name) : null,
    meta: r.meta != null ? String(r.meta) : null,
  }))
}

function periodBounds(days: PilotageDays): { from: string; to: string; fromDt: string; toExclusive: string } {
  const to = parisDayString()
  const from = shiftParisDay(to, -(days - 1))
  return {
    from,
    to,
    fromDt: `${from} 00:00:00`,
    toExclusive: `${shiftParisDay(to, 1)} 00:00:00`,
  }
}

export async function buildPilotageDrill(params: {
  kind: PilotageDrillKind
  days?: PilotageDays
  day?: string | null
  metric?: PilotageSeriesMetric
  communityId?: number | null
  alertId?: string | null
  cursor?: string | null
  limit?: number
}): Promise<PilotageDrillResult> {
  await ensureProductPilotageTables()
  const days = params.days ?? 7
  const limit = Math.min(100, Math.max(1, params.limit ?? 50))
  const offset = Math.max(0, Number(params.cursor ?? 0) || 0)
  const metric = params.metric ?? 'registrations'
  const { from, to, fromDt, toExclusive } = periodBounds(days)

  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const tMembers = table('mandala_community_members')
  const tCommunities = table('mandala_communities')
  const tEvents = table('product_events')
  const tSessions = table('user_session_days')

  let title = pilotageDrillTitle({
    kind: params.kind,
    days,
    day: params.day,
    metric,
    alertId: params.alertId,
  })
  let rows: RowDataPacket[] = []

  const fetchMore = async (sql: string, sqlParams: Array<string | number | null>) => {
    const [r] = await pool.execute<RowDataPacket[]>(sql, [...sqlParams, limit + 1, offset])
    rows = r
  }

  switch (params.kind) {
    case 'total_users':
      await fetchMore(
        `SELECT ID AS user_id, display_name, user_login, user_email, user_registered AS at
         FROM ${tUsers}
         ORDER BY user_registered DESC
         LIMIT ? OFFSET ?`,
        []
      )
      break
    case 'registrations':
    case 'funnel_registered':
      await fetchMore(
        `SELECT ID AS user_id, display_name, user_login, user_email, user_registered AS at
         FROM ${tUsers}
         WHERE user_registered >= ? AND user_registered < ?
         ORDER BY user_registered DESC
         LIMIT ? OFFSET ?`,
        [fromDt, toExclusive]
      )
      break
    case 'joins':
      await fetchMore(
        `SELECT m.user_id, m.joined_at AS at, m.community_id, c.name AS community_name,
                u.display_name, u.user_login, u.user_email
         FROM ${tMembers} m
         LEFT JOIN ${tUsers} u ON u.ID = m.user_id
         LEFT JOIN ${tCommunities} c ON c.id = m.community_id
         WHERE m.joined_at >= ? AND m.joined_at < ?
         ORDER BY m.joined_at DESC
         LIMIT ? OFFSET ?`,
        [fromDt, toExclusive]
      )
      break
    case 'continue_without_place':
      await fetchMore(
        `SELECT um.user_id, u.display_name, u.user_login, u.user_email, u.user_registered AS at
         FROM ${tMeta} um
         INNER JOIN ${tUsers} u ON u.ID = um.user_id
         WHERE um.meta_key = 'mdl_continue_without_place' AND um.meta_value = '1'
         ORDER BY u.user_registered DESC
         LIMIT ? OFFSET ?`,
        []
      )
      break
    case 'active_24h':
      await fetchMore(
        `SELECT um.user_id, um.meta_value AS at, u.display_name, u.user_login, u.user_email
         FROM ${tMeta} um
         INNER JOIN ${tUsers} u ON u.ID = um.user_id
         WHERE um.meta_key = 'mdl_social_last_seen_at'
           AND um.meta_value IS NOT NULL AND um.meta_value <> ''
           AND STR_TO_DATE(um.meta_value, '%Y-%m-%d %H:%i:%s') >= (UTC_TIMESTAMP() - INTERVAL 24 HOUR)
         ORDER BY um.meta_value DESC
         LIMIT ? OFFSET ?`,
        []
      )
      break
    case 'dau':
      await fetchMore(
        `SELECT s.user_id, s.last_seen_at AS at, u.display_name, u.user_login, u.user_email
         FROM ${tSessions} s
         INNER JOIN ${tUsers} u ON u.ID = s.user_id
         WHERE s.day_paris = ?
         ORDER BY s.last_seen_at DESC
         LIMIT ? OFFSET ?`,
        [to]
      )
      break
    case 'wau':
      await fetchMore(
        `SELECT s.user_id, MAX(s.last_seen_at) AS at, u.display_name, u.user_login, u.user_email
         FROM ${tSessions} s
         INNER JOIN ${tUsers} u ON u.ID = s.user_id
         WHERE s.day_paris >= ? AND s.day_paris <= ?
         GROUP BY s.user_id, u.display_name, u.user_login, u.user_email
         ORDER BY at DESC
         LIMIT ? OFFSET ?`,
        [shiftParisDay(to, -6), to]
      )
      break
    case 'mau':
      await fetchMore(
        `SELECT s.user_id, MAX(s.last_seen_at) AS at, u.display_name, u.user_login, u.user_email
         FROM ${tSessions} s
         INNER JOIN ${tUsers} u ON u.ID = s.user_id
         WHERE s.day_paris >= ? AND s.day_paris <= ?
         GROUP BY s.user_id, u.display_name, u.user_login, u.user_email
         ORDER BY at DESC
         LIMIT ? OFFSET ?`,
        [shiftParisDay(to, -29), to]
      )
      break
    case 'funnel_place':
      await fetchMore(
        `SELECT DISTINCT m.user_id, u.display_name, u.user_login, u.user_email, u.user_registered AS at
         FROM ${tMembers} m
         INNER JOIN ${tUsers} u ON u.ID = m.user_id
         WHERE u.user_registered >= ? AND u.user_registered < ?
         ORDER BY u.user_registered DESC
         LIMIT ? OFFSET ?`,
        [fromDt, toExclusive]
      )
      break
    case 'funnel_no_place':
      await fetchMore(
        `SELECT um.user_id, u.display_name, u.user_login, u.user_email, u.user_registered AS at
         FROM ${tMeta} um
         INNER JOIN ${tUsers} u ON u.ID = um.user_id
         WHERE um.meta_key = 'mdl_continue_without_place' AND um.meta_value = '1'
           AND u.user_registered >= ? AND u.user_registered < ?
         ORDER BY u.user_registered DESC
         LIMIT ? OFFSET ?`,
        [fromDt, toExclusive]
      )
      break
    case 'funnel_d1':
      await fetchMore(
        `SELECT s.user_id, s.last_seen_at AS at, u.display_name, u.user_login, u.user_email
         FROM ${tSessions} s
         INNER JOIN ${tUsers} u ON u.ID = s.user_id
         WHERE u.user_registered >= ? AND u.user_registered < ?
           AND s.day_paris = DATE_ADD(DATE(u.user_registered), INTERVAL 1 DAY)
         ORDER BY s.last_seen_at DESC
         LIMIT ? OFFSET ?`,
        [fromDt, toExclusive]
      )
      break
    case 'funnel_d7':
      await fetchMore(
        `SELECT s.user_id, MAX(s.last_seen_at) AS at, u.display_name, u.user_login, u.user_email
         FROM ${tSessions} s
         INNER JOIN ${tUsers} u ON u.ID = s.user_id
         WHERE u.user_registered >= ? AND u.user_registered < ?
           AND s.day_paris BETWEEN DATE(u.user_registered)
             AND DATE_ADD(DATE(u.user_registered), INTERVAL 7 DAY)
         GROUP BY s.user_id, u.display_name, u.user_login, u.user_email
         ORDER BY at DESC
         LIMIT ? OFFSET ?`,
        [fromDt, toExclusive]
      )
      break
    case 'series_day': {
      const day = (params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : to) as string
      title = pilotageDrillTitle({ kind: 'series_day', days, day, metric })
      if (metric === 'registrations') {
        await fetchMore(
          `SELECT ID AS user_id, display_name, user_login, user_email, user_registered AS at
           FROM ${tUsers}
           WHERE DATE(user_registered) = ?
           ORDER BY user_registered DESC
           LIMIT ? OFFSET ?`,
          [day]
        )
      } else if (metric === 'joins') {
        await fetchMore(
          `SELECT m.user_id, m.joined_at AS at, m.community_id, c.name AS community_name,
                  u.display_name, u.user_login, u.user_email
           FROM ${tMembers} m
           LEFT JOIN ${tUsers} u ON u.ID = m.user_id
           LEFT JOIN ${tCommunities} c ON c.id = m.community_id
           WHERE DATE(m.joined_at) = ?
           ORDER BY m.joined_at DESC
           LIMIT ? OFFSET ?`,
          [day]
        )
      } else {
        await fetchMore(
          `SELECT s.user_id, s.last_seen_at AS at, u.display_name, u.user_login, u.user_email
           FROM ${tSessions} s
           INNER JOIN ${tUsers} u ON u.ID = s.user_id
           WHERE s.day_paris = ?
           ORDER BY s.last_seen_at DESC
           LIMIT ? OFFSET ?`,
          [day]
        )
      }
      break
    }
    case 'place': {
      const communityId = Number(params.communityId)
      if (!Number.isFinite(communityId) || communityId <= 0) {
        throw Object.assign(new Error('community_id requis'), { status: 400 })
      }
      const [cRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, name, slug FROM ${tCommunities} WHERE id = ? LIMIT 1`,
        [communityId]
      )
      if (!cRows[0]) throw Object.assign(new Error('Lieu introuvable'), { status: 404 })
      title = pilotageDrillTitle({
        kind: 'place',
        days,
        placeName: String(cRows[0].name),
      })
      await fetchMore(
        `SELECT m.user_id, m.joined_at AS at, m.role AS meta, m.community_id,
                ? AS community_name, u.display_name, u.user_login, u.user_email
         FROM ${tMembers} m
         LEFT JOIN ${tUsers} u ON u.ID = m.user_id
         WHERE m.community_id = ?
         ORDER BY m.joined_at DESC
         LIMIT ? OFFSET ?`,
        [String(cRows[0].name), communityId]
      )
      break
    }
    case 'alert': {
      const alertId = String(params.alertId || '')
      title = pilotageDrillTitle({ kind: 'alert', days, alertId })
      if (alertId === 'pilotage-no-joins' || alertId === 'pilotage-low-place-rate') {
        await fetchMore(
          `SELECT ID AS user_id, display_name, user_login, user_email, user_registered AS at
           FROM ${tUsers}
           WHERE user_registered >= ? AND user_registered < ?
             AND ID NOT IN (SELECT DISTINCT user_id FROM ${tMembers})
           ORDER BY user_registered DESC
           LIMIT ? OFFSET ?`,
          [fromDt, toExclusive]
        )
      } else if (alertId === 'pilotage-zero-dau') {
        await fetchMore(
          `SELECT ID AS user_id, display_name, user_login, user_email, user_registered AS at
           FROM ${tUsers}
           ORDER BY user_registered DESC
           LIMIT ? OFFSET ?`,
          []
        )
      } else if (alertId === 'pilotage-stagnant-places') {
        const weekFrom = shiftParisDay(to, -6)
        const [pRows] = await pool.execute<RowDataPacket[]>(
          `SELECT c.id AS community_id, c.name AS community_name, c.slug AS meta
           FROM ${tCommunities} c
           WHERE c.is_active = 1
             AND (SELECT COUNT(*) FROM ${tMembers} m WHERE m.community_id = c.id) >= 3
             AND (SELECT COUNT(*) FROM ${tMembers} m
                  WHERE m.community_id = c.id
                    AND m.joined_at >= (UTC_TIMESTAMP() - INTERVAL 30 DAY)) = 0
             AND (SELECT COUNT(DISTINCT m.user_id) FROM ${tMembers} m
                  INNER JOIN ${tSessions} s ON s.user_id = m.user_id
                  WHERE m.community_id = c.id AND s.day_paris >= ?) = 0
           ORDER BY (SELECT COUNT(*) FROM ${tMembers} m WHERE m.community_id = c.id) DESC
           LIMIT ? OFFSET ?`,
          [weekFrom, limit + 1, offset]
        )
        rows = pRows
      } else {
        // fallback : activity events période
        await fetchMore(
          `SELECT e.user_id, e.created_at AS at, e.community_id, e.event_type AS meta,
                  u.display_name, u.user_login, u.user_email, c.name AS community_name
           FROM ${tEvents} e
           LEFT JOIN ${tUsers} u ON u.ID = e.user_id
           LEFT JOIN ${tCommunities} c ON c.id = e.community_id
           WHERE e.created_at >= ? AND e.created_at < ?
           ORDER BY e.created_at DESC
           LIMIT ? OFFSET ?`,
          [fromDt, toExclusive]
        )
      }
      break
    }
    default: {
      const _exhaustive: never = params.kind
      throw Object.assign(new Error(`kind inconnu: ${_exhaustive}`), { status: 400 })
    }
  }

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const items = mapUserRows(page)
  // place-only alert rows without user
  if (params.kind === 'alert' && params.alertId === 'pilotage-stagnant-places') {
    for (let i = 0; i < items.length; i++) {
      const src = page[i]
      items[i] = {
        user_id: null,
        label: src.community_name != null ? String(src.community_name) : items[i].label,
        at: null,
        community_id: src.community_id != null ? Number(src.community_id) : null,
        community_name: src.community_name != null ? String(src.community_name) : null,
        meta: src.meta != null ? String(src.meta) : null,
      }
    }
  }

  return {
    title,
    kind: params.kind,
    items,
    next_cursor: hasMore ? String(offset + limit) : null,
  }
}

export function parseDrillQuery(searchParams: URLSearchParams): {
  kind: PilotageDrillKind
  days: PilotageDays
  day: string | null
  metric: PilotageSeriesMetric
  communityId: number | null
  alertId: string | null
  cursor: string | null
  limit: number
} {
  const kindRaw = searchParams.get('kind')
  if (!isPilotageDrillKind(kindRaw)) {
    throw Object.assign(new Error('kind invalide'), { status: 400 })
  }
  const communityRaw = searchParams.get('community_id')
  const communityId = communityRaw ? Number(communityRaw) : null
  return {
    kind: kindRaw,
    days: normalizePilotageDays(searchParams.get('days')),
    day: searchParams.get('day'),
    metric: normalizeSeriesMetric(searchParams.get('metric')),
    communityId: communityId && Number.isFinite(communityId) ? communityId : null,
    alertId: searchParams.get('alert_id'),
    cursor: searchParams.get('cursor'),
    limit: Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50) || 50)),
  }
}
