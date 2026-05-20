/**
 * Communautés (lieux / groupes) — multi-tenant Mandala.
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'

export type CommunityRecord = {
  id: number
  slug: string
  name: string
  tagline: string | null
  description: string | null
  location: string | null
  website: string | null
  contact_email: string | null
  accent_color: string | null
  logo_emoji: string | null
  avatar: string | null
}

export type CommunityRole = 'member' | 'organizer' | 'admin'

const COMMUNITY_COLS =
  'id, slug, name, tagline, description, location, website, contact_email, accent_color, logo_emoji, avatar'

const MAX_COMMUNITY_AVATAR_BYTES = 150_000

function mapCommunityRow(r: RowDataPacket): CommunityRecord {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    tagline: r.tagline ? String(r.tagline) : null,
    description: r.description ? String(r.description) : null,
    location: r.location ? String(r.location) : null,
    website: r.website ? String(r.website) : null,
    contact_email: r.contact_email ? String(r.contact_email) : null,
    accent_color: r.accent_color ? String(r.accent_color) : null,
    logo_emoji: r.logo_emoji ? String(r.logo_emoji) : null,
    avatar: r.avatar ? String(r.avatar) : null,
  }
}

/** Valide ou efface l'avatar communauté (data URL base64). */
export function parseCommunityAvatarInput(avatar: unknown): string | null | undefined {
  if (avatar === undefined) return undefined
  if (avatar === null || avatar === '') return null
  if (typeof avatar !== 'string') throw new Error('Avatar invalide')
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/i.test(avatar)) {
    throw new Error('Format image non supporté (JPEG, PNG, WebP, GIF)')
  }
  const raw = Buffer.from(avatar.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  if (raw.length > MAX_COMMUNITY_AVATAR_BYTES) {
    throw new Error('Photo trop volumineuse (max ~150 Ko). Réduisez la taille.')
  }
  return avatar
}

let _ensured = false

const PROFILE_COLUMN_DEFS: Array<{ name: string; ddl: string }> = [
  { name: 'description', ddl: 'description TEXT DEFAULT NULL' },
  { name: 'location', ddl: 'location VARCHAR(255) DEFAULT NULL' },
  { name: 'website', ddl: 'website VARCHAR(255) DEFAULT NULL' },
  { name: 'contact_email', ddl: 'contact_email VARCHAR(120) DEFAULT NULL' },
  { name: 'avatar', ddl: 'avatar MEDIUMTEXT DEFAULT NULL' },
]

/** Ajoute les colonnes profil si absentes (compatible MariaDB sans IF NOT EXISTS). */
async function ensureCommunityProfileColumns(pool: ReturnType<typeof getPool>, tC: string): Promise<void> {
  const [cols] = await pool.execute<RowDataPacket[]>(`SHOW COLUMNS FROM ${tC}`)
  const existing = new Set((cols ?? []).map((c) => String(c.Field)))
  for (const { name, ddl } of PROFILE_COLUMN_DEFS) {
    if (existing.has(name)) continue
    await exec(pool, `ALTER TABLE ${tC} ADD COLUMN ${ddl}`)
    existing.add(name)
  }
}

export async function ensureCommunitiesTables(): Promise<void> {
  if (_ensured || !isDbConfigured()) return
  const pool = getPool()
  const tC = table('mandala_communities')
  const tM = table('mandala_community_members')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tC} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(64) NOT NULL,
      name VARCHAR(120) NOT NULL,
      tagline VARCHAR(255) DEFAULT NULL,
      accent_color VARCHAR(24) DEFAULT NULL,
      logo_emoji VARCHAR(16) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tM} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      community_id INT NOT NULL,
      user_id INT NOT NULL,
      role VARCHAR(24) NOT NULL DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_community_user (community_id, user_id),
      KEY idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await ensureCommunityProfileColumns(pool, tC)
  _ensured = true
}

