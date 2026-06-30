/**
 * Communautés (lieux / groupes) — multi-tenant Mandala.
 */
import { createHash } from 'crypto'
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import {
  charterRequiresAcceptance,
  parseCharterBlocks,
  serializeCharterBlocks,
  type CharterBlock,
} from './community-charter'
import { isCommunityManagerRole } from './community-role-labels'
import { weatherFromMetaRow } from './db-weather'
import { WEATHER_META_KEY } from './weather-status'

export type CommunityRecord = {
  id: number
  slug: string
  name: string
  tagline: string | null
  description: string | null
  location: string | null
  website: string | null
  contact_email: string | null
  latitude: number | null
  longitude: number | null
  accent_color: string | null
  logo_emoji: string | null
  avatar: string | null
  charter?: CharterBlock[]
}

export type CommunityManagerRecord = CommunityRecord & {
  charter: CharterBlock[]
}

export type CommunityRole = 'member' | 'organizer' | 'admin'

const COMMUNITY_COLS =
  'id, slug, name, tagline, description, location, website, contact_email, latitude, longitude, accent_color, logo_emoji, avatar, charter'

const MAX_COMMUNITY_AVATAR_BYTES = 150_000

function parseCoord(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseCommunityCoord(v: unknown, field: 'latitude' | 'longitude'): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`${field === 'latitude' ? 'Latitude' : 'Longitude'} invalide`)
  if (field === 'latitude' && (n < -90 || n > 90)) throw new Error('Latitude hors limites (-90 à 90)')
  if (field === 'longitude' && (n < -180 || n > 180)) throw new Error('Longitude hors limites (-180 à 180)')
  return n
}

function mapCommunityRow(r: RowDataPacket): CommunityRecord {
  let charter: CharterBlock[] | undefined
  if (r.charter != null && String(r.charter).trim()) {
    try {
      charter = parseCharterBlocks(String(r.charter))
    } catch {
      charter = []
    }
  }
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    tagline: r.tagline ? String(r.tagline) : null,
    description: r.description ? String(r.description) : null,
    location: r.location ? String(r.location) : null,
    website: r.website ? String(r.website) : null,
    contact_email: r.contact_email ? String(r.contact_email) : null,
    latitude: parseCoord(r.latitude),
    longitude: parseCoord(r.longitude),
    accent_color: r.accent_color ? String(r.accent_color) : null,
    logo_emoji: r.logo_emoji ? String(r.logo_emoji) : null,
    avatar: r.avatar ? String(r.avatar) : null,
    ...(charter !== undefined ? { charter } : {}),
  }
}

