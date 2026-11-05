/**
 * Porte `aide_contextuelle` — cartes d’explication une fois par écran (persistance DB).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'
import {
  EXPLAIN_COPY,
  EXPLAIN_SCREENS,
  isExplainScreen,
  type ExplainScreen,
} from '@/lib/explain-card-constants'

export { EXPLAIN_COPY, EXPLAIN_SCREENS, isExplainScreen, type ExplainScreen }

const META_KEY = 'mdl_explain_dismissed_json'

async function readDismissed(userId: number): Promise<Set<string>> {
  const pool = getPool()
  const t = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${t} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, META_KEY]
  )
  if (!rows[0]?.meta_value) return new Set()
  try {
    const parsed = JSON.parse(String(rows[0].meta_value)) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((x) => String(x)))
  } catch {
    return new Set()
  }
}

async function writeDismissed(userId: number, keys: Set<string>): Promise<void> {
  const pool = getPool()
  const t = table('usermeta')
  const json = JSON.stringify([...keys])
  await pool.execute(
    `INSERT INTO ${t} (user_id, meta_key, meta_value)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
    [userId, META_KEY, json]
  )
}

export async function listDismissedExplainScreens(userId: number): Promise<string[]> {
  if (!isDbConfigured() || userId <= 0) return []
  return [...(await readDismissed(userId))]
}

export async function dismissExplainScreen(
  userId: number,
  screen: string
): Promise<string[]> {
  if (!isDbConfigured() || userId <= 0) throw new Error('Utilisateur invalide')
  const set = await readDismissed(userId)
  set.add(screen)
  await writeDismissed(userId, set)
  return [...set]
}
