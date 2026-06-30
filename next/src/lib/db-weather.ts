/**
 * Météo des Cœurs — statut par utilisateur et par communauté (usermeta JSON).
 */
import type { RowDataPacket } from 'mysql2'
import { ensureAuthTables } from './db-auth'
import { getPool, table } from './db'
import {
  type WeatherByCommunityMap,
  type WeatherState,
  type WeatherStatus,
  WEATHER_META_KEY,
  isWeatherStatus,
  parseWeatherByCommunityJson,
  pickWeatherForCommunity,
} from './weather-status'

async function upsertUsermeta(userId: number, metaKey: string, metaValue: string): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tbl} WHERE user_id = ? AND meta_key = ?`,
    [userId, metaKey]
  )
  if (existing.length > 0) {
    await pool.execute(`UPDATE ${tbl} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`, [
      metaValue,
      userId,
      metaKey,
    ])
  } else {
    await pool.execute(`INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
      userId,
      metaKey,
      metaValue,
    ])
  }
}

export async function getUserWeatherMap(userId: number): Promise<WeatherByCommunityMap> {
  await ensureAuthTables()
  const pool = getPool()
  const tbl = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${tbl} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, WEATHER_META_KEY]
  )
  return parseWeatherByCommunityJson(rows[0]?.meta_value as string | undefined)
}

export async function getUserWeatherForCommunity(
  userId: number,
  communityId: number
): Promise<WeatherState | null> {
  const map = await getUserWeatherMap(userId)
  return pickWeatherForCommunity(map, communityId)
}

export async function setUserWeatherForCommunity(
  userId: number,
  communityId: number,
  status: WeatherStatus,
  note?: string
): Promise<WeatherState> {
  if (!isWeatherStatus(status)) {
    throw Object.assign(new Error('Statut météo invalide'), { status: 400 })
  }
  const trimmedNote = String(note ?? '').trim().slice(0, 100)
  const map = await getUserWeatherMap(userId)
  const state: WeatherState = {
    status,
    note: trimmedNote,
    updated_at: new Date().toISOString(),
  }
  map[String(communityId)] = state
  await upsertUsermeta(userId, WEATHER_META_KEY, JSON.stringify(map))
  return state
}

/** Retire la météo cœur d'un utilisateur pour une communauté donnée. */
export async function clearUserWeatherForCommunity(
  userId: number,
  communityId: number
): Promise<void> {
  const map = await getUserWeatherMap(userId)
  const key = String(communityId)
  if (!(key in map)) return
  delete map[key]
  await upsertUsermeta(userId, WEATHER_META_KEY, JSON.stringify(map))
}

export function weatherFromMetaRow(
  metaValue: string | null | undefined,
  communityId: number
): { weather_status: WeatherStatus | null; weather_note: string | null } {
  const w = pickWeatherForCommunity(parseWeatherByCommunityJson(metaValue), communityId)
  if (!w) return { weather_status: null, weather_note: null }
  return { weather_status: w.status, weather_note: w.note || null }
}