function mapCommunityManagerRow(r: RowDataPacket): CommunityManagerRecord {
  const base = mapCommunityRow(r)
  return {
    ...base,
    charter: base.charter ?? [],
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
  { name: 'charter', ddl: 'charter LONGTEXT DEFAULT NULL' },
  { name: 'latitude', ddl: 'latitude DECIMAL(9,6) DEFAULT NULL' },
  { name: 'longitude', ddl: 'longitude DECIMAL(9,6) DEFAULT NULL' },
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

/** Coordonnées par défaut pour les lieux de démo sans position GPS. */
async function seedDefaultCommunityGeoHints(
  pool: ReturnType<typeof getPool>,
  tC: string
): Promise<void> {
  const hints: Array<{
    slug: string
    location: string
    latitude: number
    longitude: number
    description?: string
  }> = [
    {
      slug: 'shambhala',
      location: 'Inde',
      latitude: 28.6139,
      longitude: 77.209,
      description: 'Communauté spirituelle et lieu de retraite.',
    },
    {
      slug: 'sivana',
      location: 'France',
      latitude: 43.6047,
      longitude: 1.4442,
      description: 'Espace de partage et de pratiques en France.',
    },
  ]
  for (const h of hints) {
    await pool.execute(
      `UPDATE ${tC}
       SET location = COALESCE(location, ?),
           latitude = COALESCE(latitude, ?),
           longitude = COALESCE(longitude, ?),
           description = COALESCE(description, ?)
       WHERE slug = ?`,
      [h.location, h.latitude, h.longitude, h.description ?? null, h.slug]
    )
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
  await seedDefaultCommunityGeoHints(pool, tC)
  const tA = table('mandala_charter_acceptances')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tA} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      community_id INT NOT NULL,
      user_id INT NOT NULL,
      charter_hash VARCHAR(32) NOT NULL,
      accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_community (user_id, community_id),
      KEY idx_community (community_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  _ensured = true
}

export async function seedDefaultCommunitiesIfEmpty(): Promise<void> {
  await ensureCommunitiesTables()
  const pool = getPool()
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM ${tC}`)
  if (Number(rows[0]?.c ?? 0) > 0) return
  await pool.execute(
    `INSERT INTO ${tC} (slug, name, tagline, description, location, latitude, longitude, accent_color, logo_emoji) VALUES
      ('shambhala', 'Shambhala', 'Lieu cœur — Inde', 'Communauté spirituelle et lieu de retraite.', 'Inde', 28.613900, 77.209000, '#d97706', '🕉️'),
      ('sivana', 'Sivanà', 'Communauté Sivanà', 'Espace de partage et de pratiques en France.', 'France', 43.604700, 1.444200, '#7c3aed', '🌸')`
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
  weather_status: string | null
  weather_note: string | null
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
            COALESCE(pub.meta_value, '0') AS profile_public,
            w.meta_value AS weather_json
     FROM ${tM} m
     JOIN ${tUsers} u ON u.ID = m.user_id
     LEFT JOIN ${tMeta} p ON p.user_id = m.user_id AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} e ON e.user_id = m.user_id AND e.meta_key = 'mdl_avatar_emoji'
     LEFT JOIN ${tMeta} a ON a.user_id = m.user_id AND a.meta_key = 'mdl_avatar'
     LEFT JOIN ${tMeta} pub ON pub.user_id = m.user_id AND pub.meta_key = 'mdl_profile_public'
     LEFT JOIN ${tMeta} w ON w.user_id = m.user_id AND w.meta_key = ?
     WHERE m.community_id = ?
     ORDER BY (m.user_id = ?) DESC, pseudo ASC`,
    [WEATHER_META_KEY, communityId, viewerUserId]
  )

  return (rows ?? [])
    .map((r) => {
      const { weather_status, weather_note } = weatherFromMetaRow(
        r.weather_json as string | undefined,
        communityId
      )
      return {
        user_id: Number(r.user_id),
        pseudo: String(r.pseudo || r.display_name || `user_${r.user_id}`),
        display_name: String(r.display_name || ''),
        avatar_emoji: String(r.avatar_emoji || '🌸'),
        avatar: r.avatar ? String(r.avatar) : null,
        profile_public: String(r.profile_public) === '1',
        is_me: Number(r.user_id) === viewerUserId,
        role: String(r.role) as CommunityRole,
        weather_status,
        weather_note,
      }
    })
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
    weather_status: string | null
    weather_note: string | null
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
            COALESCE(pub.meta_value, '0') AS profile_public,
            w.meta_value AS weather_json
     FROM ${tM} m
     JOIN ${tC} c ON c.id = m.community_id AND c.is_active = 1
     JOIN ${tUsers} u ON u.ID = m.user_id
     LEFT JOIN ${tMeta} p ON p.user_id = m.user_id AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} e ON e.user_id = m.user_id AND e.meta_key = 'mdl_avatar_emoji'
     LEFT JOIN ${tMeta} a ON a.user_id = m.user_id AND a.meta_key = 'mdl_avatar'
     LEFT JOIN ${tMeta} pub ON pub.user_id = m.user_id AND pub.meta_key = 'mdl_profile_public'
     LEFT JOIN ${tMeta} w ON w.user_id = m.user_id AND w.meta_key = ?
     WHERE m.community_id IN (${placeholders})
     ORDER BY c.name ASC, pseudo ASC`,
    [WEATHER_META_KEY, ...communityIds]
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
      const { weather_status, weather_note } = weatherFromMetaRow(
        r.weather_json as string | undefined,
        communityId
      )
      entry.communities.push({
        slug,
        name,
        logo_emoji: logo,
        role,
        weather_status,
        weather_note,
      })
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
    `INSERT INTO ${tM} (community_id, user_id, role) VALUES (?, ?, 'organizer')`,
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

/** Lieux dont l'utilisateur est gestionnaire (rôle organizer/admin sur le lieu uniquement). */
export async function listCommunitiesManagedByUser(userId: number): Promise<CommunityAdminRecord[]> {
  if (!userId) return []
  await ensureCommunitiesTables()
  const pool = getPool()
  const tC = table('mandala_communities')
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name, c.tagline, c.description, c.location, c.website, c.contact_email,
            c.accent_color, c.logo_emoji, c.avatar, c.is_active, c.created_at, m.role,
            (SELECT COUNT(*) FROM ${tM} m2 WHERE m2.community_id = c.id) AS member_count
     FROM ${tM} m
     JOIN ${tC} c ON c.id = m.community_id
     WHERE m.user_id = ?
     ORDER BY c.is_active DESC, c.name ASC`,
    [userId]
  )
  return (rows ?? [])
    .filter((r) => isCommunityManagerRole(String(r.role)))
    .map((r) => mapCommunityAdminRow(r, Number(r.member_count ?? 0)))
}