export async function seedDefaultCommunitiesIfEmpty(): Promise<void> {
  await ensureCommunitiesTables()
  const pool = getPool()
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM ${tC}`)
  if (Number(rows[0]?.c ?? 0) > 0) return
  await pool.execute(
    `INSERT INTO ${tC} (slug, name, tagline, accent_color, logo_emoji) VALUES
      ('shambhala', 'Shambhala', 'Lieu cœur — Inde', '#d97706', '🕉️'),
      ('sivana', 'Sivanà', 'Communauté Sivanà', '#7c3aed', '🌸')`
  )
}

export async function listCommunities(): Promise<CommunityRecord[]> {
  if (!isDbConfigured()) return []
  await ensureCommunitiesTables()
  const pool = getPool()
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${COMMUNITY_COLS} FROM ${tC} WHERE is_active = 1 ORDER BY name ASC`
  )
  return (rows ?? []).map(mapCommunityRow)
}

export async function getCommunityBySlug(slug: string): Promise<CommunityRecord | null> {
  await ensureCommunitiesTables()
  const pool = getPool()
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${COMMUNITY_COLS} FROM ${tC} WHERE slug = ? AND is_active = 1 LIMIT 1`,
    [slug]
  )
  const r = rows[0]
  if (!r) return null
  return mapCommunityRow(r)
}

export async function listCommunitiesForUser(userId: number): Promise<Array<CommunityRecord & { role: CommunityRole }>> {
  if (!userId) return []
  await ensureCommunitiesTables()
  await seedDefaultCommunitiesIfEmpty()
  const pool = getPool()
  const tC = table('mandala_communities')
  const tM = table('mandala_community_members')
  const [memberRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name, c.tagline, c.description, c.location, c.website, c.contact_email,
            c.accent_color, c.logo_emoji, c.avatar, m.role
     FROM ${tM} m
     JOIN ${tC} c ON c.id = m.community_id
     WHERE m.user_id = ? AND c.is_active = 1
     ORDER BY c.name ASC`,
    [userId]
  )
  if (memberRows.length > 0) {
    return memberRows.map((r) => ({
      ...mapCommunityRow(r),
      role: String(r.role) as CommunityRole,
    }))
  }
  // Premier accès : rattacher à toutes les communautés actives en "member" (démo)
  const all = await listCommunities()
  for (const c of all) {
    await pool.execute(
      `INSERT IGNORE INTO ${tM} (community_id, user_id, role) VALUES (?, ?, 'member')`,
      [c.id, userId]
    )
  }
  return listCommunitiesForUser(userId)
}

export type CommunityMemberDisplay = {
  user_id: number
  pseudo: string
  display_name: string
  avatar_emoji: string
  avatar: string | null
  profile_public: boolean
  is_me: boolean
  role: CommunityRole
}

