/**
 * Porte `carte_membres` — opt-in carte + pins multi-lieux (skills / fallback ville).
 */
import type { RowDataPacket } from 'mysql2'
import type { AnnuaireMapMarker } from '@/lib/annuaire-map'
import {
  cityKey,
  locationsForMapSource,
  type PersonMapLocation,
} from '@/lib/annuaire-map-locations'
import { getPool, isDbConfigured, table } from '@/lib/db'
import { getProBoostFlagsForUsers } from '@/lib/db-billing'
import { resolveCitiesCoords } from '@/lib/geo-city-cache'
import { normalizeCityLabel, practiceLocationsFromJson } from '@/lib/practice-locations'

const META_CITY = 'mdl_member_city'
const META_ON_MAP = 'mdl_member_city_on_map'
const META_PROMPT = 'mdl_member_city_prompt_done'

async function getMeta(userId: number, key: string): Promise<string | null> {
  const pool = getPool()
  const t = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${t} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, key]
  )
  return rows[0]?.meta_value != null ? String(rows[0].meta_value) : null
}

async function setMeta(userId: number, key: string, value: string): Promise<void> {
  const pool = getPool()
  const t = table('usermeta')
  await pool.execute(
    `INSERT INTO ${t} (user_id, meta_key, meta_value)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
    [userId, key, value]
  )
}

export type MemberCityProfile = {
  city: string
  show_on_map: boolean
  prompt_done: boolean
}

export async function getMemberCityProfile(userId: number): Promise<MemberCityProfile> {
  if (!isDbConfigured() || userId <= 0) {
    return { city: '', show_on_map: false, prompt_done: false }
  }
  const [city, onMap, prompt] = await Promise.all([
    getMeta(userId, META_CITY),
    getMeta(userId, META_ON_MAP),
    getMeta(userId, META_PROMPT),
  ])
  return {
    city: city ? normalizeCityLabel(city) : '',
    show_on_map: onMap === '1',
    prompt_done: prompt === '1',
  }
}

export async function saveMemberCityProfile(
  userId: number,
  input: { city?: string; show_on_map?: boolean; skip_prompt?: boolean }
): Promise<MemberCityProfile> {
  if (!isDbConfigured() || userId <= 0) throw new Error('Utilisateur invalide')
  if (input.city !== undefined) {
    await setMeta(userId, META_CITY, normalizeCityLabel(input.city))
  }
  if (input.show_on_map !== undefined) {
    await setMeta(userId, META_ON_MAP, input.show_on_map ? '1' : '0')
  }
  if (input.skip_prompt || input.city !== undefined || input.show_on_map !== undefined) {
    await setMeta(userId, META_PROMPT, '1')
  }
  return getMemberCityProfile(userId)
}

export type MemberMapPin = {
  user_id: number
  display_name: string
  avatar: string | null
  avatar_emoji: string | null
  pro_verified: boolean
  city: string
  latitude: number
  longitude: number
}

type OptedInMember = {
  user_id: number
  display_name: string
  avatar: string | null
  avatar_emoji: string
  fallback_city: string
}

type SkillGeoRow = {
  practice_locations: ReturnType<typeof practiceLocationsFromJson>
  residence_city: string
  residence_public: boolean
  location_mode: 'city' | 'address'
  latitude: number | null
  longitude: number | null
}

async function loadOptedInMembers(communityId: number): Promise<OptedInMember[]> {
  const pool = getPool()
  const tM = table('mandala_community_members')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT m.user_id,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', m.user_id)) AS display_name,
            COALESCE(av.meta_value, '') AS avatar,
            COALESCE(em.meta_value, '🌸') AS avatar_emoji,
            COALESCE(city.meta_value, '') AS city
     FROM ${tM} m
     JOIN ${tUsers} u ON u.ID = m.user_id
     JOIN ${tMeta} onmap ON onmap.user_id = m.user_id AND onmap.meta_key = ? AND onmap.meta_value = '1'
     LEFT JOIN ${tMeta} city ON city.user_id = m.user_id AND city.meta_key = ?
     LEFT JOIN ${tMeta} p ON p.user_id = m.user_id AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} av ON av.user_id = m.user_id AND av.meta_key = 'mdl_avatar'
     LEFT JOIN ${tMeta} em ON em.user_id = m.user_id AND em.meta_key = 'mdl_avatar_emoji'
     WHERE m.community_id = ?`,
    [META_ON_MAP, META_CITY, communityId]
  )

  return (rows ?? []).map((r) => {
    const avatarRaw = String(r.avatar ?? '').trim()
    return {
      user_id: Number(r.user_id),
      display_name: String(r.display_name || `user_${r.user_id}`),
      avatar: avatarRaw || null,
      avatar_emoji: String(r.avatar_emoji || '🌸'),
      fallback_city: normalizeCityLabel(String(r.city ?? '')),
    }
  })
}

