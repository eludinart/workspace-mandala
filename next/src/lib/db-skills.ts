/**
 * Fiches de compétences, annuaire et brèves personnelles.
 * La portée d'une brève est figée à la publication.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { ensureCommunitiesTables, listCommunitiesForUser } from './db-communities'
import { notifyPlacesMembers, resolveActorLabel } from './db-place-activity-notify'
import { listVisibleResourcesByAuthor } from './db-resources'
import {
  isSkillRegister,
  isSkillScope,
  MAX_SKILL_NOTE,
  MAX_SKILL_TAG_LABEL,
  MAX_SKILL_TAGS,
  MAX_SKILL_TEXT,
  skillLabelKey,
  type SkillRegister,
  type SkillScope,
} from './skill-constants'
import { compareSkillBoost } from './billing-entitlements'
import {
  getProBoostFlagsForUsers,
  type ProDirectoryFlags,
} from './db-billing'
import { createNotification } from './db-notifications'
import { geocodeAddress } from '@/lib/geocode'
import {
  normalizeCityLabel,
  normalizePracticePlaces,
  practiceLocationsFromJson,
  practiceLocationsToJson,
  practicePlaceLabels,
  type PracticePlace,
} from './practice-locations'

function applyProFlags(card: SkillCard, flags: ProDirectoryFlags | undefined): void {
  if (!flags) return
  card.pro_boost = Boolean(flags.proBoost)
  card.pro_verified = Boolean(flags.proBoost && flags.proVerified)
  if (flags.proBoost) {
    card.pro_tagline = flags.tagline
    card.pro_modalities = flags.modalities
    card.pro_service_area = flags.service_area
    card.pro_external_url = flags.external_url
    if (flags.proVerified) {
      card.pro_endorsement_place = flags.endorsement_place_name
    }
  }
}

let _ensured = false

export type SkillTag = { label: string; register: SkillRegister }
export type SkillPlaceRef = {
  id: number
  slug: string
  name: string
  logo_emoji: string | null
  /** Fiche /lieux/[slug] ; faux → pas de lien (la page répond 404). */
  profile_public: boolean
}

