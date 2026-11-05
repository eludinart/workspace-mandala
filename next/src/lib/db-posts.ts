/**
 * L'Agora — brèves communautaires (logistique / inspiration).
 */
import type { RowDataPacket } from 'mysql2'
import { ensureOnce, exec, getPool, table } from './db'
import {
  canManageCommunityInContext,
  ensureCommunitiesTables,
  getCommunityById,
  requireCommunityMembership,
  type CommunityRole,
} from './db-communities'
import { notifyPlaceMembers, resolveActorLabel } from './db-place-activity-notify'
import { ensureWallPublicColumn, parseWallPublic, wallPublicFromRow } from './wall-public'

export type PostType = 'logistics' | 'inspiration'

export type CommunityPostRow = {
  id: number
  community_id: number
  author_id: number
  type: PostType
  content: string
  image_data: string | null
  created_at: string
  author_pseudo: string
  author_avatar_emoji: string
  author_avatar: string | null
  wall_public: boolean
}

function normalizePostImageData(img: unknown): string | null | undefined {
  if (img === undefined) return undefined
  if (img === null || img === '') return null
  if (typeof img !== 'string') return undefined
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/i.test(img)) return undefined
  const raw = Buffer.from(img.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  if (raw.length > 600_000) {
    throw Object.assign(new Error('Image trop lourde (600 Ko max.)'), { status: 400 })
  }
  return img
}

export async function ensurePostTables(): Promise<void> {
  return ensureOnce('posts', async () => {
  await ensureCommunitiesTables()
  const pool = getPool()
  const t = table('mandala_posts')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${t} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      community_id INT NOT NULL,
      author_id INT NOT NULL,
      type VARCHAR(24) NOT NULL DEFAULT 'inspiration',
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_community_created (community_id, created_at DESC),
      KEY idx_author (author_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await ensureWallPublicColumn(pool, t)
  await ensurePostImageColumn(pool, t)
  })
  await ensureOnce('posts-image', async () => {
    const pool = getPool()
    await ensurePostImageColumn(pool, table('mandala_posts'))
  })
}

async function ensurePostImageColumn(
  pool: ReturnType<typeof getPool>,
  tableName: string
): Promise<void> {
  const [cols] = await pool.execute<RowDataPacket[]>(`SHOW COLUMNS FROM ${tableName}`)
  const existing = new Set((cols ?? []).map((c) => String(c.Field)))
  if (existing.has('image_data')) return
  await exec(pool, `ALTER TABLE ${tableName} ADD COLUMN image_data MEDIUMTEXT NULL`)
}

function isPostType(v: unknown): v is PostType {
  return v === 'logistics' || v === 'inspiration'
}

export function canManageCommunityPosts(role: CommunityRole, isAppSiteManager = false): boolean {
  return canManageCommunityInContext(role, isAppSiteManager)
}

async function getPostRow(postId: number): Promise<{
  id: number
  community_id: number
  author_id: number
} | null> {
  await ensurePostTables()
  const pool = getPool()
  const t = table('mandala_posts')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, community_id, author_id FROM ${t} WHERE id = ? LIMIT 1`,
    [postId]
  )
  const r = rows[0]
  if (!r) return null
  return {
    id: Number(r.id),
    community_id: Number(r.community_id),
    author_id: Number(r.author_id),
  }
}

export async function deleteCommunityPost(params: {
  postId: number
  userId: number
  isAppSiteManager: boolean
}): Promise<void> {
  const post = await getPostRow(params.postId)
  if (!post) throw Object.assign(new Error('Brève introuvable'), { status: 404 })

  let role: CommunityRole = 'member'
  try {
    role = await requireCommunityMembership(params.userId, post.community_id)
  } catch {
    throw Object.assign(new Error('Accès refusé'), { status: 403 })
  }

  if (!canManageCommunityPosts(role, params.isAppSiteManager)) {
    throw Object.assign(new Error('Droits insuffisants pour supprimer cette brève'), { status: 403 })
  }

  const pool = getPool()
  const t = table('mandala_posts')
  await pool.execute(`DELETE FROM ${t} WHERE id = ?`, [params.postId])
}

export async function createPost(
  communityId: number,
  authorId: number,
  data: { type: PostType; content: string; wall_public?: boolean; image_data?: string | null }
): Promise<CommunityPostRow> {
  await ensurePostTables()
  if (!isPostType(data.type)) {
    throw Object.assign(new Error('Type de brève invalide'), { status: 400 })
  }
  const content = String(data.content ?? '').trim()
  if (!content) {
    throw Object.assign(new Error('Le contenu est requis'), { status: 400 })
  }
  if (content.length > 2000) {
    throw Object.assign(new Error('Brève trop longue (2000 caractères max.)'), { status: 400 })
  }
  const image = normalizePostImageData(data.image_data ?? null)
  if (data.image_data != null && data.image_data !== '' && image === undefined) {
    throw Object.assign(new Error('Image invalide (JPEG, PNG, WebP ou GIF)'), { status: 400 })
  }

  const pool = getPool()
  const t = table('mandala_posts')
  const wallPublic = parseWallPublic(data.wall_public) ? 1 : 0
  const [result] = await pool.execute(
    `INSERT INTO ${t} (community_id, author_id, type, content, image_data, wall_public)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [communityId, authorId, data.type, content, image ?? null, wallPublic]
  )
  const insertId = Number((result as { insertId?: number }).insertId)
  const posts = await getPostsByCommunity(communityId, 1)
  const created = posts.find((p) => p.id === insertId)
  const row =
    created ??
    ({
      id: insertId,
      community_id: communityId,
      author_id: authorId,
      type: data.type,
      content,
      image_data: image ?? null,
      created_at: new Date().toISOString(),
      author_pseudo: `user_${authorId}`,
      author_avatar_emoji: '🌸',
      author_avatar: null,
      wall_public: parseWallPublic(data.wall_public),
    } satisfies CommunityPostRow)

  void (async () => {
    try {
      const [actor, place] = await Promise.all([
        resolveActorLabel(authorId),
        getCommunityById(communityId),
      ])
      const placeName = place?.name?.trim() || 'votre lieu'
      const kind = data.type === 'logistics' ? 'logistique' : 'inspiration'
      const snippet = content.length > 120 ? `${content.slice(0, 117)}…` : content
      const slug = place?.slug?.trim()
      await notifyPlaceMembers({
        communityId,
        actorUserId: authorId,
        type: 'agora_post',
        title: `${actor} a publié dans l’Agora de ${placeName}`,
        body: `${kind} — ${snippet}`,
        actionUrl: slug ? `mandala:home?community=${encodeURIComponent(slug)}` : 'mandala:home',
        actionLabel: 'Voir l’Agora',
        sourceType: 'mandala_post',
        sourceId: insertId,
      })
    } catch {
      /* non bloquant */
    }
  })()

  return row
}

