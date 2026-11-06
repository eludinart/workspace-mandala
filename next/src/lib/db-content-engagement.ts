/**
 * Réactions + commentaires sur contenus mur (événement, Agora, annonce).
 * Porte `mur_engagement`. Membres du lieu uniquement pour écrire.
 */
import type { RowDataPacket } from 'mysql2'
import { ensureOnce, exec, getPool, isDbConfigured, table } from '@/lib/db'
import {
  canManageCommunityInContext,
  getCommunityById,
  requireCommunityMembership,
} from '@/lib/db-communities'
import { canAccessFeatureDoor } from '@/lib/db-feature-doors'
import { getEventRow } from '@/lib/db-mandala-events'
import { createNotification } from '@/lib/db-notifications'
import { getPlaceAnnouncementById } from '@/lib/db-place-announcements'
import { wallPublicFromRow } from '@/lib/wall-public'
import {
  contentSharePath,
  isContentEngagementKind,
  type ContentEngagementKind,
} from '@/lib/content-share'
import {
  isAllowedReactionEmoji,
  type MessageReactionSummary,
  type MessageReactionUser,
} from '@/lib/message-reactions'

const REACTIONS_TABLE = 'content_reactions'
const COMMENTS_TABLE = 'content_comments'

export type ContentCommentRow = {
  id: number
  target_kind: ContentEngagementKind
  target_id: number
  author_id: number
  body: string
  parent_id: number | null
  created_at: string
  author_pseudo: string
  author_avatar_emoji: string
  author_avatar: string | null
}

export type ContentTargetMeta = {
  kind: ContentEngagementKind
  targetId: number
  communityId: number
  authorId: number
  wallPublic: boolean
  title: string
  placeSlug: string | null
  placeName: string
}

async function ensureEngagementTables(): Promise<void> {
  if (!isDbConfigured()) return
  await ensureOnce('content-engagement', async () => {
    const pool = getPool()
    const tR = table(REACTIONS_TABLE)
    const tC = table(COMMENTS_TABLE)
    await exec(
      pool,
      `CREATE TABLE IF NOT EXISTS ${tR} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        target_kind VARCHAR(24) NOT NULL,
        target_id INT NOT NULL,
        user_id INT NOT NULL,
        emoji VARCHAR(16) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_content_user (target_kind, target_id, user_id),
        KEY idx_content (target_kind, target_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )
    await exec(
      pool,
      `CREATE TABLE IF NOT EXISTS ${tC} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        target_kind VARCHAR(24) NOT NULL,
        target_id INT NOT NULL,
        author_id INT NOT NULL,
        body TEXT NOT NULL,
        parent_id INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_content_created (target_kind, target_id, created_at),
        KEY idx_author (author_id),
        KEY idx_parent (parent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )
  })
}

async function getPostMeta(postId: number): Promise<{
  id: number
  community_id: number
  author_id: number
  content: string
  wall_public: boolean
} | null> {
  const pool = getPool()
  const t = table('mandala_posts')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, community_id, author_id, content, wall_public FROM ${t} WHERE id = ? LIMIT 1`,
    [postId]
  )
  const r = rows?.[0]
  if (!r) return null
  return {
    id: Number(r.id),
    community_id: Number(r.community_id),
    author_id: Number(r.author_id),
    content: String(r.content ?? ''),
    wall_public: wallPublicFromRow(r as Record<string, unknown>),
  }
}

export async function resolveContentTarget(
  kind: ContentEngagementKind,
  targetId: number
): Promise<ContentTargetMeta | null> {
  if (!isDbConfigured() || targetId <= 0) return null
  if (kind === 'event') {
    const event = await getEventRow(targetId)
    if (!event) return null
    const place = await getCommunityById(event.community_id)
    return {
      kind,
      targetId,
      communityId: event.community_id,
      authorId: event.created_by,
      wallPublic: event.wall_public,
      title: event.title,
      placeSlug: place?.slug ?? null,
      placeName: place?.name ?? 'lieu',
    }
  }
  if (kind === 'announcement') {
    const row = await getPlaceAnnouncementById(targetId)
    if (!row) return null
    const place = await getCommunityById(row.community_id)
    return {
      kind,
      targetId,
      communityId: row.community_id,
      authorId: row.author_id,
      wallPublic: row.wall_public,
      title: row.title,
      placeSlug: place?.slug ?? null,
      placeName: place?.name ?? 'lieu',
    }
  }
  const post = await getPostMeta(targetId)
  if (!post) return null
  const place = await getCommunityById(post.community_id)
  return {
    kind,
    targetId,
    communityId: post.community_id,
    authorId: post.author_id,
    wallPublic: post.wall_public,
    title: post.content.slice(0, 80) || 'Publication',
    placeSlug: place?.slug ?? null,
    placeName: place?.name ?? 'lieu',
  }
}

async function assertMemberWithDoor(userId: number, communityId: number): Promise<void> {
  const doorOk = await canAccessFeatureDoor(userId, 'mur_engagement')
  if (!doorOk) {
    throw Object.assign(new Error('Fonction non disponible'), { status: 403 })
  }
  try {
    await requireCommunityMembership(userId, communityId)
  } catch {
    throw Object.assign(new Error('Réservé aux membres du lieu'), { status: 403 })
  }
}

async function resolveDisplayNames(
  pool: ReturnType<typeof getPool>,
  userIds: number[]
): Promise<Map<number, string>> {
  const unique = [...new Set(userIds.filter((id) => id > 0))]
  const map = new Map<number, string>()
  if (unique.length === 0) return map
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const placeholders = unique.map(() => '?').join(', ')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID AS id,
            COALESCE(NULLIF(p.meta_value, ''), NULLIF(u.display_name, ''), CONCAT('Membre #', u.ID)) AS display_name
     FROM ${tUsers} u
     LEFT JOIN ${tMeta} p ON p.user_id = u.ID AND p.meta_key = 'mdl_pseudo'
     WHERE u.ID IN (${placeholders})`,
    unique
  )
  for (const r of rows ?? []) {
    map.set(Number(r.id), String(r.display_name || `Membre #${r.id}`))
  }
  return map
}

