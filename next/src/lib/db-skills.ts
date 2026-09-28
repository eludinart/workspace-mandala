/**
 * Fiches de compétences, annuaire et brèves personnelles.
 * La portée d'une brève est figée à la publication.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { ensureCommunitiesTables, listCommunitiesForUser } from './db-communities'
import { listVisibleResourcesByAuthor } from './db-resources'
import {
  isSkillRegister,
  isSkillScope,
  MAX_SKILL_NOTE,
  MAX_SKILL_TAGS,
  MAX_SKILL_TEXT,
  skillLabelKey,
  type SkillRegister,
  type SkillScope,
} from './skill-constants'

let _ensured = false

export type SkillTag = { label: string; register: SkillRegister }
export type SkillPlaceRef = {
  id: number
  slug: string
  name: string
  logo_emoji: string | null
}

export type SkillProfile = {
  user_id: number
  scope: SkillScope
  offer_text: string
  seek_text: string
  frame_text: string
  updated_at: string | null
  place_ids: number[]
  places: SkillPlaceRef[]
  tags: SkillTag[]
}

export type SkillCardResource = {
  id: number
  kind: string
  title: string
  summary: string
}

export type SkillCard = {
  user_id: number
  pseudo: string
  display_name: string
  avatar_emoji: string
  avatar: string | null
  scope: SkillScope
  offer_text: string
  seek_text: string
  frame_text: string
  tags: SkillTag[]
  places: SkillPlaceRef[]
  is_me: boolean
  /** Présente seulement si la personne a coché « Profil visible dans Membres ». */
  bio: string
  resources: SkillCardResource[]
  /** Faux quand la fiche compétences est cachée : l'identité, la bio et les ressources restent lisibles. */
  skills_visible: boolean
}

export type SkillNote = {
  id: number
  author_id: number
  content: string
  scope: 'places' | 'mandala'
  created_at: string
  author_pseudo: string
  author_avatar_emoji: string
  author_avatar: string | null
  places: SkillPlaceRef[]
  is_mine: boolean
}

