/**
 * Mur d'actualité — agrégation événements, annonces et brèves Agora.
 * Visiteurs : aperçus publics. Membres connectés : contenu complet de leurs lieux.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import { listCommunitiesForUser } from './db-communities'
import { ensureEventsTables } from './db-mandala-events'
import { ensurePlaceAnnouncementTables } from './db-place-announcements'
import { ensurePostTables } from './db-posts'
import { getEventEffectiveEnd } from './event-dates'
import { isEventOngoing, isEventPast, isEventUpcoming } from './event-temporal'
import { normalizeDbDateTime } from './format-datetime'
import type { WallFeedItem, WallFeedSort, WallPlaceRef } from './wall-feed-types'

const PUBLIC_ANNOUNCEMENT_LIMIT = 8
const PUBLIC_POST_LIMIT = 8
const PUBLIC_EVENT_LIMIT = 12
const PUBLIC_PAST_EVENT_DAYS = 60
const MEMBER_ANNOUNCEMENT_PER_PLACE = 10
const MEMBER_POST_PER_PLACE = 15
const MEMBER_EVENT_PER_PLACE = 10

function isUpcomingEvent(ev: {
  starts_at: string | null
  ends_at: string | null
  phase: string
}): boolean {
  return isEventUpcoming(ev)
}

function isRecentlyPastEvent(ev: {
  starts_at: string | null
  ends_at: string | null
  phase: string
}): boolean {
  if (!isEventPast(ev)) return false
  const end = getEventEffectiveEnd(ev.starts_at, ev.ends_at)
  if (!end) return false
  const cutoff = Date.now() - PUBLIC_PAST_EVENT_DAYS * 86400000
  return end.getTime() >= cutoff
}

function eventFeedMeta(ev: {
  starts_at: string | null
  ends_at: string | null
  phase: string
  created_at: string | null
}): { is_past: boolean; is_ongoing: boolean; sort_at: string } {
  const ongoing = isEventOngoing(ev)
  const past = isEventPast(ev)
  const sort_at = past
    ? normalizeDbDateTime(ev.ends_at) ?? normalizeDbDateTime(ev.starts_at) ?? ev.created_at ?? new Date().toISOString()
    : normalizeDbDateTime(ev.starts_at) ?? ev.created_at ?? new Date().toISOString()
  return { is_past: past, is_ongoing: ongoing, sort_at }
}

function placeRefFromRow(r: RowDataPacket): WallPlaceRef {
  return {
    id: Number(r.community_id ?? r.place_id ?? r.id),
    slug: String(r.place_slug ?? r.slug ?? ''),
    name: String(r.place_name ?? r.name ?? ''),
    logo_emoji: r.logo_emoji != null ? String(r.logo_emoji) : null,
    accent_color: r.accent_color != null ? String(r.accent_color) : null,
    avatar:
      r.place_avatar != null
        ? String(r.place_avatar)
        : r.avatar != null
          ? String(r.avatar)
          : null,
  }
}

async function fetchPublicWallEvents(limit: number): Promise<WallFeedItem[]> {
  if (!isDbConfigured()) return []
  await ensureEventsTables()
  const pool = getPool()
  const tE = table('events')
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT e.id, e.title, e.description, e.starts_at, e.ends_at, e.location, e.phase, e.cover_image, e.created_at,
            c.id AS community_id, c.slug AS place_slug, c.name AS place_name,
            c.logo_emoji, c.accent_color, c.avatar AS place_avatar
     FROM ${tE} e
     JOIN ${tC} c ON c.id = e.community_id AND c.is_active = 1
     WHERE e.status = 'published' AND e.wall_public = 1
     ORDER BY COALESCE(e.ends_at, e.starts_at, e.created_at) DESC
     LIMIT ?`,
    [Math.min(limit * 4, 80)]
  )

  const items: WallFeedItem[] = []
  for (const r of rows ?? []) {
    const ev = {
      starts_at: normalizeDbDateTime(r.starts_at),
      ends_at: normalizeDbDateTime(r.ends_at),
      phase: String(r.phase ?? 'preparation'),
      created_at: normalizeDbDateTime(r.created_at),
    }
    const upcoming = isUpcomingEvent(ev)
    const recentlyPast = isRecentlyPastEvent(ev)
    if (!upcoming && !recentlyPast) continue

    const { is_past, is_ongoing, sort_at } = eventFeedMeta(ev)
    const place = placeRefFromRow(r)
    items.push({
      kind: 'event',
      id: `event-${r.id}`,
      event_id: Number(r.id),
      sort_at,
      place,
      title: String(r.title),
      description: r.description ? String(r.description) : null,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      location: r.location ? String(r.location) : null,
      phase: ev.phase,
      cover_image: r.cover_image ? String(r.cover_image) : null,
      is_past,
      is_ongoing,
    })
    if (items.length >= limit) break
  }
  return items
}

async function fetchPublicAnnouncements(limit: number): Promise<WallFeedItem[]> {
  if (!isDbConfigured()) return []
  await ensurePlaceAnnouncementTables()
  const pool = getPool()
  const tA = table('mandala_place_announcements')
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.id, a.title, a.body, a.image_data, a.created_at,
            c.id AS community_id, c.slug AS place_slug, c.name AS place_name,
            c.logo_emoji, c.accent_color, c.avatar AS place_avatar,
            COALESCE(pm.meta_value, u.display_name, CONCAT('user_', a.author_id)) AS author_pseudo,
            COALESCE(em.meta_value, '🌸') AS author_avatar_emoji
     FROM ${tA} a
     JOIN ${tC} c ON c.id = a.community_id AND c.is_active = 1
     JOIN ${table('users')} u ON u.ID = a.author_id
     LEFT JOIN ${table('usermeta')} pm ON pm.user_id = a.author_id AND pm.meta_key = 'mdl_pseudo'
     LEFT JOIN ${table('usermeta')} em ON em.user_id = a.author_id AND em.meta_key = 'mdl_avatar_emoji'
     WHERE a.wall_public = 1
     ORDER BY a.created_at DESC
     LIMIT ?`,
    [limit]
  )

  return (rows ?? []).map((r) => {
    const place = placeRefFromRow(r)
    return {
      kind: 'announcement' as const,
      id: `announcement-${r.id}`,
      announcement_id: Number(r.id),
      sort_at: normalizeDbDateTime(r.created_at) ?? new Date().toISOString(),
      place,
      title: String(r.title),
      body: String(r.body),
      image_data: r.image_data ? String(r.image_data) : null,
      author_pseudo: String(r.author_pseudo),
      author_avatar_emoji: String(r.author_avatar_emoji || '🌸'),
    }
  })
}

async function fetchPublicPosts(limit: number): Promise<WallFeedItem[]> {
  if (!isDbConfigured()) return []
  await ensurePostTables()
  const pool = getPool()
  const tP = table('mandala_posts')
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.type, p.content, p.created_at,
            c.id AS community_id, c.slug AS place_slug, c.name AS place_name,
            c.logo_emoji, c.accent_color, c.avatar AS place_avatar,
            COALESCE(pm.meta_value, u.display_name, CONCAT('user_', p.author_id)) AS author_pseudo,
            COALESCE(em.meta_value, '🌸') AS author_avatar_emoji
     FROM ${tP} p
     JOIN ${tC} c ON c.id = p.community_id AND c.is_active = 1
     JOIN ${table('users')} u ON u.ID = p.author_id
     LEFT JOIN ${table('usermeta')} pm ON pm.user_id = p.author_id AND pm.meta_key = 'mdl_pseudo'
     LEFT JOIN ${table('usermeta')} em ON em.user_id = p.author_id AND em.meta_key = 'mdl_avatar_emoji'
     WHERE p.wall_public = 1
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [limit]
  )

  return (rows ?? []).map((r) => ({
    kind: 'post' as const,
    id: `post-${r.id}`,
    post_id: Number(r.id),
    sort_at: normalizeDbDateTime(r.created_at) ?? new Date().toISOString(),
    place: placeRefFromRow(r),
    post_type: r.type === 'logistics' ? 'logistics' : 'inspiration',
    content: String(r.content),
    author_pseudo: String(r.author_pseudo),
    author_avatar_emoji: String(r.author_avatar_emoji || '🌸'),
  }))
}

async function fetchMemberAnnouncements(
  communityIds: number[],
  perPlace: number
): Promise<WallFeedItem[]> {
  if (!communityIds.length || !isDbConfigured()) return []
  await ensurePlaceAnnouncementTables()
  const pool = getPool()
  const tA = table('mandala_place_announcements')
  const tC = table('mandala_communities')
  const placeholders = communityIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.id, a.title, a.body, a.image_data, a.created_at,
            c.id AS community_id, c.slug AS place_slug, c.name AS place_name,
            c.logo_emoji, c.accent_color, c.avatar AS place_avatar,
            COALESCE(pm.meta_value, u.display_name, CONCAT('user_', a.author_id)) AS author_pseudo,
            COALESCE(em.meta_value, '🌸') AS author_avatar_emoji
     FROM ${tA} a
     JOIN ${tC} c ON c.id = a.community_id
     JOIN ${table('users')} u ON u.ID = a.author_id
     LEFT JOIN ${table('usermeta')} pm ON pm.user_id = a.author_id AND pm.meta_key = 'mdl_pseudo'
     LEFT JOIN ${table('usermeta')} em ON em.user_id = a.author_id AND em.meta_key = 'mdl_avatar_emoji'
     WHERE a.community_id IN (${placeholders})
     ORDER BY a.created_at DESC
     LIMIT ?`,
    [...communityIds, Math.min(communityIds.length * perPlace, 80)]
  )

  return (rows ?? []).map((r) => ({
    kind: 'announcement' as const,
    id: `announcement-${r.id}`,
    announcement_id: Number(r.id),
    sort_at: normalizeDbDateTime(r.created_at) ?? new Date().toISOString(),
    place: placeRefFromRow(r),
    title: String(r.title),
    body: String(r.body),
    image_data: r.image_data ? String(r.image_data) : null,
    author_pseudo: String(r.author_pseudo),
    author_avatar_emoji: String(r.author_avatar_emoji || '🌸'),
  }))
}

async function fetchMemberPosts(communityIds: number[], perPlace: number): Promise<WallFeedItem[]> {
  if (!communityIds.length || !isDbConfigured()) return []
  await ensurePostTables()
  const pool = getPool()
  const tP = table('mandala_posts')
  const tC = table('mandala_communities')
  const placeholders = communityIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.type, p.content, p.created_at,
            c.id AS community_id, c.slug AS place_slug, c.name AS place_name,
            c.logo_emoji, c.accent_color, c.avatar AS place_avatar,
            COALESCE(pm.meta_value, u.display_name, CONCAT('user_', p.author_id)) AS author_pseudo,
            COALESCE(em.meta_value, '🌸') AS author_avatar_emoji
     FROM ${tP} p
     JOIN ${tC} c ON c.id = p.community_id
     JOIN ${table('users')} u ON u.ID = p.author_id
     LEFT JOIN ${table('usermeta')} pm ON pm.user_id = p.author_id AND pm.meta_key = 'mdl_pseudo'
     LEFT JOIN ${table('usermeta')} em ON em.user_id = p.author_id AND em.meta_key = 'mdl_avatar_emoji'
     WHERE p.community_id IN (${placeholders})
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [...communityIds, Math.min(communityIds.length * perPlace, 100)]
  )

  return (rows ?? []).map((r) => ({
    kind: 'post' as const,
    id: `post-${r.id}`,
    post_id: Number(r.id),
    sort_at: normalizeDbDateTime(r.created_at) ?? new Date().toISOString(),
    place: placeRefFromRow(r),
    post_type: r.type === 'logistics' ? 'logistics' : 'inspiration',
    content: String(r.content),
    author_pseudo: String(r.author_pseudo),
    author_avatar_emoji: String(r.author_avatar_emoji || '🌸'),
  }))
}

async function fetchMemberEvents(communityIds: number[], perPlace: number): Promise<WallFeedItem[]> {
  if (!communityIds.length || !isDbConfigured()) return []
  await ensureEventsTables()
  const pool = getPool()
  const tE = table('events')
  const tC = table('mandala_communities')
  const placeholders = communityIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT e.id, e.title, e.description, e.starts_at, e.ends_at, e.location, e.phase, e.cover_image, e.created_at,
            c.id AS community_id, c.slug AS place_slug, c.name AS place_name,
            c.logo_emoji, c.accent_color, c.avatar AS place_avatar
     FROM ${tE} e
     JOIN ${tC} c ON c.id = e.community_id
     WHERE e.community_id IN (${placeholders}) AND e.status != 'cancelled'
     ORDER BY COALESCE(e.starts_at, e.created_at) DESC
     LIMIT ?`,
    [...communityIds, Math.min(communityIds.length * perPlace, 80)]
  )

  const items: WallFeedItem[] = []
  for (const r of rows ?? []) {
    const starts_at = normalizeDbDateTime(r.starts_at)
    const ends_at = normalizeDbDateTime(r.ends_at)
    const phase = String(r.phase ?? 'preparation')
    const ev = {
      starts_at,
      ends_at,
      phase,
      created_at: normalizeDbDateTime(r.created_at),
    }
    const { is_past, is_ongoing, sort_at } = eventFeedMeta(ev)
    items.push({
      kind: 'event',
      id: `event-${r.id}`,
      event_id: Number(r.id),
      sort_at,
      place: placeRefFromRow(r),
      title: String(r.title),
      description: r.description ? String(r.description) : null,
      starts_at,
      ends_at,
      location: r.location ? String(r.location) : null,
      phase,
      cover_image: r.cover_image ? String(r.cover_image) : null,
      is_past,
      is_ongoing,
    })
  }
  return items
}

function sortFeedItems(items: WallFeedItem[], sort: WallFeedSort): WallFeedItem[] {
  if (sort === 'place') {
    return [...items].sort((a, b) => {
      const nameCmp = a.place.name.localeCompare(b.place.name, 'fr')
      if (nameCmp !== 0) return nameCmp
      return new Date(b.sort_at).getTime() - new Date(a.sort_at).getTime()
    })
  }
  return [...items].sort(
    (a, b) => new Date(b.sort_at).getTime() - new Date(a.sort_at).getTime()
  )
}

function dedupeById(items: WallFeedItem[]): WallFeedItem[] {
  const seen = new Set<string>()
  const out: WallFeedItem[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

export async function buildWallFeed(params: {
  userId?: number | null
  sort?: WallFeedSort
  limit?: number
}): Promise<{
  items: WallFeedItem[]
  is_authenticated: boolean
  member_place_count: number
  hidden_count: number
}> {
  const sort = params.sort === 'place' ? 'place' : 'date'
  const limit = Math.min(Math.max(params.limit ?? 40, 5), 80)
  const uid = params.userId && params.userId > 0 ? params.userId : null

  if (uid) {
    const memberships = await listCommunitiesForUser(uid)
    const communityIds = memberships.map((m) => m.id)
    const [announcements, posts, events] = await Promise.all([
      fetchMemberAnnouncements(communityIds, MEMBER_ANNOUNCEMENT_PER_PLACE),
      fetchMemberPosts(communityIds, MEMBER_POST_PER_PLACE),
      fetchMemberEvents(communityIds, MEMBER_EVENT_PER_PLACE),
    ])
    const merged = dedupeById([...announcements, ...posts, ...events])
    const sorted = sortFeedItems(merged, sort).slice(0, limit)
    return {
      items: sorted,
      is_authenticated: true,
      member_place_count: communityIds.length,
      hidden_count: 0,
    }
  }

  const [announcements, events, posts] = await Promise.all([
    fetchPublicAnnouncements(PUBLIC_ANNOUNCEMENT_LIMIT),
    fetchPublicWallEvents(PUBLIC_EVENT_LIMIT),
    fetchPublicPosts(PUBLIC_POST_LIMIT),
  ])
  const merged = dedupeById([...announcements, ...events, ...posts])
  const sorted = sortFeedItems(merged, sort).slice(0, limit)

  return {
    items: sorted,
    is_authenticated: false,
    member_place_count: 0,
    hidden_count: 0,
  }
}