function aggregateReactions(rows: RowDataPacket[]): MessageReactionSummary[] {
  const byEmoji = new Map<string, number[]>()
  for (const r of rows) {
    const emoji = String(r.emoji ?? '')
    const uid = Number(r.user_id)
    if (!emoji || !uid) continue
    const list = byEmoji.get(emoji) ?? []
    list.push(uid)
    byEmoji.set(emoji, list)
  }
  return [...byEmoji.entries()].map(([emoji, userIds]) => ({ emoji, userIds }))
}

function attachUsers(
  list: MessageReactionSummary[],
  names: Map<number, string>
): MessageReactionSummary[] {
  return list.map((r) => ({
    ...r,
    users: r.userIds.map(
      (id): MessageReactionUser => ({
        id,
        display_name: names.get(id) || `Membre #${id}`,
      })
    ),
  }))
}

export async function getContentReactions(
  kind: ContentEngagementKind,
  targetId: number
): Promise<MessageReactionSummary[]> {
  await ensureEngagementTables()
  const pool = getPool()
  const t = table(REACTIONS_TABLE)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, emoji FROM ${t} WHERE target_kind = ? AND target_id = ?`,
    [kind, targetId]
  )
  const aggregated = aggregateReactions(rows ?? [])
  const allIds = aggregated.flatMap((r) => r.userIds)
  const names = await resolveDisplayNames(pool, allIds)
  return attachUsers(aggregated, names)
}

export async function toggleContentReaction(params: {
  kind: ContentEngagementKind
  targetId: number
  userId: number
  emoji: string
}): Promise<{ reactions: MessageReactionSummary[]; myEmoji: string | null }> {
  if (!isAllowedReactionEmoji(params.emoji)) {
    throw Object.assign(new Error('Émoji non autorisé'), { status: 400 })
  }
  const meta = await resolveContentTarget(params.kind, params.targetId)
  if (!meta) throw Object.assign(new Error('Contenu introuvable'), { status: 404 })
  await assertMemberWithDoor(params.userId, meta.communityId)

  await ensureEngagementTables()
  const pool = getPool()
  const t = table(REACTIONS_TABLE)
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id, emoji FROM ${t} WHERE target_kind = ? AND target_id = ? AND user_id = ? LIMIT 1`,
    [params.kind, params.targetId, params.userId]
  )
  const row = existing?.[0]
  if (row && String(row.emoji) === params.emoji) {
    await pool.execute(`DELETE FROM ${t} WHERE id = ?`, [Number(row.id)])
  } else if (row) {
    await pool.execute(`UPDATE ${t} SET emoji = ?, created_at = NOW() WHERE id = ?`, [
      params.emoji,
      Number(row.id),
    ])
  } else {
    await pool.execute(
      `INSERT INTO ${t} (target_kind, target_id, user_id, emoji) VALUES (?, ?, ?, ?)`,
      [params.kind, params.targetId, params.userId, params.emoji]
    )
  }

  const reactions = await getContentReactions(params.kind, params.targetId)
  const mine = reactions.find((r) => r.userIds.includes(params.userId))
  return { reactions, myEmoji: mine?.emoji ?? null }
}

