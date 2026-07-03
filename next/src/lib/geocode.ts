/**
 * Géocodage d'adresses via Nominatim (OpenStreetMap).
 *
 * Usage strictement côté serveur. Respecte la politique Nominatim :
 *   - User-Agent identifiant l'application
 *   - Volume faible (déclenché uniquement lors de l'enregistrement d'un lieu)
 *
 * Un service self-hosted peut être configuré via NOMINATIM_BASE_URL.
 */

export type GeocodeInput = {
  address?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string | null
}

export type GeocodeResult = {
  latitude: number
  longitude: number
  display_name: string
}

const NOMINATIM_BASE =
  (process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '')

const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ?? 'MandalaApp/1.0 (lieux & communautés francophones)'

function hasAnyAddressPart(input: GeocodeInput): boolean {
  return !!(input.address || input.postal_code || input.city || input.country)
}

/**
 * Résout des coordonnées à partir d'une adresse structurée.
 * Retourne null si l'adresse est vide ou introuvable (pas d'exception bloquante).
 */
export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeResult | null> {
  if (!hasAnyAddressPart(input)) return null

  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    addressdetails: '0',
  })
  if (input.address) params.set('street', String(input.address).trim())
  if (input.city) params.set('city', String(input.city).trim())
  if (input.postal_code) params.set('postalcode', String(input.postal_code).trim())
  params.set('country', input.country ? String(input.country).trim() : 'France')

  const url = `${NOMINATIM_BASE}/search?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'fr',
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
    const hit = Array.isArray(data) ? data[0] : null
    if (!hit?.lat || !hit?.lon) return null
    const latitude = Number(hit.lat)
    const longitude = Number(hit.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return { latitude, longitude, display_name: String(hit.display_name ?? '') }
  } catch {
    return null
  }
}
