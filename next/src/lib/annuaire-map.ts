/**
 * Marqueurs carte annuaire : pins exercice + pins lieux Mandala.
 */
import { getPool, isDbConfigured, table } from '@/lib/db'
import type { SkillCard } from '@/lib/db-skills'
import { listSkillDirectory } from '@/lib/db-skills'
import { resolveCitiesCoords } from '@/lib/geo-city-cache'
import { normalizeCityLabel } from '@/lib/practice-locations'
import type { RowDataPacket } from 'mysql2'

export type AnnuaireAudience = 'all' | 'pro' | 'members'

export type AnnuaireMapMarker = {
  id: string
  kind: 'practice' | 'mandala_place'
  latitude: number
  longitude: number
  label: string
  user_id?: number
  display_name?: string
  pro_verified?: boolean
  community_id?: number
  community_slug?: string
  community_emoji?: string | null
  /** Lieux Mandala rattachés à la personne (pour tooltip pin exercice). */
  place_names?: string[]
}

function filterByAudience(cards: SkillCard[], audience: AnnuaireAudience): SkillCard[] {
  if (audience === 'pro') return cards.filter((c) => Boolean(c.pro_verified))
  if (audience === 'members') return cards.filter((c) => !c.pro_verified)
  return cards
}

async function loadCommunityCoords(
  ids: number[]
): Promise<Map<number, { lat: number; lng: number; slug: string; name: string; emoji: string | null }>> {
  const map = new Map<
    number,
    { lat: number; lng: number; slug: string; name: string; emoji: string | null }
  >()
  if (!ids.length || !isDbConfigured()) return map
  const pool = getPool()
  const t = table('mandala_communities')
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, slug, name, logo_emoji, latitude, longitude
     FROM ${t}
     WHERE id IN (${placeholders}) AND is_active = 1
       AND latitude IS NOT NULL AND longitude IS NOT NULL`,
    ids
  )
  for (const r of rows ?? []) {
    const lat = Number(r.latitude)
    const lng = Number(r.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    map.set(Number(r.id), {
      lat,
      lng,
      slug: String(r.slug),
      name: String(r.name),
      emoji: r.logo_emoji != null ? String(r.logo_emoji) : null,
    })
  }
  return map
}

export async function listAnnuaireMapMarkers(opts?: {
  audience?: AnnuaireAudience
  communitySlug?: string | null
}): Promise<AnnuaireMapMarker[]> {
  const audience = opts?.audience ?? 'all'
  const slug = (opts?.communitySlug ?? '').trim()
  let communityId: number | null = null
  if (slug && isDbConfigured()) {
    const pool = getPool()
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${table('mandala_communities')} WHERE slug = ? AND is_active = 1 LIMIT 1`,
      [slug]
    )
    communityId = rows[0] ? Number(rows[0].id) : null
    if (!communityId) return []
  }

  const cards = filterByAudience(
    await listSkillDirectory({
      viewerId: 0,
      view: slug ? 'place' : 'mandala',
      communityId,
      publicAccess: true,
    }),
    audience
  )

  const cityLabels = new Set<string>()
  const communityIds = new Set<number>()
  for (const card of cards) {
    for (const city of card.practice_locations ?? []) {
      const c = normalizeCityLabel(city)
      if (c) cityLabels.add(c)
    }
    for (const p of card.places ?? []) {
      if (p.id > 0) communityIds.add(p.id)
    }
  }

  const [cityCoords, placeCoords] = await Promise.all([
    resolveCitiesCoords([...cityLabels]),
    loadCommunityCoords([...communityIds]),
  ])

  const markers: AnnuaireMapMarker[] = []
  const seenPlace = new Set<number>()

  for (const card of cards) {
    const placeNames = (card.places ?? []).map((p) => p.name).filter(Boolean)
    for (const city of card.practice_locations ?? []) {
      const label = normalizeCityLabel(city)
      if (!label) continue
      const coords = cityCoords.get(label.toLocaleLowerCase('fr'))
      if (!coords) continue
      markers.push({
        id: `practice:${card.user_id}:${label.toLocaleLowerCase('fr')}`,
        kind: 'practice',
        latitude: coords.latitude,
        longitude: coords.longitude,
        label,
        user_id: card.user_id,
        display_name: card.display_name || card.pseudo,
        pro_verified: Boolean(card.pro_verified),
        place_names: placeNames,
      })
    }
    for (const p of card.places ?? []) {
      if (seenPlace.has(p.id)) continue
      const geo = placeCoords.get(p.id)
      if (!geo) continue
      seenPlace.add(p.id)
      markers.push({
        id: `place:${p.id}`,
        kind: 'mandala_place',
        latitude: geo.lat,
        longitude: geo.lng,
        label: geo.name,
        community_id: p.id,
        community_slug: geo.slug,
        community_emoji: geo.emoji,
      })
    }
  }

  return markers
}