async function loadSkillGeoForUsers(userIds: number[]): Promise<Map<number, SkillGeoRow>> {
  const map = new Map<number, SkillGeoRow>()
  if (!userIds.length) return map
  const pool = getPool()
  const tP = table('mandala_skill_profiles')
  const placeholders = userIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, residence_city,
            COALESCE(residence_public, 1) AS residence_public,
            COALESCE(location_mode, 'city') AS location_mode,
            latitude, longitude, practice_locations_json
     FROM ${tP}
     WHERE user_id IN (${placeholders})`,
    userIds
  )
  for (const r of rows ?? []) {
    map.set(Number(r.user_id), {
      practice_locations: practiceLocationsFromJson(r.practice_locations_json),
      residence_city: normalizeCityLabel(r.residence_city),
      residence_public: Number(r.residence_public) !== 0,
      location_mode: r.location_mode === 'address' ? 'address' : 'city',
      latitude:
        r.latitude != null && Number.isFinite(Number(r.latitude)) ? Number(r.latitude) : null,
      longitude:
        r.longitude != null && Number.isFinite(Number(r.longitude))
          ? Number(r.longitude)
          : null,
    })
  }
  return map
}

function locationsForMember(
  member: OptedInMember,
  skill: SkillGeoRow | undefined
): PersonMapLocation[] {
  if (skill) {
    const fromSkills = locationsForMapSource({
      practice_places: skill.practice_locations,
      residence_city: skill.residence_city,
      residence_public: skill.residence_public,
      location_mode: skill.location_mode,
      latitude: skill.latitude,
      longitude: skill.longitude,
    })
    if (fromSkills.length) return fromSkills
  }
  if (!member.fallback_city) return []
  const k = cityKey(member.fallback_city)
  return [
    {
      key: `fallback:${k}`,
      kind: 'residence',
      label: member.fallback_city,
    },
  ]
}

/** Marqueurs multi-lieux des membres opt-in d’un lieu (format annuaire). */
export async function listCommunityMemberMapMarkers(
  communityId: number
): Promise<AnnuaireMapMarker[]> {
  if (!isDbConfigured() || communityId <= 0) return []

  const members = await loadOptedInMembers(communityId)
  if (!members.length) return []

  const skillByUser = await loadSkillGeoForUsers(members.map((m) => m.user_id))
  const planned = new Map<number, PersonMapLocation[]>()
  const cityLabels = new Set<string>()

  for (const member of members) {
    const locs = locationsForMember(member, skillByUser.get(member.user_id))
    planned.set(member.user_id, locs)
    for (const loc of locs) {
      if (loc.latitude == null || loc.longitude == null) cityLabels.add(loc.label)
    }
  }

  const [cityCoords, flags] = await Promise.all([
    resolveCitiesCoords([...cityLabels]),
    getProBoostFlagsForUsers(members.map((m) => m.user_id)),
  ])

  const markers: AnnuaireMapMarker[] = []
  for (const member of members) {
    const f = flags.get(member.user_id)
    const pro_verified = Boolean(f?.proBoost && f?.proVerified)
    const base = {
      user_id: member.user_id,
      display_name: member.display_name,
      avatar: member.avatar,
      avatar_emoji: member.avatar_emoji,
      pro_verified,
    }
    for (const loc of planned.get(member.user_id) ?? []) {
      let latitude = loc.latitude
      let longitude = loc.longitude
      if (latitude == null || longitude == null) {
        const coords = cityCoords.get(cityKey(loc.label))
        if (!coords) continue
        latitude = coords.latitude
        longitude = coords.longitude
      }
      markers.push({
        id: `person:${member.user_id}:${loc.key}`,
        kind: loc.kind,
        latitude,
        longitude,
        label: loc.label,
        ...base,
      })
    }
  }

  return markers.sort((a, b) => {
    if (Boolean(a.pro_verified) !== Boolean(b.pro_verified)) {
      return a.pro_verified ? -1 : 1
    }
    const nameA = a.display_name || ''
    const nameB = b.display_name || ''
    const byName = nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' })
    if (byName !== 0) return byName
    return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
  })
}

/**
 * Pins mono-ville (compat) : 1er marqueur résolu par personne.
 * Préférer `listCommunityMemberMapMarkers` pour l’UI.
 */
export async function listCommunityMemberMapPins(
  communityId: number
): Promise<MemberMapPin[]> {
  const markers = await listCommunityMemberMapMarkers(communityId)
  const byUser = new Map<number, MemberMapPin>()
  for (const m of markers) {
    const uid = m.user_id ?? 0
    if (!uid || byUser.has(uid)) continue
    byUser.set(uid, {
      user_id: uid,
      display_name: m.display_name || `user_${uid}`,
      avatar: m.avatar ?? null,
      avatar_emoji: m.avatar_emoji ?? '🌸',
      pro_verified: Boolean(m.pro_verified),
      city: m.label,
      latitude: m.latitude,
      longitude: m.longitude,
    })
  }
  return [...byUser.values()]
}

/** Exposé pour tests unitaires (opt-in + skills → lieux). */
export function planMemberMapLocationsForTest(
  member: OptedInMember,
  skill: SkillGeoRow | undefined
): PersonMapLocation[] {
  return locationsForMember(member, skill)
}