export async function listContentComments(
  kind: ContentEngagementKind,
  targetId: number
): Promise<ContentCommentRow[]> {
  await ensureEngagementTables()
  const pool = getPool()
  const t = table(COMMENTS_TABLE)
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.target_kind, c.target_id, c.author_id, c.body, c.parent_id, c.created_at,
            COALESCE(NULLIF(p.meta_value, ''), NULLIF(u.display_name, ''), CONCAT('Membre #', c.author_id)) AS author_pseudo,
            COALESCE(e.meta_value, '🌸') AS author_avatar_emoji,
            COALESCE(a.meta_value, '') AS author_avatar
     FROM ${t} c
     JOIN ${tUsers} u ON u.ID = c.author_id
     LEFT JOIN ${tMeta} p ON p.user_id = c.author_id AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} e ON e.user_id = c.author_id AND e.meta_key = 'mdl_avatar_emoji'
     LEFT JOIN ${tMeta} a ON a.user_id = c.author_id AND a.meta_key = 'mdl_avatar'
     WHERE c.target_kind = ? AND c.target_id = ?
     ORDER BY c.created_at ASC, c.id ASC
     LIMIT 200`,
    [kind, targetId]
  )
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    target_kind: String(r.target_kind) as ContentEngagementKind,
    target_id: Number(r.target_id),
    author_id: Number(r.author_id),
    body: String(r.body ?? ''),
    parent_id: r.parent_id != null ? Number(r.parent_id) : null,
    created_at: r.created_at ? String(r.created_at) : new Date().toISOString(),
    author_pseudo: String(r.author_pseudo || `Membre #${r.author_id}`),
    author_avatar_emoji: String(r.author_avatar_emoji || '🌸'),
    author_avatar: r.author_avatar ? String(r.author_avatar) : null,
  }))
}

export async function addContentComment(params: {
  kind: ContentEngagementKind
  targetId: number
  userId: number
  body: string
}): Promise<ContentCommentRow> {
  const body = params.body.trim().slice(0, 2000)
  if (!body) throw Object.assign(new Error('Message vide'), { status: 400 })

  const meta = await resolveContentTarget(params.kind, params.targetId)
  if (!meta) throw Object.assign(new Error('Contenu introuvable'), { status: 404 })
  await assertMemberWithDoor(params.userId, meta.communityId)

  await ensureEngagementTables()
  const pool = getPool()
  const t = table(COMMENTS_TABLE)
  const [ins] = await pool.execute(
    `INSERT INTO ${t} (target_kind, target_id, author_id, body, parent_id) VALUES (?, ?, ?, ?, NULL)`,
    [params.kind, params.targetId, params.userId, body]
  )
  const insertId = Number((ins as { insertId?: number }).insertId ?? 0)
  const comments = await listContentComments(params.kind, params.targetId)
  const created = comments.find((c) => c.id === insertId)
  if (!created) throw Object.assign(new Error('Commentaire introuvable après création'), { status: 500 })

  if (meta.authorId > 0 && meta.authorId !== params.userId) {
    const actor = created.author_pseudo
    const path = meta.placeSlug
      ? contentSharePath(params.kind, meta.placeSlug, params.targetId)
      : null
    void createNotification({
      type: 'content_comment',
      title: `${actor} a commenté « ${meta.title.slice(0, 60)} »`,
      body: body.slice(0, 160),
      action_url: path ? `mandala:open?path=${encodeURIComponent(path)}` : 'mandala:home',
      action_label: 'Voir',
      recipient_type: 'user',
      recipient_id: meta.authorId,
      created_by: params.userId,
      source_type: `content_${params.kind}`,
      source_id: params.targetId,
      priority: 'normal',
    }).catch(() => {})
  }

  return created
}

