/**
 * Marqueurs carte annuaire : pins personnes × ville d’exercice uniquement.
 * Les lieux Mandala suivent la même visibilité que le mur (`listed_public`).
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
  /** Lieux Mandala listés publics rattachés (tooltip pin exercice). */
  place_names?: string[]
}

function filterByAudience(cards: SkillCard[], audience: AnnuaireAudience): SkillCard[] {
  if (audience === 'pro') return cards.filter((c) => Boolean(c.pro_verified))
  if (audience === 'members') return cards.filter((c) => !c.pro_verified)
  return cards
}

async function loadListedPlaceNames(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (!ids.length || !isDbConfigured()) return map
  const pool = getPool()
  const t = table('mandala_communities')
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, name
     FROM ${t}
     WHERE id IN (${placeholders}) AND is_active = 1
       AND COALESCE(listed_public, 1) = 1`,
    ids
  )
  for (const r of rows ?? []) {
    map.set(Number(r.id), String(r.name))
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
      `SELECT id FROM ${table('mandala_communities')}
       WHERE slug = ? AND is_active = 1 AND COALESCE(listed_public, 1) = 1
       LIMIT 1`,
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

  const [cityCoords, listedPlaces] = await Promise.all([
    resolveCitiesCoords([...cityLabels]),
    loadListedPlaceNames([...communityIds]),
  ])

  const markers: AnnuaireMapMarker[] = []

  for (const card of cards) {
    const placeNames = (card.places ?? [])
      .map((p) => listedPlaces.get(p.id))
      .filter((name): name is string => Boolean(name))
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
  }

  return markers
}
