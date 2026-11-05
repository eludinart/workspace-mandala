/**
 * Marqueurs carte annuaire : une personne × une position (ville ou GPS exact).
 * Résidence et exercice dans la même ville = un seul pin.
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
  kind: 'practice' | 'residence' | 'mandala_place'
  latitude: number
  longitude: number
  label: string
  user_id?: number
  display_name?: string
  avatar?: string | null
  avatar_emoji?: string | null
  pro_verified?: boolean
  community_id?: number
  community_slug?: string
  community_emoji?: string | null
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

function cityKey(label: string): string {
  return normalizeCityLabel(label).toLocaleLowerCase('fr')
}

/** Positions utiles pour une fiche : GPS exact prioritaire, sinon villes uniques. */
function locationsForCard(card: SkillCard): Array<{
  key: string
  kind: 'practice' | 'residence'
  label: string
  latitude?: number
  longitude?: number
}> {
  const out: Array<{
    key: string
    kind: 'practice' | 'residence'
    label: string
    latitude?: number
    longitude?: number
  }> = []
  const seen = new Set<string>()

  const lat = card.latitude
  const lng = card.longitude
  const hasExact =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)

  const residence =
    card.residence_public !== false ? normalizeCityLabel(card.residence_city) : ''
  const practices = (card.practice_locations ?? [])
    .map(normalizeCityLabel)
    .filter(Boolean)

  if (hasExact) {
    const label = residence || practices[0] || 'Position'
    const key = `exact:${card.user_id}`
    out.push({
      key,
      kind: residence ? 'residence' : 'practice',
      label,
      latitude: Number(lat),
      longitude: Number(lng),
    })
    seen.add(cityKey(label))
    // Autres lieux d’exercice distincts de la résidence exacte
    for (const city of practices) {
      const k = cityKey(city)
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ key: `practice:${k}`, kind: 'practice', label: city })
    }
    return out
  }

  for (const city of practices) {
    const k = cityKey(city)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ key: `practice:${k}`, kind: 'practice', label: city })
  }
  if (residence) {
    const k = cityKey(residence)
    if (!seen.has(k)) {
      seen.add(k)
      out.push({ key: `residence:${k}`, kind: 'residence', label: residence })
    }
  }
  return out
}

export async function listAnnuaireMapMarkers(opts?: {
  audience?: AnnuaireAudience
  communitySlug?: string | null
  /** Membre connecté : voir aussi les fiches limitées au lieu (scope places). */
  viewerId?: number
  publicAccess?: boolean
}): Promise<AnnuaireMapMarker[]> {
  const audience = opts?.audience ?? 'all'
  const slug = (opts?.communitySlug ?? '').trim()
  const viewerId = opts?.viewerId && opts.viewerId > 0 ? opts.viewerId : 0
  const publicAccess = opts?.publicAccess ?? true
  let communityId: number | null = null
  if (slug && isDbConfigured()) {
    const pool = getPool()
    const [rows] = await pool.execute<RowDataPacket[]>(
      publicAccess
        ? `SELECT id FROM ${table('mandala_communities')}
           WHERE slug = ? AND is_active = 1 AND COALESCE(listed_public, 1) = 1
           LIMIT 1`
        : `SELECT id FROM ${table('mandala_communities')}
           WHERE slug = ? AND is_active = 1
           LIMIT 1`,
      [slug]
    )
    communityId = rows[0] ? Number(rows[0].id) : null
    if (!communityId) return []
  }

  const cards = filterByAudience(
    await listSkillDirectory({
      viewerId,
      view: slug ? 'place' : 'mandala',
      communityId,
      publicAccess: slug ? publicAccess : true,
    }),
    audience
  )

  const cityLabels = new Set<string>()
  const communityIds = new Set<number>()
  const planned = new Map<number, ReturnType<typeof locationsForCard>>()

  for (const card of cards) {
    const locs = locationsForCard(card)
    planned.set(card.user_id, locs)
    for (const loc of locs) {
      if (loc.latitude == null || loc.longitude == null) cityLabels.add(loc.label)
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
    const base = {
      user_id: card.user_id,
      display_name: card.display_name || card.pseudo,
      avatar: card.avatar ?? null,
      avatar_emoji: card.avatar_emoji ?? null,
      pro_verified: Boolean(card.pro_verified),
      place_names: placeNames,
    }
    for (const loc of planned.get(card.user_id) ?? []) {
      let latitude = loc.latitude
      let longitude = loc.longitude
      if (latitude == null || longitude == null) {
        const coords = cityCoords.get(cityKey(loc.label))
        if (!coords) continue
        latitude = coords.latitude
        longitude = coords.longitude
      }
      markers.push({
        id: `person:${card.user_id}:${loc.key}`,
        kind: loc.kind,
        latitude,
        longitude,
        label: loc.label,
        ...base,
      })
    }
  }

  return markers
}
