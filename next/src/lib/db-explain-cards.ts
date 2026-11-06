/**
 * Porte `aide_contextuelle` — cartes d’explication une fois par écran (persistance DB).
 *
 * `mdl_usermeta` n’a pas de UNIQUE (user_id, meta_key) : ne pas compter sur
 * ON DUPLICATE KEY UPDATE (sinon chaque « Compris » ajoute une ligne et LIMIT 1
 * peut relire une ancienne valeur sans l’écran dismissé).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'
import {
  EXPLAIN_COPY,
  EXPLAIN_SCREENS,
  isExplainScreen,
  type ExplainScreen,
} from '@/lib/explain-card-constants'
import {
  mergeDismissedMetaValues,
  serializeDismissedScreens,
} from '@/lib/explain-dismissed-meta'

export { EXPLAIN_COPY, EXPLAIN_SCREENS, isExplainScreen, type ExplainScreen }

const META_KEY = 'mdl_explain_dismissed_json'

async function readDismissed(userId: number): Promise<Set<string>> {
  const pool = getPool()
  const t = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${t} WHERE user_id = ? AND meta_key = ?`,
    [userId, META_KEY]
  )
  const raw = rows
    .map((r) => (r.meta_value == null ? '' : String(r.meta_value)))
    .filter(Boolean)
  return new Set(mergeDismissedMetaValues(raw))
}

async function writeDismissed(userId: number, keys: Set<string>): Promise<void> {
  const pool = getPool()
  const t = table('usermeta')
  const json = serializeDismissedScreens(keys)
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${t} WHERE user_id = ? AND meta_key = ? ORDER BY umeta_id ASC`,
    [userId, META_KEY]
  )
  if (existing.length) {
    const keepId = Number(existing[0].umeta_id)
    await pool.execute(`UPDATE ${t} SET meta_value = ? WHERE umeta_id = ?`, [json, keepId])
    if (existing.length > 1) {
      const extraIds = existing.slice(1).map((r) => Number(r.umeta_id))
      const placeholders = extraIds.map(() => '?').join(',')
      await pool.execute(`DELETE FROM ${t} WHERE umeta_id IN (${placeholders})`, extraIds)
    }
    return
  }
  await pool.execute(`INSERT INTO ${t} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
    userId,
    META_KEY,
    json,
  ])
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