/** Membres d'une communauté pour l'annuaire (toujours inclure le visiteur). */
export async function listCommunityMembersDisplay(
  communityId: number,
  viewerUserId: number
): Promise<CommunityMemberDisplay[]> {
  await ensureCommunitiesTables()
  const pool = getPool()
  const tM = table('mandala_community_members')
  const tUsers = table('users')
  const tMeta = table('usermeta')

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT m.user_id, m.role,
            COALESCE(u.display_name, '') AS display_name,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', m.user_id)) AS pseudo,
            COALESCE(e.meta_value, '🌸') AS avatar_emoji,
            COALESCE(a.meta_value, '') AS avatar,
            COALESCE(pub.meta_value, '0') AS profile_public
     FROM ${tM} m
     JOIN ${tUsers} u ON u.ID = m.user_id
     LEFT JOIN ${tMeta} p ON p.user_id = m.user_id AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} e ON e.user_id = m.user_id AND e.meta_key = 'mdl_avatar_emoji'
     LEFT JOIN ${tMeta} a ON a.user_id = m.user_id AND a.meta_key = 'mdl_avatar'
     LEFT JOIN ${tMeta} pub ON pub.user_id = m.user_id AND pub.meta_key = 'mdl_profile_public'
     WHERE m.community_id = ?
     ORDER BY (m.user_id = ?) DESC, pseudo ASC`,
    [communityId, viewerUserId]
  )

  return (rows ?? [])
    .map((r) => ({
      user_id: Number(r.user_id),
      pseudo: String(r.pseudo || r.display_name || `user_${r.user_id}`),
      display_name: String(r.display_name || ''),
      avatar_emoji: String(r.avatar_emoji || '🌸'),
      avatar: r.avatar ? String(r.avatar) : null,
      profile_public: String(r.profile_public) === '1',
      is_me: Number(r.user_id) === viewerUserId,
      role: String(r.role) as CommunityRole,
    }))
    .filter((m) => m.is_me || m.profile_public)
}

export type MemberDirectoryCommunity = {
  id: number
  slug: string
  name: string
  logo_emoji: string | null
  member_count: number
}

export type MemberDirectoryEntry = {
  user_id: number
  pseudo: string
  display_name: string
  avatar_emoji: string
  avatar: string | null
  profile_public: boolean
  is_me: boolean
  communities: Array<{
    slug: string
    name: string
    logo_emoji: string | null
    role: CommunityRole
  }>
}

/** Annuaire croisé : membres et communautés accessibles au visiteur. */
export async function listMemberDirectoryForViewer(
  viewerUserId: number,
  options?: { includeAllCommunities?: boolean }
): Promise<{
  communities: MemberDirectoryCommunity[]
  members: MemberDirectoryEntry[]
}> {
  if (!viewerUserId) return { communities: [], members: [] }
  await ensureCommunitiesTables()
  await seedDefaultCommunitiesIfEmpty()

  let communityIds: number[]
  if (options?.includeAllCommunities) {
    const all = await listCommunities()
    communityIds = all.map((c) => c.id)
  } else {
    const mine = await listCommunitiesForUser(viewerUserId)
    communityIds = mine.map((c) => c.id)
  }
  if (!communityIds.length) return { communities: [], members: [] }

  const pool = getPool()
  const tM = table('mandala_community_members')
  const tC = table('mandala_communities')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const placeholders = communityIds.map(() => '?').join(',')

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id AS community_id, c.slug, c.name, c.logo_emoji,
            m.user_id, m.role,
            COALESCE(u.display_name, '') AS display_name,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', m.user_id)) AS pseudo,
            COALESCE(e.meta_value, '🌸') AS avatar_emoji,
            COALESCE(a.meta_value, '') AS avatar,
            COALESCE(pub.meta_value, '0') AS profile_public
     FROM ${tM} m
     JOIN ${tC} c ON c.id = m.community_id AND c.is_active = 1
     JOIN ${tUsers} u ON u.ID = m.user_id
     LEFT JOIN ${tMeta} p ON p.user_id = m.user_id AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} e ON e.user_id = m.user_id AND e.meta_key = 'mdl_avatar_emoji'
     LEFT JOIN ${tMeta} a ON a.user_id = m.user_id AND a.meta_key = 'mdl_avatar'
     LEFT JOIN ${tMeta} pub ON pub.user_id = m.user_id AND pub.meta_key = 'mdl_profile_public'
     WHERE m.community_id IN (${placeholders})
     ORDER BY c.name ASC, pseudo ASC`,
    communityIds
  )

  const communityMap = new Map<number, MemberDirectoryCommunity>()
  const memberMap = new Map<number, MemberDirectoryEntry>()

  for (const r of rows ?? []) {
    const communityId = Number(r.community_id)
    const userId = Number(r.user_id)
    const isMe = userId === viewerUserId
    const profilePublic = String(r.profile_public) === '1'
    if (!isMe && !profilePublic) continue

    if (!communityMap.has(communityId)) {
      communityMap.set(communityId, {
        id: communityId,
        slug: String(r.slug),
        name: String(r.name),
        logo_emoji: r.logo_emoji ? String(r.logo_emoji) : null,
        member_count: 0,
      })
    }

    const slug = String(r.slug)
    const name = String(r.name)
    const logo = r.logo_emoji ? String(r.logo_emoji) : null
    const role = String(r.role) as CommunityRole

    let entry = memberMap.get(userId)
    if (!entry) {
      entry = {
        user_id: userId,
        pseudo: String(r.pseudo || r.display_name || `user_${userId}`),
        display_name: String(r.display_name || ''),
        avatar_emoji: String(r.avatar_emoji || '🌸'),
        avatar: r.avatar ? String(r.avatar) : null,
        profile_public: profilePublic,
        is_me: isMe,
        communities: [],
      }
      memberMap.set(userId, entry)
    }
    if (!entry.communities.some((c) => c.slug === slug)) {
      entry.communities.push({ slug, name, logo_emoji: logo, role })
    }
  }

  for (const entry of memberMap.values()) {
    entry.communities.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    for (const c of entry.communities) {
      const comm = [...communityMap.values()].find((x) => x.slug === c.slug)
      if (comm) comm.member_count += 1
    }
  }

  const communities = [...communityMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr')
  )
  const members = [...memberMap.values()].sort((a, b) =>
    a.pseudo.localeCompare(b.pseudo, 'fr')
  )

  return { communities, members }
}

