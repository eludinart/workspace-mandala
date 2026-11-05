/**
 * Marqueurs carte annuaire : pins sur les lieux d’exercice (+ résidence si distincte).
 * GPS exact si adresse saisie, sinon centre-ville.
 */
import { getPool, isDbConfigured, table } from '@/lib/db'
import type { SkillCard } from '@/lib/db-skills'
import { listSkillDirectory } from '@/lib/db-skills'
import { resolveCitiesCoords } from '@/lib/geo-city-cache'
import { normalizeCityLabel, type PracticePlace } from '@/lib/practice-locations'
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

function practicePlacesFromCard(card: SkillCard): PracticePlace[] {
  if (card.practice_places?.length) return card.practice_places
  return (card.practice_locations ?? [])
    .map((city) => normalizeCityLabel(city))
    .filter(Boolean)
    .map((city) => ({
      city,
      mode: 'city' as const,
      address: '',
      postal_code: '',
      latitude: null,
      longitude: null,
    }))
}

/**
 * Pins : chaque lieu d’exercice ; résidence uniquement si publique et ville différente.
 */
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

  for (const place of practicePlacesFromCard(card)) {
    const label = normalizeCityLabel(place.city)
    if (!label) continue
    const k = cityKey(label)
    if (seen.has(k)) continue
    seen.add(k)
    const hasExact =
      place.mode === 'address' &&
      place.latitude != null &&
      place.longitude != null &&
      Number.isFinite(place.latitude) &&
      Number.isFinite(place.longitude)
    out.push({
      key: `practice:${k}`,
      kind: 'practice',
      label,
      ...(hasExact
        ? { latitude: Number(place.latitude), longitude: Number(place.longitude) }
        : {}),
    })
  }

  const residence =
    card.residence_public !== false ? normalizeCityLabel(card.residence_city) : ''
  if (residence) {
    const k = cityKey(residence)
    if (!seen.has(k)) {
      seen.add(k)
      const hasExact =
        card.location_mode === 'address' &&
        card.latitude != null &&
        card.longitude != null &&
        Number.isFinite(card.latitude) &&
        Number.isFinite(card.longitude)
      out.push({
        key: `residence:${k}`,
        kind: 'residence',
        label: residence,
        ...(hasExact
          ? { latitude: Number(card.latitude), longitude: Number(card.longitude) }
          : {}),
      })
    }
  }

  return out
}

export async function listAnnuaireMapMarkers(opts?: {
  audience?: AnnuaireAudience
  communitySlug?: string | null
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