async function ensureSkillTables(): Promise<void> {
  if (_ensured || !isDbConfigured()) return
  await ensureCommunitiesTables()
  const pool = getPool()
  const tP = table('mandala_skill_profiles')
  const tPlaces = table('mandala_skill_profile_places')
  const tTags = table('mandala_skill_tags')
  const tTraits = table('mandala_skill_traits')
  const tNotes = table('mandala_skill_notes')
  const tNotePlaces = table('mandala_skill_note_places')

  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tP} (
      user_id INT NOT NULL PRIMARY KEY,
      scope VARCHAR(16) NOT NULL DEFAULT 'hidden',
      offer_text VARCHAR(2000) NOT NULL DEFAULT '',
      seek_text VARCHAR(2000) NOT NULL DEFAULT '',
      frame_text VARCHAR(2000) NOT NULL DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tPlaces} (
      user_id INT NOT NULL,
      community_id INT NOT NULL,
      PRIMARY KEY (user_id, community_id),
      KEY idx_community (community_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tTags} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      label VARCHAR(40) NOT NULL,
      label_key VARCHAR(40) NOT NULL,
      register VARCHAR(16) NOT NULL DEFAULT 'share',
      UNIQUE KEY uniq_user_label (user_id, label_key),
      KEY idx_label_key (label_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tTraits} (
      user_id INT NOT NULL,
      code VARCHAR(32) NOT NULL,
      PRIMARY KEY (user_id, code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tNotes} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      author_id INT NOT NULL,
      content VARCHAR(500) NOT NULL,
      scope VARCHAR(16) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_author_created (author_id, created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tNotePlaces} (
      note_id INT NOT NULL,
      community_id INT NOT NULL,
      PRIMARY KEY (note_id, community_id),
      KEY idx_community (community_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `ALTER TABLE ${tP} MODIFY offer_text VARCHAR(2000) NOT NULL DEFAULT ''`
  )
  await exec(
    pool,
    `ALTER TABLE ${tP} MODIFY seek_text VARCHAR(2000) NOT NULL DEFAULT ''`
  )
  const [cols] = await pool.execute<RowDataPacket[]>(`SHOW COLUMNS FROM ${tP}`)
  const existing = new Set((cols ?? []).map((c) => String(c.Field)))
  if (!existing.has('frame_text')) {
    await exec(pool, `ALTER TABLE ${tP} ADD COLUMN frame_text VARCHAR(2000) NOT NULL DEFAULT ''`)
  }
  _ensured = true
}

function emptyProfile(userId: number): SkillProfile {
  return {
    user_id: userId,
    scope: 'hidden',
    offer_text: '',
    seek_text: '',
    frame_text: '',
    updated_at: null,
    place_ids: [],
    places: [],
    tags: [],
  }
}

async function loadProfile(userId: number): Promise<SkillProfile> {
  await ensureSkillTables()
  const pool = getPool()
  const tP = table('mandala_skill_profiles')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, scope, offer_text, seek_text, frame_text, updated_at FROM ${tP} WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  const r = rows[0]
  const profile = r
    ? {
        ...emptyProfile(userId),
        scope: isSkillScope(r.scope) ? r.scope : 'hidden',
        offer_text: String(r.offer_text ?? ''),
        seek_text: String(r.seek_text ?? ''),
        frame_text: String(r.frame_text ?? ''),
        updated_at: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
      }
    : emptyProfile(userId)

  const tPlaces = table('mandala_skill_profile_places')
  const tC = table('mandala_communities')
  const [placeRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name, c.logo_emoji
     FROM ${tPlaces} sp
     JOIN ${tC} c ON c.id = sp.community_id AND c.is_active = 1
     WHERE sp.user_id = ?
     ORDER BY c.name ASC`,
    [userId]
  )
  profile.places = (placeRows ?? []).map(mapPlace)
  profile.place_ids = profile.places.map((p) => p.id)

  const tTags = table('mandala_skill_tags')
  const [tagRows] = await pool.execute<RowDataPacket[]>(
    `SELECT label, register FROM ${tTags} WHERE user_id = ? ORDER BY label ASC`,
    [userId]
  )
  profile.tags = (tagRows ?? [])
    .map((t) => ({
      label: String(t.label),
      register: isSkillRegister(t.register) ? t.register : 'share',
    }))
    .filter((t) => t.label)

  return profile
}

function mapPlace(r: RowDataPacket): SkillPlaceRef {
  return {
    id: Number(r.id ?? r.community_id),
    slug: String(r.slug ?? ''),
    name: String(r.name ?? ''),
    logo_emoji: r.logo_emoji != null ? String(r.logo_emoji) : null,
  }
}

export async function getMySkillProfile(userId: number): Promise<SkillProfile> {
  return loadProfile(userId)
}

export type SkillProfileInput = {
  scope: SkillScope
  offer_text: string
  seek_text: string
  frame_text: string
  place_ids: number[]
  tags: SkillTag[]
}

export async function saveMySkillProfile(userId: number, input: SkillProfileInput): Promise<SkillProfile> {
  await ensureSkillTables()
  const mine = await listCommunitiesForUser(userId)
  const mineIds = new Set(mine.map((c) => c.id))
  const placeIds =
    input.scope === 'places'
      ? [...new Set(input.place_ids.filter((id) => mineIds.has(id)))]
      : []

  const tags: SkillTag[] = []
  const seen = new Set<string>()
  for (const raw of input.tags) {
    if (!isSkillRegister(raw.register)) continue
    const label = String(raw.label ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
    const key = skillLabelKey(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    tags.push({ label, register: raw.register })
    if (tags.length >= MAX_SKILL_TAGS) break
  }

  const offer = input.offer_text.trim().slice(0, MAX_SKILL_TEXT)
  const seek = input.seek_text.trim().slice(0, MAX_SKILL_TEXT)
  const frame = input.frame_text.trim().slice(0, MAX_SKILL_TEXT)
  const pool = getPool()
  const tP = table('mandala_skill_profiles')
  await pool.execute(
    `INSERT INTO ${tP} (user_id, scope, offer_text, seek_text, frame_text)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE scope = VALUES(scope), offer_text = VALUES(offer_text), seek_text = VALUES(seek_text), frame_text = VALUES(frame_text)`,
    [userId, input.scope, offer, seek, frame]
  )

  const tPlaces = table('mandala_skill_profile_places')
  await pool.execute(`DELETE FROM ${tPlaces} WHERE user_id = ?`, [userId])
  for (const id of placeIds) {
    await pool.execute(`INSERT INTO ${tPlaces} (user_id, community_id) VALUES (?, ?)`, [userId, id])
  }

  const tTags = table('mandala_skill_tags')
  await pool.execute(`DELETE FROM ${tTags} WHERE user_id = ?`, [userId])
  for (const tag of tags) {
    await pool.execute(
      `INSERT INTO ${tTags} (user_id, label, label_key, register) VALUES (?, ?, ?, ?)`,
      [userId, tag.label, skillLabelKey(tag.label), tag.register]
    )
  }

  return loadProfile(userId)
}

async function viewerCanSeeProfile(
  viewerId: number,
  profile: SkillProfile,
  viewerPlaceIds: Set<number>
): Promise<boolean> {
  if (profile.user_id === viewerId) return true
  if (profile.scope === 'hidden') return false
  if (profile.scope === 'mandala') return true
  return profile.place_ids.some((id) => viewerPlaceIds.has(id))
}

async function displayIdentity(userIds: number[]): Promise<
  Map<number, { pseudo: string; display_name: string; avatar_emoji: string; avatar: string | null }>
> {
  const map = new Map<number, { pseudo: string; display_name: string; avatar_emoji: string; avatar: string | null }>()
  if (!userIds.length) return map
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const placeholders = userIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID AS user_id,
            COALESCE(u.display_name, '') AS display_name,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', u.ID)) AS pseudo,
            COALESCE(e.meta_value, '🌸') AS avatar_emoji,
            COALESCE(a.meta_value, '') AS avatar
     FROM ${tUsers} u
     LEFT JOIN ${tMeta} p ON p.user_id = u.ID AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} e ON e.user_id = u.ID AND e.meta_key = 'mdl_avatar_emoji'
     LEFT JOIN ${tMeta} a ON a.user_id = u.ID AND a.meta_key = 'mdl_avatar'
     WHERE u.ID IN (${placeholders})`,
    userIds
  )
  for (const r of rows ?? []) {
    map.set(Number(r.user_id), {
      pseudo: String(r.pseudo || r.display_name || `user_${r.user_id}`),
      display_name: String(r.display_name || ''),
      avatar_emoji: String(r.avatar_emoji || '🌸'),
      avatar: r.avatar ? String(r.avatar) : null,
    })
  }
  return map
}

function cardFromProfile(
  profile: SkillProfile,
  identity: { pseudo: string; display_name: string; avatar_emoji: string; avatar: string | null },
  viewerId: number,
  visiblePlaces: SkillPlaceRef[],
  extras?: { bio?: string; resources?: SkillCardResource[]; skillsVisible?: boolean }
): SkillCard {
  const skillsVisible = extras?.skillsVisible !== false
  return {
    user_id: profile.user_id,
    pseudo: identity.pseudo,
    display_name: identity.display_name,
    avatar_emoji: identity.avatar_emoji,
    avatar: identity.avatar,
    scope: profile.scope,
    offer_text: skillsVisible ? profile.offer_text : '',
    seek_text: skillsVisible ? profile.seek_text : '',
    frame_text: skillsVisible ? profile.frame_text : '',
    tags: skillsVisible ? profile.tags : [],
    places: skillsVisible ? visiblePlaces : [],
    is_me: profile.user_id === viewerId,
    bio: extras?.bio ?? '',
    resources: extras?.resources ?? [],
    skills_visible: skillsVisible,
  }
}

async function readSharedBio(userId: number, viewerId: number): Promise<string> {
  const pool = getPool()
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_key, meta_value FROM ${tMeta}
     WHERE user_id = ? AND meta_key IN ('mdl_bio', 'mdl_profile_public')`,
    [userId]
  )
  let bio = ''
  let profilePublic = false
  for (const row of rows ?? []) {
    if (row.meta_key === 'mdl_bio') bio = String(row.meta_value ?? '').trim()
    if (row.meta_key === 'mdl_profile_public') profilePublic = String(row.meta_value ?? '') === '1'
  }
  if (userId !== viewerId && !profilePublic) return ''
  return bio
}

export async function getVisibleSkillCard(viewerId: number, subjectId: number): Promise<SkillCard | null> {
  const profile = await loadProfile(subjectId)
  const mine = await listCommunitiesForUser(viewerId)
  const viewerPlaceIds = new Set(mine.map((c) => c.id))
  const skillsVisible = await viewerCanSeeProfile(viewerId, profile, viewerPlaceIds)
  let sharesPlace = viewerId === subjectId || skillsVisible
  if (!sharesPlace) {
    const theirs = await listCommunitiesForUser(subjectId)
    sharesPlace = theirs.some((c) => viewerPlaceIds.has(c.id))
  }
  if (!skillsVisible && !sharesPlace) return null
  const identities = await displayIdentity([subjectId])
  const identity = identities.get(subjectId) ?? {
    pseudo: `user_${subjectId}`,
    display_name: '',
    avatar_emoji: '🌸',
    avatar: null,
  }
  const places = profile.places.filter((p) => viewerPlaceIds.has(p.id))
  const [bio, resources] = await Promise.all([
    readSharedBio(subjectId, viewerId),
    listVisibleResourcesByAuthor(viewerId, subjectId),
  ])
  return cardFromProfile(profile, identity, viewerId, places, {
    bio,
    skillsVisible,
    resources: resources.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      summary: r.summary,
    })),
  })
}

export async function listSkillDirectory(params: {
  viewerId: number
  view: 'place' | 'mandala'
  communityId?: number | null
  query?: string
  tag?: string
  /** Annuaire public : fiches ouvertes à Mandala, sans exiger d'être membre. */
  publicAccess?: boolean
}): Promise<SkillCard[]> {
  await ensureSkillTables()
  const mine = await listCommunitiesForUser(params.viewerId)
  const viewerPlaceIds = new Set(mine.map((c) => c.id))
  const pool = getPool()
  const tP = table('mandala_skill_profiles')
  const tPlaces = table('mandala_skill_profile_places')
  const tM = table('mandala_community_members')

  let userIds: number[] = []
  if (params.view === 'mandala') {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id FROM ${tP} WHERE scope = 'mandala'`
    )
    userIds = (rows ?? []).map((r) => Number(r.user_id))
  } else {
    const communityId = params.communityId
    if (!communityId) return []
    if (!params.publicAccess && !viewerPlaceIds.has(communityId)) return []
    const visibility = params.publicAccess
      ? `p.scope = 'mandala'`
      : `p.scope = 'mandala'
          OR (p.scope = 'places' AND EXISTS (
            SELECT 1 FROM ${tPlaces} sp WHERE sp.user_id = p.user_id AND sp.community_id = ?
          ))`
    const sqlParams: number[] = params.publicAccess ? [communityId] : [communityId, communityId]
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.user_id
       FROM ${tP} p
       JOIN ${tM} m ON m.user_id = p.user_id AND m.community_id = ?
       WHERE ${visibility}`,
      sqlParams
    )
    userIds = (rows ?? []).map((r) => Number(r.user_id))
  }

  const q = (params.query ?? '').trim().toLocaleLowerCase('fr')
  const tagKey = skillLabelKey(params.tag ?? '')
  const identities = await displayIdentity(userIds)
  const cards: SkillCard[] = []

  for (const userId of userIds) {
    const profile = await loadProfile(userId)
    if (profile.scope === 'hidden') continue
    if (tagKey && !profile.tags.some((t) => skillLabelKey(t.label) === tagKey)) continue
    const identity = identities.get(userId)
    if (!identity) continue
    if (q) {
      const hay = [
        identity.pseudo,
        identity.display_name,
        profile.offer_text,
        profile.seek_text,
        profile.frame_text,
        ...profile.tags.map((t) => t.label),
      ]
        .join(' ')
        .toLocaleLowerCase('fr')
      if (!hay.includes(q)) continue
    }
    const places = params.publicAccess
      ? (await listCommunitiesForUser(userId)).map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          logo_emoji: c.logo_emoji,
        }))
      : profile.places.filter((p) => viewerPlaceIds.has(p.id))
    cards.push(cardFromProfile(profile, identity, params.viewerId, places))
  }

  cards.sort((a, b) =>
    (a.display_name || a.pseudo).localeCompare(b.display_name || b.pseudo, 'fr', { sensitivity: 'base' })
  )
  return cards
}

export async function createSkillNote(userId: number, content: string): Promise<SkillNote> {
  const text = content.trim().slice(0, MAX_SKILL_NOTE)
  if (!text) throw Object.assign(new Error('Écrivez une brève'), { status: 400 })
  const profile = await loadProfile(userId)
  if (profile.scope === 'hidden') {
    throw Object.assign(
      new Error('Rendez votre fiche visible avant de publier une brève'),
      { status: 400 }
    )
  }
  const scope = profile.scope === 'mandala' ? 'mandala' : 'places'
  const placeIds = scope === 'places' ? profile.place_ids : []
  if (scope === 'places' && !placeIds.length) {
    throw Object.assign(new Error('Cochez au moins un lieu sur votre fiche'), { status: 400 })
  }

  const pool = getPool()
  const tNotes = table('mandala_skill_notes')
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${tNotes} (author_id, content, scope) VALUES (?, ?, ?)`,
    [userId, text, scope]
  )
  const noteId = Number(res.insertId)
  if (scope === 'places') {
    const tNotePlaces = table('mandala_skill_note_places')
    for (const id of placeIds) {
      await pool.execute(`INSERT INTO ${tNotePlaces} (note_id, community_id) VALUES (?, ?)`, [noteId, id])
    }
  }
  const notes = await listVisibleSkillNotes(userId, 1, noteId)
  const created = notes[0]
  if (!created) throw Object.assign(new Error('Brève introuvable'), { status: 500 })
  return created
}