export async function assertUserCanManageCommunity(
  userId: number,
  communityId: number,
  options?: { isAppSiteManager?: boolean }
): Promise<void> {
  let role: CommunityRole
  try {
    role = await requireCommunityMembership(userId, communityId)
  } catch {
    throw Object.assign(new Error('Accès refusé à ce lieu'), { status: 403 })
  }
  if (!canManageCommunitySettings(role, false, !!options?.isAppSiteManager)) {
    throw Object.assign(new Error('Droits gestionnaire requis pour ce lieu'), { status: 403 })
  }
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

/**
 * Retire un membre d'un lieu et purge ses données liées à cette communauté
 * (présences calendrier, inscriptions événements, publications Agora, météo cœur).
 */
export async function removeUserFromCommunity(
  communityId: number,
  targetUserId: number
): Promise<void> {
  await ensureCommunitiesTables()
  const pool = getPool()
  const tM = table('mandala_community_members')

  const [mem] = await pool.execute<RowDataPacket[]>(
    `SELECT role FROM ${tM} WHERE community_id = ? AND user_id = ? LIMIT 1`,
    [communityId, targetUserId]
  )
  if (!mem.length) {
    throw new Error('Cette personne n’est pas membre de ce lieu')
  }

  const { ensureCalendarTables } = await import('./db-calendar')
  await ensureCalendarTables()
  await pool.execute(`DELETE FROM ${table('calendar_presence')} WHERE community_id = ? AND user_id = ?`, [
    communityId,
    targetUserId,
  ])

  const { ensureEventsTables } = await import('./db-mandala-events')
  await ensureEventsTables()
  const tE = table('events')
  const tS = table('event_staff')
  const tT = table('event_tasks')
  await pool.execute(
    `DELETE s FROM ${tS} s INNER JOIN ${tE} e ON e.id = s.event_id WHERE e.community_id = ? AND s.user_id = ?`,
    [communityId, targetUserId]
  )
  await pool.execute(
    `UPDATE ${tT} t INNER JOIN ${tE} e ON e.id = t.event_id SET t.assignee_user_id = NULL WHERE e.community_id = ? AND t.assignee_user_id = ?`,
    [communityId, targetUserId]
  )

  const { ensurePostTables } = await import('./db-posts')
  await ensurePostTables()
  await pool.execute(`DELETE FROM ${table('mandala_posts')} WHERE community_id = ? AND author_id = ?`, [
    communityId,
    targetUserId,
  ])

  const { clearUserWeatherForCommunity } = await import('./db-weather')
  await clearUserWeatherForCommunity(targetUserId, communityId)

  const [del] = await pool.execute(`DELETE FROM ${tM} WHERE community_id = ? AND user_id = ?`, [
    communityId,
    targetUserId,
  ])
  if (Number((del as { affectedRows?: number }).affectedRows ?? 0) === 0) {
    throw new Error('Suppression du membre impossible')
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

export function canManageCommunitySettings(
  role: CommunityRole,
  isAppAdmin: boolean,
  isAppSiteManager = false
): boolean {
  return isAppAdmin || isAppSiteManager || role === 'organizer' || role === 'admin'
}

/** Gestion d’un lieu dans son contexte (sans bypass administrateur application). */
export function canManageCommunityInContext(
  role: CommunityRole,
  isAppSiteManager = false
): boolean {
  return isAppSiteManager || role === 'organizer' || role === 'admin'
}

/** Création / édition d’événements : réservée à l’organisation du lieu (pas au simple membre). */
export function canOrganizeCommunityEvents(role: CommunityRole): boolean {
  return role === 'organizer' || role === 'admin'
}

export async function getCommunitySettingsForManager(
  slug: string,
  userId: number,
  isAppSiteManager = false
): Promise<CommunityManagerRecord & { can_manage: boolean; member_role: CommunityRole | null }> {
  await ensureCommunitiesTables()
  const community = await getCommunityBySlug(slug)
  if (!community) throw new Error('Lieu introuvable')

  const memberRole = await requireCommunityMembership(userId, community.id)
  const can_manage = canManageCommunityInContext(memberRole, isAppSiteManager)
  if (!can_manage) throw new Error('Droits gestionnaire requis')

  const pool = getPool()
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${COMMUNITY_COLS} FROM ${tC} WHERE id = ? LIMIT 1`,
    [community.id]
  )
  const row = rows[0]
  if (!row) throw new Error('Lieu introuvable')
  return {
    ...mapCommunityManagerRow(row),
    can_manage: true,
    member_role: memberRole,
  }
}

export async function updateCommunitySettingsForManager(
  slug: string,
  userId: number,
  isAppSiteManager = false,
  body: {
    name?: string
    tagline?: string | null
    description?: string | null
    location?: string | null
    website?: string | null
    contact_email?: string | null
    latitude?: number | null
    longitude?: number | null
    accent_color?: string | null
    logo_emoji?: string | null
    avatar?: string | null
    charter?: unknown
  }
): Promise<CommunityManagerRecord> {
  const current = await getCommunitySettingsForManager(slug, userId, isAppSiteManager)
  const pool = getPool()
  const tC = table('mandala_communities')
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
  if (body.latitude !== undefined) {
    updates.push('latitude = ?')
    values.push(parseCommunityCoord(body.latitude, 'latitude'))
  }
  if (body.longitude !== undefined) {
    updates.push('longitude = ?')
    values.push(parseCommunityCoord(body.longitude, 'longitude'))
  }
  if (body.accent_color !== undefined) {
    updates.push('accent_color = ?')
    values.push(body.accent_color ? String(body.accent_color).trim().slice(0, 24) : '#7c3aed')
  }
  if (body.logo_emoji !== undefined) {
    updates.push('logo_emoji = ?')
    values.push(body.logo_emoji ? String(body.logo_emoji).trim().slice(0, 16) : '🏛️')
  }
  if (body.avatar !== undefined) {
    updates.push('avatar = ?')
    values.push(parseCommunityAvatarInput(body.avatar) ?? null)
  }
  if (body.charter !== undefined) {
    const blocks = parseCharterBlocks(body.charter)
    updates.push('charter = ?')
    values.push(blocks.length ? serializeCharterBlocks(blocks) : null)
  }

  if (updates.length === 0) return current

  values.push(current.id)
  await pool.execute(`UPDATE ${tC} SET ${updates.join(', ')} WHERE id = ?`, values)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${COMMUNITY_COLS} FROM ${tC} WHERE id = ? LIMIT 1`,
    [current.id]
  )
  return mapCommunityManagerRow(rows[0])
}

export type PublicCommunityCard = Pick<
  CommunityRecord,
  | 'id'
  | 'slug'
  | 'name'
  | 'tagline'
  | 'description'
  | 'location'
  | 'website'
  | 'contact_email'
  | 'latitude'
  | 'longitude'
  | 'accent_color'
  | 'logo_emoji'
  | 'avatar'
>

function mapPublicCommunityCard(c: CommunityRecord): PublicCommunityCard {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    location: c.location,
    website: c.website,
    contact_email: c.contact_email,
    latitude: c.latitude,
    longitude: c.longitude,
    accent_color: c.accent_color,
    logo_emoji: c.logo_emoji,
    avatar: c.avatar,
  }
}

/** Lieux actifs visibles avant connexion (landing & inscription). */
export async function listPublicCommunitiesForSignup(): Promise<PublicCommunityCard[]> {
  return listPublicCommunitiesForLanding()
}

/** Catalogue grand public — promotion des lieux inscrits. */
export async function listPublicCommunitiesForLanding(): Promise<PublicCommunityCard[]> {
  if (!isDbConfigured()) return []
  await ensureCommunitiesTables()
  await seedDefaultCommunitiesIfEmpty()
  const pool = getPool()
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, slug, name, tagline, description, location, website, contact_email,
            latitude, longitude, accent_color, logo_emoji, avatar
     FROM ${tC} WHERE is_active = 1 ORDER BY name ASC`
  )
  return (rows ?? []).map((r) => mapPublicCommunityCard(mapCommunityRow(r)))
}

export type CharterAcceptanceStatus = {
  accepted: boolean
  accepted_at: string | null
  charter_hash: string | null
}

async function getCharterAcceptance(
  userId: number,
  communityId: number
): Promise<CharterAcceptanceStatus> {
  await ensureCommunitiesTables()
  const pool = getPool()
  const tA = table('mandala_charter_acceptances')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT charter_hash, accepted_at FROM ${tA} WHERE user_id = ? AND community_id = ? LIMIT 1`,
    [userId, communityId]
  )
  const r = rows[0]
  if (!r) return { accepted: false, accepted_at: null, charter_hash: null }
  return {
    accepted: true,
    accepted_at: r.accepted_at ? String(r.accepted_at) : null,
    charter_hash: r.charter_hash ? String(r.charter_hash) : null,
  }
}