export async function createCommunity(params: {
  slug: string
  name: string
  tagline?: string
  description?: string
  location?: string
  website?: string
  contact_email?: string
  accent_color?: string
  logo_emoji?: string
  creatorUserId: number
}): Promise<CommunityRecord> {
  await ensureCommunitiesTables()
  const slug = params.slug
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64)
  if (!slug || slug.length < 2) throw new Error('Slug invalide (min. 2 caractères)')
  const name = params.name?.trim()
  if (!name) throw new Error('Nom requis')

  const pool = getPool()
  const tC = table('mandala_communities')
  const tM = table('mandala_community_members')

  const [dup] = await pool.execute<RowDataPacket[]>(`SELECT id FROM ${tC} WHERE slug = ?`, [slug])
  if (dup.length > 0) throw new Error('Ce slug existe déjà')

  await pool.execute(
    `INSERT INTO ${tC} (slug, name, tagline, description, location, website, contact_email, accent_color, logo_emoji)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      name,
      params.tagline?.trim() || null,
      params.description?.trim() || null,
      params.location?.trim() || null,
      params.website?.trim() || null,
      params.contact_email?.trim() || null,
      params.accent_color?.trim() || '#7c3aed',
      params.logo_emoji?.trim() || '🏛️',
    ]
  )
  const [ins] = await pool.execute<RowDataPacket[]>(`SELECT LAST_INSERT_ID() as id`)
  const id = Number(ins[0]?.id ?? 0)
  if (!id) throw new Error('Création impossible')

  await pool.execute(
    `INSERT INTO ${tM} (community_id, user_id, role) VALUES (?, ?, 'admin')`,
    [id, params.creatorUserId]
  )

  const created = await getCommunityById(id)
  if (!created) throw new Error('Création impossible')
  return created
}

/** Rattache l'utilisateur à toutes les communautés actives (membre). */
export async function syncUserToAllActiveCommunities(userId: number): Promise<number> {
  if (!userId) return 0
  await ensureCommunitiesTables()
  await seedDefaultCommunitiesIfEmpty()
  const pool = getPool()
  const tM = table('mandala_community_members')
  const all = await listCommunities()
  let added = 0
  for (const c of all) {
    const [res] = await pool.execute(
      `INSERT IGNORE INTO ${tM} (community_id, user_id, role) VALUES (?, ?, 'member')`,
      [c.id, userId]
    )
    added += Number((res as { affectedRows?: number }).affectedRows ?? 0)
  }
  return added
}

export type CommunityCatalogItem = CommunityRecord & {
  is_member: boolean
  role: CommunityRole | null
}

/** Toutes les communautés actives + statut d'appartenance pour l'utilisateur. */
export async function listCommunityCatalogForUser(userId: number): Promise<CommunityCatalogItem[]> {
  await ensureCommunitiesTables()
  await seedDefaultCommunitiesIfEmpty()
  const pool = getPool()
  const tC = table('mandala_communities')
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name, c.tagline, c.description, c.location, c.website, c.contact_email,
            c.accent_color, c.logo_emoji, c.avatar, m.role AS member_role
     FROM ${tC} c
     LEFT JOIN ${tM} m ON m.community_id = c.id AND m.user_id = ?
     WHERE c.is_active = 1
     ORDER BY c.name ASC`,
    [userId]
  )
  return (rows ?? []).map((r) => ({
    ...mapCommunityRow(r),
    is_member: r.member_role != null,
    role: r.member_role ? (String(r.member_role) as CommunityRole) : null,
  }))
}