export async function deleteSkillNote(userId: number, noteId: number): Promise<void> {
  await ensureSkillTables()
  const pool = getPool()
  const tNotes = table('mandala_skill_notes')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT author_id FROM ${tNotes} WHERE id = ? LIMIT 1`,
    [noteId]
  )
  if (!rows[0]) throw Object.assign(new Error('Brève introuvable'), { status: 404 })
  if (Number(rows[0].author_id) !== userId) {
    throw Object.assign(new Error('Vous ne pouvez supprimer que vos brèves'), { status: 403 })
  }
  const tNotePlaces = table('mandala_skill_note_places')
  await pool.execute(`DELETE FROM ${tNotePlaces} WHERE note_id = ?`, [noteId])
  await pool.execute(`DELETE FROM ${tNotes} WHERE id = ?`, [noteId])
}

export async function listVisibleSkillNotes(
  viewerId: number,
  limit = 40,
  onlyId?: number
): Promise<SkillNote[]> {
  await ensureSkillTables()
  const mine = await listCommunitiesForUser(viewerId)
  const viewerPlaceIds = mine.map((c) => c.id)
  const pool = getPool()
  const tNotes = table('mandala_skill_notes')
  const tP = table('mandala_skill_profiles')
  const tNotePlaces = table('mandala_skill_note_places')
  const tUsers = table('users')
  const tMeta = table('usermeta')

  const params: Array<string | number> = []
  const placeClause = viewerPlaceIds.length
    ? `n.scope = 'places' AND EXISTS (
         SELECT 1 FROM ${tNotePlaces} np
         WHERE np.note_id = n.id AND np.community_id IN (${viewerPlaceIds.map(() => '?').join(',')})
       )`
    : '0'
  if (viewerPlaceIds.length) params.push(...viewerPlaceIds)
  params.push(viewerId)
  const idClause = onlyId ? 'AND n.id = ?' : ''
  if (onlyId) params.push(onlyId)
  params.push(Math.min(Math.max(limit, 1), 80))

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT n.id, n.author_id, n.content, n.scope, n.created_at,
            COALESCE(u.display_name, '') AS display_name,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', n.author_id)) AS pseudo,
            COALESCE(e.meta_value, '🌸') AS avatar_emoji,
            COALESCE(a.meta_value, '') AS avatar
     FROM ${tNotes} n
     JOIN ${tP} prof ON prof.user_id = n.author_id
     JOIN ${tUsers} u ON u.ID = n.author_id
     LEFT JOIN ${tMeta} p ON p.user_id = u.ID AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} e ON e.user_id = u.ID AND e.meta_key = 'mdl_avatar_emoji'
     LEFT JOIN ${tMeta} a ON a.user_id = u.ID AND a.meta_key = 'mdl_avatar'
     WHERE (prof.scope <> 'hidden' OR n.author_id = ?)
       AND (n.scope = 'mandala' OR ${placeClause} OR n.author_id = ?)
       ${idClause}
     ORDER BY n.created_at DESC
     LIMIT ?`,
    [viewerId, ...params]
  )

  const notes: SkillNote[] = []
  const tC = table('mandala_communities')
  for (const r of rows ?? []) {
    const noteId = Number(r.id)
    const scope = r.scope === 'mandala' ? 'mandala' : 'places'
    let places: SkillPlaceRef[] = []
    if (scope === 'places') {
      const [placeRows] = await pool.execute<RowDataPacket[]>(
        `SELECT c.id, c.slug, c.name, c.logo_emoji
         FROM ${tNotePlaces} np
         JOIN ${tC} c ON c.id = np.community_id AND c.is_active = 1
         WHERE np.note_id = ?
         ORDER BY c.name ASC`,
        [noteId]
      )
      places = (placeRows ?? []).map(mapPlace)
      if (Number(r.author_id) !== viewerId) {
        places = places.filter((p) => viewerPlaceIds.includes(p.id))
      }
    }
    notes.push({
      id: noteId,
      author_id: Number(r.author_id),
      content: String(r.content),
      scope,
      created_at: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
      author_pseudo: String(r.pseudo || r.display_name || `user_${r.author_id}`),
      author_avatar_emoji: String(r.avatar_emoji || '🌸'),
      author_avatar: r.avatar ? String(r.avatar) : null,
      places,
      is_mine: Number(r.author_id) === viewerId,
    })
  }
  return notes
}

export async function deleteSkillDataForUser(userId: number): Promise<void> {
  if (!isDbConfigured() || !userId) return
  await ensureSkillTables()
  const pool = getPool()
  const tNotes = table('mandala_skill_notes')
  const tNotePlaces = table('mandala_skill_note_places')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tNotes} WHERE author_id = ?`,
    [userId]
  )
  const ids = (rows ?? []).map((r) => Number(r.id))
  if (ids.length) {
    await pool.execute(
      `DELETE FROM ${tNotePlaces} WHERE note_id IN (${ids.map(() => '?').join(',')})`,
      ids
    )
  }
  await pool.execute(`DELETE FROM ${tNotes} WHERE author_id = ?`, [userId])
  await pool.execute(`DELETE FROM ${table('mandala_skill_tags')} WHERE user_id = ?`, [userId])
  await pool.execute(`DELETE FROM ${table('mandala_skill_traits')} WHERE user_id = ?`, [userId])
  await pool.execute(`DELETE FROM ${table('mandala_skill_profile_places')} WHERE user_id = ?`, [userId])
  await pool.execute(`DELETE FROM ${table('mandala_skill_profiles')} WHERE user_id = ?`, [userId])
}
