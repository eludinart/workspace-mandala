/**
 * Cache Nominatim des villes (annuaire). Serveur uniquement.
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from '@/lib/db'
import { geocodeAddress } from '@/lib/geocode'
import { normalizeCityLabel, parseCityAndPostal } from '@/lib/practice-locations'

let _ensured = false

async function ensureGeoCityCache(): Promise<void> {
  if (_ensured || !isDbConfigured()) return
  const pool = getPool()
  const t = table('geo_city_cache')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${t} (
      city_key VARCHAR(120) NOT NULL PRIMARY KEY,
      city_label VARCHAR(120) NOT NULL,
      latitude DECIMAL(9,6) NOT NULL,
      longitude DECIMAL(9,6) NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  _ensured = true
}

function cityKey(label: string): string {
  return normalizeCityLabel(label).toLocaleLowerCase('fr')
}

export type CityCoords = { city: string; latitude: number; longitude: number }

/** Enregistre des coords connues (ex. centre commune geo.api.gouv.fr). */
export async function rememberCityCoords(input: CityCoords): Promise<void> {
  const city = normalizeCityLabel(input.city)
  if (!city || !isDbConfigured()) return
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) return
  await ensureGeoCityCache()
  const pool = getPool()
  const t = table('geo_city_cache')
  await pool.execute(
    `INSERT INTO ${t} (city_key, city_label, latitude, longitude)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE city_label = VALUES(city_label),
       latitude = VALUES(latitude), longitude = VALUES(longitude)`,
    [cityKey(city), city, input.latitude, input.longitude]
  )
}

/** Résout une ville FR (cache puis Nominatim). Accepte « Tours 37000 ». */
export async function resolveCityCoords(rawCity: string): Promise<CityCoords | null> {
  const parsed = parseCityAndPostal(rawCity)
  const city = parsed.city
  if (!city || !isDbConfigured()) return null
  const key = cityKey(city)
  await ensureGeoCityCache()
  const pool = getPool()
  const t = table('geo_city_cache')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT city_label, latitude, longitude FROM ${t} WHERE city_key = ? LIMIT 1`,
    [key]
  )
  if (rows[0]) {
    return {
      city: String(rows[0].city_label),
      latitude: Number(rows[0].latitude),
      longitude: Number(rows[0].longitude),
    }
  }
  const hit = await geocodeAddress({
    city,
    postal_code: parsed.postal_code,
    country: 'France',
  })
  if (!hit) return null
  await rememberCityCoords({ city, latitude: hit.latitude, longitude: hit.longitude })
  return { city, latitude: hit.latitude, longitude: hit.longitude }
}

/** Batch avec pause légère entre appels Nominatim manquants. */
export async function resolveCitiesCoords(cities: string[]): Promise<Map<string, CityCoords>> {
  const out = new Map<string, CityCoords>()
  const unique = [...new Set(cities.map(normalizeCityLabel).filter(Boolean))]
  for (const city of unique.slice(0, 40)) {
    const coords = await resolveCityCoords(city)
    if (coords) out.set(cityKey(city), coords)
    await new Promise((r) => setTimeout(r, 50))
  }
  return out
}