export async function deleteContentComment(params: {
  commentId: number
  userId: number
  isAppSiteManager: boolean
}): Promise<void> {
  await ensureEngagementTables()
  const pool = getPool()
  const t = table(COMMENTS_TABLE)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, target_kind, target_id, author_id FROM ${t} WHERE id = ? LIMIT 1`,
    [params.commentId]
  )
  const r = rows?.[0]
  if (!r) throw Object.assign(new Error('Commentaire introuvable'), { status: 404 })
  const kind = String(r.target_kind)
  if (!isContentEngagementKind(kind)) {
    throw Object.assign(new Error('Type invalide'), { status: 400 })
  }
  const meta = await resolveContentTarget(kind, Number(r.target_id))
  if (!meta) throw Object.assign(new Error('Contenu introuvable'), { status: 404 })
  await assertMemberWithDoor(params.userId, meta.communityId)

  const isAuthor = Number(r.author_id) === params.userId
  let canManage = params.isAppSiteManager
  if (!canManage) {
    try {
      const role = await requireCommunityMembership(params.userId, meta.communityId)
      canManage = canManageCommunityInContext(role, false)
    } catch {
      canManage = false
    }
  }
  if (!isAuthor && !canManage) {
    throw Object.assign(new Error('Suppression refusée'), { status: 403 })
  }
  await pool.execute(`DELETE FROM ${t} WHERE id = ?`, [params.commentId])
}

export async function getContentEngagementBundle(params: {
  kind: ContentEngagementKind
  targetId: number
  userId: number | null
}): Promise<{
  reactions: MessageReactionSummary[]
  comments: ContentCommentRow[]
  myEmoji: string | null
  wall_public: boolean
  place_slug: string | null
  can_engage: boolean
  share_path: string | null
}> {
  const meta = await resolveContentTarget(params.kind, params.targetId)
  if (!meta) throw Object.assign(new Error('Contenu introuvable'), { status: 404 })

  let canEngage = false
  if (params.userId && params.userId > 0) {
    try {
      await assertMemberWithDoor(params.userId, meta.communityId)
      canEngage = true
    } catch {
      canEngage = false
    }
  }

  // Lecture : membre du lieu (même sans porte) voit réactions/commentaires si porte ouverte pour lui ;
  // sinon bundle vide côté écriture. Visiteurs : pas de lecture privée.
  let reactions: MessageReactionSummary[] = []
  let comments: ContentCommentRow[] = []
  if (canEngage) {
    reactions = await getContentReactions(params.kind, params.targetId)
    comments = await listContentComments(params.kind, params.targetId)
  } else if (params.userId && params.userId > 0) {
    try {
      await requireCommunityMembership(params.userId, meta.communityId)
      const doorOk = await canAccessFeatureDoor(params.userId, 'mur_engagement')
      if (doorOk) {
        reactions = await getContentReactions(params.kind, params.targetId)
        comments = await listContentComments(params.kind, params.targetId)
        canEngage = true
      }
    } catch {
      /* hors lieu */
    }
  }

  const myEmoji =
    params.userId != null
      ? reactions.find((r) => r.userIds.includes(params.userId!))?.emoji ?? null
      : null

  return {
    reactions,
    comments,
    myEmoji,
    wall_public: meta.wallPublic,
    place_slug: meta.placeSlug,
    can_engage: canEngage,
    share_path: meta.placeSlug
      ? contentSharePath(params.kind, meta.placeSlug, params.targetId)
      : null,
  }
}

/** Snapshot public pour pages deep-link (wall_public only). */
export async function getPublicContentSnapshot(
  kind: ContentEngagementKind,
  targetId: number,
  placeSlug: string
): Promise<{
  kind: ContentEngagementKind
  id: number
  title: string
  body: string
  place: { slug: string; name: string; logo_emoji: string | null; accent_color: string | null }
  starts_at?: string | null
  ends_at?: string | null
  image_data?: string | null
} | null> {
  const meta = await resolveContentTarget(kind, targetId)
  if (!meta || !meta.wallPublic) return null
  if (!meta.placeSlug || meta.placeSlug !== placeSlug) return null
  const place = await getCommunityById(meta.communityId)
  if (!place || !place.is_active) return null
  if (place.listed_public === false) return null

  const placeRef = {
    slug: place.slug,
    name: place.name,
    logo_emoji: place.logo_emoji,
    accent_color: place.accent_color,
  }

  if (kind === 'event') {
    const event = await getEventRow(targetId)
    if (!event || event.status !== 'published') return null
    return {
      kind,
      id: targetId,
      title: event.title,
      body: event.description ?? '',
      place: placeRef,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      image_data: event.cover_image,
    }
  }
  if (kind === 'announcement') {
    const row = await getPlaceAnnouncementById(targetId)
    if (!row || row.audience === 'core') return null
    return {
      kind,
      id: targetId,
      title: row.title,
      body: row.body,
      place: placeRef,
      image_data: row.image_data,
    }
  }
  const post = await getPostMeta(targetId)
  if (!post) return null
  return {
    kind,
    id: targetId,
    title: meta.title,
    body: post.content,
    place: placeRef,
  }
}