function communityCharterBlocks(community: CommunityRecord): CharterBlock[] {
  return community.charter ?? []
}

function charterContentHash(blocks: CharterBlock[]): string {
  const serialized = blocks.length ? serializeCharterBlocks(blocks) : ''
  return createHash('sha256').update(serialized).digest('hex').slice(0, 32)
}

export function userNeedsCharterAcceptance(
  blocks: CharterBlock[],
  acceptance: CharterAcceptanceStatus
): boolean {
  if (!charterRequiresAcceptance(blocks)) return false
  const hash = charterContentHash(blocks)
  return !acceptance.accepted || acceptance.charter_hash !== hash
}

export type OnboardingStatus = {
  needs_place_selection: boolean
  pending_charter_slugs: string[]
}

export async function getOnboardingStatus(userId: number): Promise<OnboardingStatus> {
  const memberships = await listCommunitiesForUser(userId)
  const needs_place_selection = memberships.length === 0
  const pending_charter_slugs: string[] = []

  for (const m of memberships) {
    const full = await getCommunityBySlug(m.slug)
    if (!full) continue
    const blocks = communityCharterBlocks(full)
    const acceptance = await getCharterAcceptance(userId, full.id)
    if (userNeedsCharterAcceptance(blocks, acceptance)) {
      pending_charter_slugs.push(m.slug)
    }
  }

  return { needs_place_selection, pending_charter_slugs }
}