export type SkillProfile = {
  user_id: number
  scope: SkillScope
  offer_text: string
  seek_text: string
  frame_text: string
  /** Ville où la personne vit — distincte des lieux d’exercice. */
  residence_city: string
  /** Afficher la résidence sur le profil public et la carte. */
  residence_public: boolean
  /** `city` = centre-ville ; `address` = adresse + GPS. */
  location_mode: 'city' | 'address'
  residence_address: string
  residence_postal_code: string
  latitude: number | null
  longitude: number | null
  /** Lieux d’exercice (ville et/ou adresse GPS). */
  practice_locations: PracticePlace[]
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
  /** Bio de la fiche. Visible avec la fiche quand la portée est ouverte. */
  bio: string
  /** Vrai si la personne et le lecteur partagent un lieu. */
  shares_place?: boolean
  /** Lieu commun, pour ouvrir une conversation. */
  shared_place_slug?: string | null
  resources: SkillCardResource[]
  /** Faux quand la fiche compétences est cachée : l'identité, la bio et les ressources restent lisibles. */
  skills_visible: boolean
  /** Abo Mandala Pro actif → boost annuaire. */
  pro_boost?: boolean
  /** Badge Mandala Pro (abo + verified). */
  pro_verified?: boolean
  /** Accroche / modalités Pro (profil billing). */
  pro_tagline?: string | null
  pro_modalities?: string | null
  pro_service_area?: string | null
  pro_external_url?: string | null
  /** Lieu ayant endossé le badge. */
  pro_endorsement_place?: string | null
  /** Vues de fiche (propriétaire seulement, 30 j). */
  profile_views_30d?: number
  residence_city?: string
  residence_public?: boolean
  location_mode?: 'city' | 'address'
  residence_address?: string
  residence_postal_code?: string
  latitude?: number | null
  longitude?: number | null
  /** Libellés villes (affichage). */
  practice_locations?: string[]
  /** Détail lieux d’exercice pour la carte (GPS éventuel). */
  practice_places?: PracticePlace[]
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
      label VARCHAR(${MAX_SKILL_TAG_LABEL}) NOT NULL,
      label_key VARCHAR(${MAX_SKILL_TAG_LABEL}) NOT NULL,
      register VARCHAR(16) NOT NULL DEFAULT 'share',
      UNIQUE KEY uniq_user_label (user_id, label_key),
      KEY idx_label_key (label_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  await exec(
    pool,
    `ALTER TABLE ${tTags} MODIFY label VARCHAR(${MAX_SKILL_TAG_LABEL}) NOT NULL`
  )
  await exec(
    pool,
    `ALTER TABLE ${tTags} MODIFY label_key VARCHAR(${MAX_SKILL_TAG_LABEL}) NOT NULL`
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
  if (!existing.has('residence_city')) {
    await exec(pool, `ALTER TABLE ${tP} ADD COLUMN residence_city VARCHAR(120) NOT NULL DEFAULT ''`)
  }
  if (!existing.has('practice_locations_json')) {
    await exec(
      pool,
      `ALTER TABLE ${tP} ADD COLUMN practice_locations_json TEXT NULL`
    )
  }
  if (!existing.has('residence_public')) {
    await exec(
      pool,
      `ALTER TABLE ${tP} ADD COLUMN residence_public TINYINT(1) NOT NULL DEFAULT 1`
    )
  }
  if (!existing.has('location_mode')) {
    await exec(
      pool,
      `ALTER TABLE ${tP} ADD COLUMN location_mode VARCHAR(16) NOT NULL DEFAULT 'city'`
    )
  }
  if (!existing.has('residence_address')) {
    await exec(
      pool,
      `ALTER TABLE ${tP} ADD COLUMN residence_address VARCHAR(255) NOT NULL DEFAULT ''`
    )
  }
  if (!existing.has('residence_postal_code')) {
    await exec(
      pool,
      `ALTER TABLE ${tP} ADD COLUMN residence_postal_code VARCHAR(24) NOT NULL DEFAULT ''`
    )
  }
  if (!existing.has('latitude')) {
    await exec(pool, `ALTER TABLE ${tP} ADD COLUMN latitude DECIMAL(9,6) NULL`)
  }
  if (!existing.has('longitude')) {
    await exec(pool, `ALTER TABLE ${tP} ADD COLUMN longitude DECIMAL(9,6) NULL`)
  }
  const tViews = table('mandala_skill_profile_views')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${tViews} (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      subject_user_id INT NOT NULL,
      viewer_user_id INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_subject_created (subject_user_id, created_at),
      KEY idx_viewer_day (subject_user_id, viewer_user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  _ensured = true
}

function emptyProfile(userId: number): SkillProfile {
  return {
    user_id: userId,
    scope: 'hidden',
    offer_text: '',
    seek_text: '',
    frame_text: '',
    residence_city: '',
    residence_public: true,
    location_mode: 'city',
    residence_address: '',
    residence_postal_code: '',
    latitude: null,
    longitude: null,
    practice_locations: [],
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
    `SELECT user_id, scope, offer_text, seek_text, frame_text, residence_city,
            COALESCE(residence_public, 1) AS residence_public,
            COALESCE(location_mode, 'city') AS location_mode,
            COALESCE(residence_address, '') AS residence_address,
            COALESCE(residence_postal_code, '') AS residence_postal_code,
            latitude, longitude,
            practice_locations_json, updated_at
     FROM ${tP} WHERE user_id = ? LIMIT 1`,
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
        residence_city: normalizeCityLabel(r.residence_city),
        residence_public: Number(r.residence_public) !== 0,
        location_mode: (r.location_mode === 'address' ? 'address' : 'city') as
          | 'city'
          | 'address',
        residence_address: String(r.residence_address ?? '').trim().slice(0, 255),
        residence_postal_code: String(r.residence_postal_code ?? '')
          .replace(/\D/g, '')
          .slice(0, 10),
        latitude:
          r.latitude != null && Number.isFinite(Number(r.latitude))
            ? Number(r.latitude)
            : null,
        longitude:
          r.longitude != null && Number.isFinite(Number(r.longitude))
            ? Number(r.longitude)
            : null,
        practice_locations: practiceLocationsFromJson(r.practice_locations_json),
        updated_at: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
      }
    : emptyProfile(userId)

  const tPlaces = table('mandala_skill_profile_places')
  const tC = table('mandala_communities')
  const [placeRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name, c.logo_emoji, c.profile_public
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
  const rawProfile = r.profile_public
  const profilePublic =
    rawProfile == null || rawProfile === ''
      ? true
      : !(
          rawProfile === 0 ||
          rawProfile === false ||
          String(rawProfile).trim().toLowerCase() === '0' ||
          String(rawProfile).trim().toLowerCase() === 'false'
        )
  return {
    id: Number(r.id ?? r.community_id),
    slug: String(r.slug ?? ''),
    name: String(r.name ?? ''),
    logo_emoji: r.logo_emoji != null ? String(r.logo_emoji) : null,
    profile_public: profilePublic,
  }
}

export async function getMySkillProfile(userId: number): Promise<SkillProfile> {
  return loadProfile(userId)
}

export async function skillScopeOf(userId: number): Promise<SkillScope> {
  const profile = await loadProfile(userId)
  return profile.scope
}

export type SkillProfileInput = {
  scope: SkillScope
  offer_text: string
  seek_text: string
  frame_text: string
  residence_city?: string
  residence_public?: boolean
  location_mode?: 'city' | 'address'
  residence_address?: string
  residence_postal_code?: string
  latitude?: number | null
  longitude?: number | null
  /** Si true et mode address : recalcule lat/lng via Nominatim. */
  geocode?: boolean
  practice_locations?: Array<PracticePlace | string>
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

  let before: SkillProfile | null = null
  try {
    before = await loadProfile(userId)
  } catch {
    before = null
  }

  const tags: SkillTag[] = []
  const seen = new Set<string>()
  for (const raw of input.tags) {
    if (!isSkillRegister(raw.register)) continue
    const label = String(raw.label ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, MAX_SKILL_TAG_LABEL)
    const key = skillLabelKey(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    tags.push({ label, register: raw.register })
    if (tags.length >= MAX_SKILL_TAGS) break
  }

  const offer = input.offer_text.trim().slice(0, MAX_SKILL_TEXT)
  const seek = input.seek_text.trim().slice(0, MAX_SKILL_TEXT)
  const frame = input.frame_text.trim().slice(0, MAX_SKILL_TEXT)
  const residence = normalizeCityLabel(input.residence_city)
  const residencePublic =
    input.residence_public === undefined
      ? before?.residence_public !== false
      : Boolean(input.residence_public)
  const locationMode =
    input.location_mode === 'address' || input.location_mode === 'city'
      ? input.location_mode
      : before?.location_mode === 'address'
        ? 'address'
        : 'city'
  const residenceAddress = String(input.residence_address ?? before?.residence_address ?? '')
    .trim()
    .slice(0, 255)
  const residencePostal = String(
    input.residence_postal_code ?? before?.residence_postal_code ?? ''
  )
    .replace(/\D/g, '')
    .slice(0, 10)
  let latitude =
    input.latitude !== undefined
      ? input.latitude
      : before?.latitude ?? null
  let longitude =
    input.longitude !== undefined
      ? input.longitude
      : before?.longitude ?? null
  if (locationMode === 'city') {
    latitude = null
    longitude = null
  } else if (
    input.geocode ||
    (latitude == null && longitude == null && (residenceAddress || residence))
  ) {
    const hit = await geocodeAddress({
      address: residenceAddress || null,
      postal_code: residencePostal || null,
      city: residence || null,
      country: 'France',
    })
    if (hit) {
      latitude = hit.latitude
      longitude = hit.longitude
    }
  }
  let practice = normalizePracticePlaces(input.practice_locations)
  if (input.geocode) {
    const next: PracticePlace[] = []
    for (const place of practice) {
      if (place.mode !== 'address') {
        next.push({ ...place, latitude: null, longitude: null })
        continue
      }
      const hit = await geocodeAddress({
        address: place.address || null,
        postal_code: place.postal_code || null,
        city: place.city || null,
        country: 'France',
      })
      next.push({
        ...place,
        latitude: hit?.latitude ?? place.latitude,
        longitude: hit?.longitude ?? place.longitude,
      })
    }
    practice = next
  }
  const practiceJson = practiceLocationsToJson(practice)
  const pool = getPool()
  const tP = table('mandala_skill_profiles')
  await pool.execute(
    `INSERT INTO ${tP} (
       user_id, scope, offer_text, seek_text, frame_text, residence_city, residence_public,
       location_mode, residence_address, residence_postal_code, latitude, longitude, practice_locations_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE scope = VALUES(scope), offer_text = VALUES(offer_text),
       seek_text = VALUES(seek_text), frame_text = VALUES(frame_text),
       residence_city = VALUES(residence_city),
       residence_public = VALUES(residence_public),
       location_mode = VALUES(location_mode),
       residence_address = VALUES(residence_address),
       residence_postal_code = VALUES(residence_postal_code),
       latitude = VALUES(latitude),
       longitude = VALUES(longitude),
       practice_locations_json = VALUES(practice_locations_json)`,
    [
      userId,
      input.scope,
      offer,
      seek,
      frame,
      residence,
      residencePublic ? 1 : 0,
      locationMode,
      residenceAddress,
      residencePostal,
      latitude,
      longitude,
      practiceJson,
    ]
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

  const profile = await loadProfile(userId)

  const hasContent = Boolean(tags.length || offer || seek)
  const beforeHadContent = Boolean(
    before &&
      (before.tags.length || before.offer_text.trim() || before.seek_text.trim()) &&
      before.scope !== 'hidden'
  )
  const nowVisible = input.scope !== 'hidden' && hasContent
  const notifyPlaceIds =
    input.scope === 'places'
      ? placeIds
      : input.scope === 'mandala'
        ? mine.map((c) => c.id)
        : []
  if (nowVisible && !beforeHadContent && notifyPlaceIds.length) {
    void (async () => {
      try {
        const actor = await resolveActorLabel(userId)
        await notifyPlacesMembers({
          communityIds: notifyPlaceIds,
          actorUserId: userId,
          type: 'skill_profile',
          titleForPlace: (placeName) => `${actor} a rempli sa fiche compétences (${placeName})`,
          body: tags
            .slice(0, 5)
            .map((t) => t.label)
            .join(' · ') || offer.slice(0, 160) || null,
          actionUrl: 'mandala:skills',
          actionLabel: 'Voir les compétences',
          sourceType: 'mandala_skill_profile',
          sourceId: userId,
        })
      } catch {
        /* non bloquant */
      }
    })()
  }

  return profile
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
    residence_city:
      skillsVisible && profile.residence_public !== false ? profile.residence_city : '',
    residence_public: profile.residence_public !== false,
    location_mode: profile.location_mode,
    residence_address:
      skillsVisible && profile.residence_public !== false && profile.location_mode === 'address'
        ? profile.residence_address
        : '',
    latitude:
      skillsVisible && profile.residence_public !== false ? profile.latitude : null,
    longitude:
      skillsVisible && profile.residence_public !== false ? profile.longitude : null,
    practice_locations: skillsVisible ? practicePlaceLabels(profile.practice_locations) : [],
    practice_places: skillsVisible ? profile.practice_locations : [],
  }
}

function toPlaceRefs(
  rows: Array<{
    id: number
    slug: string
    name: string
    logo_emoji?: string | null
    profile_public?: boolean
  }>
): SkillPlaceRef[] {
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    logo_emoji: c.logo_emoji ?? null,
    profile_public: c.profile_public !== false,
  }))
}

async function readBio(userId: number): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${table('usermeta')} WHERE user_id = ? AND meta_key = 'mdl_bio' LIMIT 1`,
    [userId]
  )
  return String(rows[0]?.meta_value ?? '').trim()
}

async function readBiosForUsers(userIds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  const ids = [...new Set(userIds.filter((id) => id > 0))]
  if (!ids.length) return out
  const pool = getPool()
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, meta_value FROM ${table('usermeta')}
     WHERE meta_key = 'mdl_bio' AND user_id IN (${placeholders})`,
    ids
  )
  for (const row of rows ?? []) {
    const bio = String(row.meta_value ?? '').trim()
    if (bio) out.set(Number(row.user_id), bio)
  }
  return out
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

/** Fiche publique (scope mandala) pour SEO / partage. */
export async function getPublicSkillCard(subjectId: number): Promise<SkillCard | null> {
  if (!subjectId) return null
  const profile = await loadProfile(subjectId)
  if (profile.scope !== 'mandala') return null
  const identities = await displayIdentity([subjectId])
  const identity = identities.get(subjectId)
  if (!identity) return null
  const theirs = await listCommunitiesForUser(subjectId)
  const bio = await readBio(subjectId)
  const card = cardFromProfile(profile, identity, 0, toPlaceRefs(theirs), {
    bio,
    skillsVisible: true,
    resources: [],
  })
  const proFlags = await getProBoostFlagsForUsers([subjectId])
  applyProFlags(card, proFlags.get(subjectId))
  void recordSkillProfileView(subjectId, null).catch(() => {})
  return card
}

export async function getVisibleSkillCard(viewerId: number, subjectId: number): Promise<SkillCard | null> {
  const profile = await loadProfile(subjectId)
  const mine = await listCommunitiesForUser(viewerId)
  const viewerPlaceIds = new Set(mine.map((c) => c.id))
  const skillsVisible = await viewerCanSeeProfile(viewerId, profile, viewerPlaceIds)
  const theirs = await listCommunitiesForUser(subjectId)
  const shared = theirs.find((c) => viewerPlaceIds.has(c.id))
  const memberShares = viewerId !== subjectId && !!shared
  if (!skillsVisible && !memberShares && viewerId !== subjectId) return null
  const identities = await displayIdentity([subjectId])
  const identity = identities.get(subjectId) ?? {
    pseudo: `user_${subjectId}`,
    display_name: '',
    avatar_emoji: '🌸',
    avatar: null,
  }
  const places =
    profile.scope === 'mandala' && (skillsVisible || viewerId === subjectId)
      ? toPlaceRefs(theirs)
      : profile.places.filter((p) => viewerPlaceIds.has(p.id))
  const [bio, resources] = await Promise.all([
    skillsVisible || viewerId === subjectId ? readBio(subjectId) : readSharedBio(subjectId, viewerId),
    listVisibleResourcesByAuthor(viewerId, subjectId),
  ])
  const card = cardFromProfile(profile, identity, viewerId, places, {
    bio,
    skillsVisible,
    resources: resources.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      summary: r.summary,
    })),
  })
  card.shares_place = memberShares
  card.shared_place_slug = shared?.slug ?? null
  const proFlags = await getProBoostFlagsForUsers([subjectId])
  applyProFlags(card, proFlags.get(subjectId))
  if (viewerId > 0 && viewerId !== subjectId) {
    void recordSkillProfileView(subjectId, viewerId).catch(() => {})
  }
  if (viewerId === subjectId) {
    card.profile_views_30d = await countSkillProfileViews(subjectId, 30)
  }
  return card
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
  const proFlags = await getProBoostFlagsForUsers(userIds)
  const bios = await readBiosForUsers(userIds)
  const cards: SkillCard[] = []

  for (const userId of userIds) {
    const profile = await loadProfile(userId)
    if (profile.scope === 'hidden') continue
    if (tagKey && !profile.tags.some((t) => skillLabelKey(t.label) === tagKey)) continue
    const identity = identities.get(userId)
    if (!identity) continue
    const bio = bios.get(userId) ?? ''
    if (q) {
      const hay = [
        identity.pseudo,
        identity.display_name,
        profile.offer_text,
        profile.seek_text,
        profile.frame_text,
        bio,
        profile.residence_city,
        ...practicePlaceLabels(profile.practice_locations),
        ...profile.tags.map((t) => t.label),
        ...profile.places.map((p) => p.name),
      ]
        .join(' ')
        .toLocaleLowerCase('fr')
      if (!hay.includes(q)) continue
    }
    const memberships = await listCommunitiesForUser(userId)
    const shared = memberships.find((c) => viewerPlaceIds.has(c.id))
    const places = params.publicAccess
      ? toPlaceRefs(memberships.filter((c) => c.listed_public !== false))
      : params.view === 'mandala'
        ? toPlaceRefs(memberships)
        : profile.places.filter((p) => viewerPlaceIds.has(p.id))
    const card = cardFromProfile(profile, identity, params.viewerId, places, { bio })
    card.shares_place = params.viewerId !== userId && !!shared
    card.shared_place_slug = shared?.slug ?? null
    applyProFlags(card, proFlags.get(userId))
    cards.push(card)
  }

  cards.sort((a, b) =>
    compareSkillBoost(
      { proBoost: Boolean(a.pro_boost), label: a.display_name || a.pseudo },
      { proBoost: Boolean(b.pro_boost), label: b.display_name || b.pseudo }
    )
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
        `SELECT c.id, c.slug, c.name, c.logo_emoji, c.profile_public
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

/** Une vue par spectateur et par jour (évite le spam). */
export async function recordSkillProfileView(
  subjectUserId: number,
  viewerUserId: number | null
): Promise<void> {
  if (!isDbConfigured() || subjectUserId <= 0) return
  if (viewerUserId != null && viewerUserId === subjectUserId) return
  await ensureSkillTables()
  const pool = getPool()
  const tViews = table('mandala_skill_profile_views')
  if (viewerUserId != null && viewerUserId > 0) {
    const [dup] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${tViews}
       WHERE subject_user_id = ? AND viewer_user_id = ?
         AND created_at >= CURDATE()
       LIMIT 1`,
      [subjectUserId, viewerUserId]
    )
    if (dup[0]) return
  }
  await pool.execute(
    `INSERT INTO ${tViews} (subject_user_id, viewer_user_id) VALUES (?, ?)`,
    [subjectUserId, viewerUserId != null && viewerUserId > 0 ? viewerUserId : null]
  )
}