/** Rejoindre une communauté par slug (multi-appartenance). */
export async function joinCommunity(params: {
  userId: number
  slug: string
}): Promise<CommunityRecord & { role: CommunityRole }> {
  const slug = params.slug.trim().toLowerCase()
  if (!slug) throw new Error('Slug requis')
  const community = await getCommunityBySlug(slug)
  if (!community) throw new Error('Communauté introuvable')

  const pool = getPool()
  const tM = table('mandala_community_members')
  await pool.execute(
    `INSERT INTO ${tM} (community_id, user_id, role) VALUES (?, ?, 'member')
     ON DUPLICATE KEY UPDATE role = role`,
    [community.id, params.userId]
  )

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT role FROM ${tM} WHERE community_id = ? AND user_id = ? LIMIT 1`,
    [community.id, params.userId]
  )
  const role = (rows[0]?.role ? String(rows[0].role) : 'member') as CommunityRole

  return { ...community, role }
}

export type CommunityAdminRecord = CommunityRecord & {
  is_active: boolean
  member_count: number
  created_at: string | null
}

export type CommunityMemberAdmin = {
  user_id: number
  email: string
  pseudo: string
  display_name: string
  role: CommunityRole
  joined_at: string | null
}

function mapCommunityAdminRow(r: RowDataPacket, memberCount = 0): CommunityAdminRecord {
  return {
    ...mapCommunityRow(r),
    is_active: Number(r.is_active ?? 1) === 1,
    member_count: memberCount,
    created_at: r.created_at ? String(r.created_at) : null,
  }
}

/** Liste toutes les communautés (y compris inactives) — admin app. */
export async function listCommunitiesAdmin(): Promise<CommunityAdminRecord[]> {
  if (!isDbConfigured()) return []
  await ensureCommunitiesTables()
  await seedDefaultCommunitiesIfEmpty()
  const pool = getPool()
  const tC = table('mandala_communities')
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name, c.tagline, c.description, c.location, c.website, c.contact_email,
            c.accent_color, c.logo_emoji, c.avatar, c.is_active, c.created_at,
            (SELECT COUNT(*) FROM ${tM} m WHERE m.community_id = c.id) AS member_count
     FROM ${tC} c
     ORDER BY c.is_active DESC, c.name ASC`
  )
  return (rows ?? []).map((r) => mapCommunityAdminRow(r, Number(r.member_count ?? 0)))
}