export type MemberCharterView = {
  slug: string
  name: string
  tagline: string | null
  logo_emoji: string | null
  accent_color: string | null
  avatar: string | null
  charter: CharterBlock[]
  accepted: boolean
  accepted_at: string | null
  requires_acceptance: boolean
}

export async function getCommunityCharterForMember(
  userId: number,
  slug: string
): Promise<MemberCharterView> {
  const community = await getCommunityBySlug(slug.trim().toLowerCase())
  if (!community) throw Object.assign(new Error('Lieu introuvable'), { status: 404 })
  await requireCommunityMembership(userId, community.id)

  const blocks = communityCharterBlocks(community)
  const acceptance = await getCharterAcceptance(userId, community.id)
  const requires_acceptance = userNeedsCharterAcceptance(blocks, acceptance)

  return {
    slug: community.slug,
    name: community.name,
    tagline: community.tagline,
    logo_emoji: community.logo_emoji,
    accent_color: community.accent_color,
    avatar: community.avatar,
    charter: blocks,
    accepted: acceptance.accepted && !requires_acceptance,
    accepted_at: acceptance.accepted_at,
    requires_acceptance,
  }
}

export async function acceptCommunityCharter(
  userId: number,
  slug: string
): Promise<{ accepted_at: string; slug: string }> {
  const community = await getCommunityBySlug(slug.trim().toLowerCase())
  if (!community) throw Object.assign(new Error('Lieu introuvable'), { status: 404 })
  await requireCommunityMembership(userId, community.id)

  const blocks = communityCharterBlocks(community)
  if (!charterRequiresAcceptance(blocks)) {
    throw Object.assign(new Error('Ce lieu n’a pas publié de charte'), { status: 400 })
  }

  const hash = charterContentHash(blocks)
  const pool = getPool()
  const tA = table('mandala_charter_acceptances')
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  await pool.execute(
    `INSERT INTO ${tA} (community_id, user_id, charter_hash, accepted_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE charter_hash = VALUES(charter_hash), accepted_at = VALUES(accepted_at)`,
    [community.id, userId, hash, now]
  )
  return { accepted_at: now, slug: community.slug }
}
