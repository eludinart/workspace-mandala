/**
 * Stats agrégées publiques (landing) — pas de PII.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'
import { cacheGet, cacheSet } from '@/lib/server-cache'

export type PublicNetworkStats = {
  places: number
  people: number
}

const CACHE_KEY = 'public:network-stats'
const CACHE_TTL_MS = 60_000

async function countScalar(sql: string): Promise<number> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(sql)
  return Number(rows[0]?.n ?? 0) || 0
}

export async function getPublicNetworkStats(): Promise<PublicNetworkStats> {
  const cached = cacheGet<PublicNetworkStats>(CACHE_KEY)
  if (cached) return cached

  if (!isDbConfigured()) {
    return { places: 0, people: 0 }
  }

  const tC = table('mandala_communities')
  const tUsers = table('users')
  const [places, people] = await Promise.all([
    countScalar(`SELECT COUNT(*) AS n FROM ${tC} WHERE is_active = 1`),
    countScalar(`SELECT COUNT(*) AS n FROM ${tUsers}`),
  ])

  const stats = { places, people }
  cacheSet(CACHE_KEY, stats, CACHE_TTL_MS)
  return stats
}
