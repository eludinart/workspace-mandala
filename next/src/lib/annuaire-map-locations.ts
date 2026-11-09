/**
 * Lieux géo pour pins carte (annuaire + membres) :
 * chaque lieu d’exercice ; résidence uniquement si publique et ville distincte.
 */
import { normalizeCityLabel, type PracticePlace } from '@/lib/practice-locations'

export type MapLocationSource = {
  practice_places?: PracticePlace[]
  practice_locations?: string[]
  residence_city?: string
  residence_public?: boolean
  location_mode?: 'city' | 'address'
  latitude?: number | null
  longitude?: number | null
}

export type PersonMapLocation = {
  key: string
  kind: 'practice' | 'residence'
  label: string
  latitude?: number
  longitude?: number
}

export function cityKey(label: string): string {
  return normalizeCityLabel(label).toLocaleLowerCase('fr')
}

function practicePlacesFromSource(source: MapLocationSource): PracticePlace[] {
  if (source.practice_places?.length) return source.practice_places
  return (source.practice_locations ?? [])
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

export function locationsForMapSource(source: MapLocationSource): PersonMapLocation[] {
  const out: PersonMapLocation[] = []
  const seen = new Set<string>()

  for (const place of practicePlacesFromSource(source)) {
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
    source.residence_public !== false ? normalizeCityLabel(source.residence_city) : ''
  if (residence) {
    const k = cityKey(residence)
    if (!seen.has(k)) {
      seen.add(k)
      const hasExact =
        source.location_mode === 'address' &&
        source.latitude != null &&
        source.longitude != null &&
        Number.isFinite(source.latitude) &&
        Number.isFinite(source.longitude)
      out.push({
        key: `residence:${k}`,
        kind: 'residence',
        label: residence,
        ...(hasExact
          ? { latitude: Number(source.latitude), longitude: Number(source.longitude) }
          : {}),
      })
    }
  }

  return out
}
