/** Normalisation des villes de résidence / lieux d’exercice (annuaire). */

export const MAX_PRACTICE_LOCATIONS = 8
export const MAX_CITY_LEN = 120

export type PracticePlaceMode = 'city' | 'address'

/** Un lieu d’exercice : centre-ville ou adresse exacte (GPS). */
export type PracticePlace = {
  city: string
  mode: PracticePlaceMode
  address: string
  postal_code: string
  latitude: number | null
  longitude: number | null
}

/** Extrait un code postal FR (5 chiffres) éventuellement collé à la ville. */
export function parseCityAndPostal(raw: unknown): {
  city: string
  postal_code: string | null
} {
  let s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!s) return { city: '', postal_code: null }

  let postal_code: string | null = null
  const leading = s.match(/^(\d{5})\s+(.+)$/)
  if (leading) {
    postal_code = leading[1]
    s = leading[2]
  } else {
    const trailing = s.match(/^(.+?)(?:\s*[,(]\s*|\s+)(\d{5})\)?\s*$/)
    if (trailing && !/^\d+$/.test(trailing[1].trim())) {
      s = trailing[1].replace(/[,(]\s*$/, '').trim()
      postal_code = trailing[2]
    }
  }

  return {
    city: s.slice(0, MAX_CITY_LEN),
    postal_code,
  }
}

/** Libellé ville sans code postal (Nominatim échoue si le CP est dans `city`). */
export function normalizeCityLabel(raw: unknown): string {
  return parseCityAndPostal(raw).city
}

function parseCoord(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function emptyPlace(city: string, postal?: string | null): PracticePlace {
  return {
    city,
    mode: 'city',
    address: '',
    postal_code: (postal ?? '').replace(/\D/g, '').slice(0, 10),
    latitude: null,
    longitude: null,
  }
}

/** Normalise une entrée (string legacy ou objet). */
export function normalizePracticePlace(raw: unknown): PracticePlace | null {
  if (raw == null) return null
  if (typeof raw === 'string' || typeof raw === 'number') {
    const { city, postal_code } = parseCityAndPostal(raw)
    if (!city) return null
    return emptyPlace(city, postal_code)
  }
  if (typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const { city, postal_code: fromLabel } = parseCityAndPostal(o.city ?? o.label ?? '')
  if (!city) return null
  const mode: PracticePlaceMode = o.mode === 'address' ? 'address' : 'city'
  const address = String(o.address ?? o.residence_address ?? '')
    .trim()
    .slice(0, 255)
  const postal_code = String(o.postal_code ?? o.residence_postal_code ?? fromLabel ?? '')
    .replace(/\D/g, '')
    .slice(0, 10)
  let latitude = parseCoord(o.latitude)
  let longitude = parseCoord(o.longitude)
  if (mode === 'city') {
    latitude = null
    longitude = null
  }
  return { city, mode, address, postal_code, latitude, longitude }
}

/** Liste dédupliquée par ville (insensible à la casse FR), max N. */
export function normalizePracticePlaces(raw: unknown): PracticePlace[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed : raw.split(/[,;\n]/)
          } catch {
            return raw.split(/[,;\n]/)
          }
        })()
      : []
  const out: PracticePlace[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const place = normalizePracticePlace(item)
    if (!place) continue
    const key = place.city.toLocaleLowerCase('fr')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(place)
    if (out.length >= MAX_PRACTICE_LOCATIONS) break
  }
  return out
}

/** @deprecated préférer normalizePracticePlaces — libellés ville seuls. */
export function normalizePracticeLocations(raw: unknown): string[] {
  return normalizePracticePlaces(raw).map((p) => p.city)
}

export function practiceLocationsToJson(list: PracticePlace[] | string[]): string {
  return JSON.stringify(normalizePracticePlaces(list))
}

export function practiceLocationsFromJson(raw: unknown): PracticePlace[] {
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) return normalizePracticePlaces(raw)
  return normalizePracticePlaces(String(raw))
}

/** Libellés ville pour affichage / recherche. */
export function practicePlaceLabels(places: PracticePlace[]): string[] {
  return places.map((p) => p.city)
}