function mapPostRow(r: RowDataPacket): CommunityPostRow {
  return {
    id: Number(r.id),
    community_id: Number(r.community_id),
    author_id: Number(r.author_id),
    type: (r.type === 'logistics' ? 'logistics' : 'inspiration') as PostType,
    content: String(r.content),
    image_data: r.image_data ? String(r.image_data) : null,
    created_at: r.created_at ? String(r.created_at) : new Date().toISOString(),
    author_pseudo: String(r.author_pseudo),
    author_avatar_emoji: String(r.author_avatar_emoji || '🌸'),
    author_avatar: r.author_avatar ? String(r.author_avatar) : null,
    wall_public: wallPublicFromRow(r as Record<string, unknown>),
  }
}

export async function updateCommunityPost(params: {
  postId: number
  userId: number
  isAppSiteManager: boolean
  wall_public?: boolean
}): Promise<CommunityPostRow> {
  const post = await getPostRow(params.postId)
  if (!post) throw Object.assign(new Error('Brève introuvable'), { status: 404 })

  let role: CommunityRole = 'member'
  try {
    role = await requireCommunityMembership(params.userId, post.community_id)
  } catch {
    throw Object.assign(new Error('Accès refusé'), { status: 403 })
  }
  if (!canManageCommunityPosts(role, params.isAppSiteManager)) {
    throw Object.assign(new Error('Droits organisateur requis'), { status: 403 })
  }

  if (params.wall_public === undefined) {
    const posts = await getPostsByCommunity(post.community_id, 50)
    const found = posts.find((p) => p.id === params.postId)
    if (!found) throw Object.assign(new Error('Brève introuvable'), { status: 404 })
    return found
  }

  const pool = getPool()
  const t = table('mandala_posts')
  await pool.execute(`UPDATE ${t} SET wall_public = ? WHERE id = ?`, [
    parseWallPublic(params.wall_public) ? 1 : 0,
    params.postId,
  ])
  const posts = await getPostsByCommunity(post.community_id, 50)
  const updated = posts.find((p) => p.id === params.postId)
  if (!updated) throw Object.assign(new Error('Brève introuvable'), { status: 404 })
  return updated
}

export async function getPostsByCommunity(
  communityId: number,
  limit = 20
): Promise<CommunityPostRow[]> {
  await ensurePostTables()
  const pool = getPool()
  const t = table('mandala_posts')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const safeLimit = Math.min(Math.max(1, limit), 50)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.community_id, p.author_id, p.type, p.content, p.image_data, p.created_at, p.wall_public,
            COALESCE(pm.meta_value, u.display_name, CONCAT('user_', p.author_id)) AS author_pseudo,
            COALESCE(em.meta_value, '🌸') AS author_avatar_emoji,
            COALESCE(am.meta_value, '') AS author_avatar
     FROM ${t} p
     JOIN ${tUsers} u ON u.ID = p.author_id
     LEFT JOIN ${tMeta} pm ON pm.user_id = p.author_id AND pm.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} em ON em.user_id = p.author_id AND em.meta_key = 'mdl_avatar_emoji'
     LEFT JOIN ${tMeta} am ON am.user_id = p.author_id AND am.meta_key = 'mdl_avatar'
     WHERE p.community_id = ?
     ORDER BY p.created_at DESC
     LIMIT ${safeLimit}`,
    [communityId]
  )

  return (rows ?? []).map(mapPostRow)
}
