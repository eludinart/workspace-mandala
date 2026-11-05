/**
 * Lookup communes FR par code postal (geo.api.gouv.fr) + cache coords.
 */
import { normalizeCityLabel } from '@/lib/practice-locations'
import { rememberCityCoords, type CityCoords } from '@/lib/geo-city-cache'

export type PostalCityOption = {
  city: string
  postal_code: string
  insee_code: string
  latitude: number
  longitude: number
}

type GouvCommune = {
  nom?: string
  code?: string
  codesPostaux?: string[]
  centre?: { type?: string; coordinates?: [number, number] }
}

function isFrPostal(code: string): boolean {
  return /^\d{5}$/.test(code)
}

/** Communes rattachées à un code postal FR, avec centre pour la carte. */
export async function lookupCitiesByPostalCode(
  rawPostal: string
): Promise<PostalCityOption[]> {
  const postal_code = String(rawPostal ?? '').replace(/\s+/g, '').trim()
  if (!isFrPostal(postal_code)) return []

  const url =
    `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(postal_code)}` +
    `&fields=nom,code,codesPostaux,centre&format=json`

  let rows: GouvCommune[] = []
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as unknown
    rows = Array.isArray(data) ? (data as GouvCommune[]) : []
  } catch {
    return []
  }

  const out: PostalCityOption[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const city = normalizeCityLabel(row.nom)
    if (!city) continue
    const key = city.toLocaleLowerCase('fr')
    if (seen.has(key)) continue
    const coords = row.centre?.coordinates
    if (!coords || coords.length < 2) continue
    const longitude = Number(coords[0])
    const latitude = Number(coords[1])
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    seen.add(key)
    out.push({
      city,
      postal_code,
      insee_code: String(row.code ?? ''),
      latitude,
      longitude,
    })
    await rememberCityCoords({ city, latitude, longitude })
  }

  out.sort((a, b) => a.city.localeCompare(b.city, 'fr'))
  return out
}

export type { CityCoords }
