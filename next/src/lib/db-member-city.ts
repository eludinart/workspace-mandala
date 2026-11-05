/**
 * Porte `carte_membres` — ville une fois + affichage optionnel sur la carte du lieu.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'
import { getProBoostFlagsForUsers } from '@/lib/db-billing'
import { normalizeCityLabel } from '@/lib/practice-locations'
import { resolveCityCoords } from '@/lib/geo-city-cache'

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

/** Pins des membres d’un lieu qui ont accepté d’apparaître. */
export async function listCommunityMemberMapPins(
  communityId: number
): Promise<MemberMapPin[]> {
  if (!isDbConfigured() || communityId <= 0) return []
  const pool = getPool()
  const tM = table('mandala_community_members')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT m.user_id,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', m.user_id)) AS display_name,
            COALESCE(av.meta_value, '') AS avatar,
            COALESCE(em.meta_value, '🌸') AS avatar_emoji,
            city.meta_value AS city
     FROM ${tM} m
     JOIN ${tUsers} u ON u.ID = m.user_id
     JOIN ${tMeta} onmap ON onmap.user_id = m.user_id AND onmap.meta_key = ? AND onmap.meta_value = '1'
     JOIN ${tMeta} city ON city.user_id = m.user_id AND city.meta_key = ? AND city.meta_value <> ''
     LEFT JOIN ${tMeta} p ON p.user_id = m.user_id AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} av ON av.user_id = m.user_id AND av.meta_key = 'mdl_avatar'
     LEFT JOIN ${tMeta} em ON em.user_id = m.user_id AND em.meta_key = 'mdl_avatar_emoji'
     WHERE m.community_id = ?`,
    [META_ON_MAP, META_CITY, communityId]
  )

  const draft: Array<Omit<MemberMapPin, 'pro_verified'> & { user_id: number }> = []
  for (const r of rows ?? []) {
    const city = normalizeCityLabel(String(r.city ?? ''))
    if (!city) continue
    const coords = await resolveCityCoords(city)
    if (!coords) continue
    const avatarRaw = String(r.avatar ?? '').trim()
    draft.push({
      user_id: Number(r.user_id),
      display_name: String(r.display_name || `user_${r.user_id}`),
      avatar: avatarRaw || null,
      avatar_emoji: String(r.avatar_emoji || '🌸'),
      city,
      latitude: coords.latitude,
      longitude: coords.longitude,
    })
  }
  const flags = await getProBoostFlagsForUsers(draft.map((p) => p.user_id))
  return draft
    .map((p) => {
      const f = flags.get(p.user_id)
      return {
        ...p,
        pro_verified: Boolean(f?.proBoost && f?.proVerified),
      }
    })
    .sort((a, b) => {
      if (a.pro_verified !== b.pro_verified) return a.pro_verified ? -1 : 1
      return a.display_name.localeCompare(b.display_name, 'fr', { sensitivity: 'base' })
    })
}