export async function getCommunityById(id: number): Promise<CommunityAdminRecord | null> {
  if (!id) return null
  await ensureCommunitiesTables()
  const pool = getPool()
  const tC = table('mandala_communities')
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name, c.tagline, c.description, c.location, c.website, c.contact_email,
            c.accent_color, c.logo_emoji, c.avatar, c.is_active, c.created_at,
            (SELECT COUNT(*) FROM ${tM} m WHERE m.community_id = c.id) AS member_count
     FROM ${tC} c WHERE c.id = ? LIMIT 1`,
    [id]
  )
  const r = rows[0]
  if (!r) return null
  return mapCommunityAdminRow(r, Number(r.member_count ?? 0))
}

export async function updateCommunityAdmin(
  id: number,
  body: {
    slug?: string
    name?: string
    tagline?: string | null
    description?: string | null
    location?: string | null
    website?: string | null
    contact_email?: string | null
    accent_color?: string | null
    logo_emoji?: string | null
    avatar?: string | null
    is_active?: boolean
  }
): Promise<CommunityAdminRecord> {
  if (!id) throw new Error('id requis')
  await ensureCommunitiesTables()
  const pool = getPool()
  const tC = table('mandala_communities')
  const existing = await getCommunityById(id)
  if (!existing) throw new Error('Communauté introuvable')

  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) throw new Error('Nom requis')
    updates.push('name = ?')
    values.push(name)
  }
  if (body.tagline !== undefined) {
    updates.push('tagline = ?')
    values.push(body.tagline ? String(body.tagline).trim().slice(0, 255) : null)
  }
  if (body.accent_color !== undefined) {
    const color = body.accent_color ? String(body.accent_color).trim().slice(0, 24) : null
    updates.push('accent_color = ?')
    values.push(color || '#7c3aed')
  }
  if (body.logo_emoji !== undefined) {
    updates.push('logo_emoji = ?')
    values.push(body.logo_emoji ? String(body.logo_emoji).trim().slice(0, 16) : '🏛️')
  }
  if (body.description !== undefined) {
    updates.push('description = ?')
    const d = body.description ? String(body.description).trim() : null
    values.push(d ? d.slice(0, 8000) : null)
  }
  if (body.location !== undefined) {
    updates.push('location = ?')
    values.push(body.location ? String(body.location).trim().slice(0, 255) : null)
  }
  if (body.website !== undefined) {
    updates.push('website = ?')
    values.push(body.website ? String(body.website).trim().slice(0, 255) : null)
  }
  if (body.contact_email !== undefined) {
    updates.push('contact_email = ?')
    values.push(body.contact_email ? String(body.contact_email).trim().slice(0, 120) : null)
  }
  if (body.avatar !== undefined) {
    const parsed = parseCommunityAvatarInput(body.avatar)
    updates.push('avatar = ?')
    values.push(parsed ?? null)
  }
  if (body.is_active !== undefined) {
    updates.push('is_active = ?')
    values.push(body.is_active ? 1 : 0)
  }
  if (body.slug !== undefined) {
    const slug = String(body.slug)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 64)
    if (!slug || slug.length < 2) throw new Error('Slug invalide')
    if (slug !== existing.slug) {
      const [dup] = await pool.execute<RowDataPacket[]>(`SELECT id FROM ${tC} WHERE slug = ? AND id != ?`, [
        slug,
        id,
      ])
      if (dup.length > 0) throw new Error('Ce slug existe déjà')
      updates.push('slug = ?')
      values.push(slug)
    }
  }

  if (updates.length > 0) {
    values.push(id)
    await pool.execute(`UPDATE ${tC} SET ${updates.join(', ')} WHERE id = ?`, values)
  }

  const updated = await getCommunityById(id)
  if (!updated) throw new Error('Mise à jour impossible')
  return updated
}

/** Tous les membres d'une communauté (admin, sans filtre profil public). */
export async function listCommunityMembersAdmin(communityId: number): Promise<CommunityMemberAdmin[]> {
  if (!communityId) return []
  await ensureCommunitiesTables()
  const pool = getPool()
  const tM = table('mandala_community_members')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT m.user_id, m.role, m.joined_at,
            u.user_email AS email,
            COALESCE(u.display_name, '') AS display_name,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', m.user_id)) AS pseudo
     FROM ${tM} m
     JOIN ${tUsers} u ON u.ID = m.user_id
     LEFT JOIN ${tMeta} p ON p.user_id = m.user_id AND p.meta_key = 'mdl_pseudo'
     WHERE m.community_id = ?
     ORDER BY m.role DESC, pseudo ASC`,
    [communityId]
  )
  return (rows ?? []).map((r) => ({
    user_id: Number(r.user_id),
    email: String(r.email ?? ''),
    pseudo: String(r.pseudo || r.display_name || `user_${r.user_id}`),
    display_name: String(r.display_name || ''),
    role: String(r.role) as CommunityRole,
    joined_at: r.joined_at ? String(r.joined_at) : null,
  }))
}

export async function setCommunityMemberRole(
  communityId: number,
  targetUserId: number,
  role: CommunityRole
): Promise<void> {
  if (!['member', 'organizer', 'admin'].includes(role)) {
    throw new Error('Rôle invalide')
  }
  await ensureCommunitiesTables()
  const pool = getPool()
  const tM = table('mandala_community_members')
  const [res] = await pool.execute(
    `UPDATE ${tM} SET role = ? WHERE community_id = ? AND user_id = ?`,
    [role, communityId, targetUserId]
  )
  if (Number((res as { affectedRows?: number }).affectedRows ?? 0) === 0) {
    throw new Error('Membre introuvable dans cette communauté')
  }
}

export async function requireCommunityMembership(
  userId: number,
  communityId: number
): Promise<CommunityRole> {
  await ensureCommunitiesTables()
  const pool = getPool()
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT role FROM ${tM} WHERE user_id = ? AND community_id = ? LIMIT 1`,
    [userId, communityId]
  )
  if (!rows.length) throw new Error('Accès communauté refusé')
  return String(rows[0].role) as CommunityRole
}