export async function countSkillProfileViews(
  subjectUserId: number,
  days = 30
): Promise<number> {
  if (!isDbConfigured() || subjectUserId <= 0) return 0
  await ensureSkillTables()
  const pool = getPool()
  const tViews = table('mandala_skill_profile_views')
  const d = Math.min(Math.max(days, 1), 365)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM ${tViews}
     WHERE subject_user_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [subjectUserId, d]
  )
  return Number(rows[0]?.n ?? 0) || 0
}

/** Préremplit l’offre compétences depuis le profil Pro (si vide). */
export async function seedSkillOfferFromPro(
  userId: number,
  fields: { tagline?: string; modalities?: string; service_area?: string }
): Promise<void> {
  if (!isDbConfigured() || userId <= 0) return
  await ensureSkillTables()
  const profile = await loadProfile(userId)
  if (profile.offer_text.trim()) return
  const parts = [fields.tagline, fields.modalities, fields.service_area]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
  if (!parts.length) return
  const offer = parts.join('\n\n').slice(0, MAX_SKILL_TEXT)
  const pool = getPool()
  const tP = table('mandala_skill_profiles')
  await pool.execute(
    `INSERT INTO ${tP} (user_id, scope, offer_text, seek_text, frame_text)
     VALUES (?, 'mandala', ?, '', '')
     ON DUPLICATE KEY UPDATE
       offer_text = IF(TRIM(offer_text) = '', VALUES(offer_text), offer_text),
       scope = IF(scope = 'hidden', 'mandala', scope)`,
    [userId, offer]
  )
}

/** Notifie un Pro qu’un membre a tenté un contact depuis l’annuaire. */
export async function notifyProSkillContact(opts: {
  proUserId: number
  fromUserId: number
  fromLabel: string
}): Promise<void> {
  if (opts.proUserId <= 0 || opts.fromUserId <= 0 || opts.proUserId === opts.fromUserId) {
    return
  }
  const flags = await getProBoostFlagsForUsers([opts.proUserId])
  const f = flags.get(opts.proUserId)
  if (!f?.proBoost) return
  await createNotification({
    type: 'skill_pro_lead',
    title: 'Nouveau contact sur votre fiche Pro',
    body: `${opts.fromLabel} vous a contacté depuis l’annuaire des compétences.`,
    action_url: '/app?page=skills',
    action_label: 'Voir l’annuaire',
    recipient_type: 'user',
    recipient_id: opts.proUserId,
    created_by: opts.fromUserId,
    priority: 'normal',
  })
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
  await pool.execute(
    `DELETE FROM ${table('mandala_skill_profile_views')} WHERE subject_user_id = ? OR viewer_user_id = ?`,
    [userId, userId]
  )
}
