/**
 * Portes des fonctions — audience + personnes nommées.
 * Défaut sans ligne : administrateurs (rien de visible pour les autres).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'
import { authMe } from '@/lib/db-auth'
import { listCommunitiesManagedByUser } from '@/lib/db-communities'
import {
  FEATURE_DOOR_KEYS,
  FEATURE_DOOR_LABELS,
  isFeatureDoorAudience,
  isFeatureDoorKey,
  type FeatureDoorAudience,
  type FeatureDoorKey,
} from '@/lib/feature-door-constants'

export type FeatureDoorRow = {
  feature_key: FeatureDoorKey
  label: string
  audience: FeatureDoorAudience
  named_user_ids: number[]
  updated_at: string | null
  updated_by: number | null
}

let _ensure: Promise<void> | null = null

export async function ensureFeatureDoorTables(): Promise<void> {
  if (!isDbConfigured()) return
  if (_ensure) return _ensure
  const pool = getPool()
  const prefix = process.env.DB_PREFIX || 'mdl_'
  _ensure = (async () => {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${prefix}mandala_feature_doors (
        feature_key VARCHAR(64) NOT NULL PRIMARY KEY,
        audience ENUM('administrateurs','gestionnaires','everyone') NOT NULL DEFAULT 'administrateurs',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by INT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${prefix}mandala_feature_door_users (
        feature_key VARCHAR(64) NOT NULL,
        user_id INT NOT NULL,
        PRIMARY KEY (feature_key, user_id),
        KEY idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    for (const key of FEATURE_DOOR_KEYS) {
      await pool.execute(
        `INSERT IGNORE INTO ${prefix}mandala_feature_doors (feature_key, audience) VALUES (?, 'administrateurs')`,
        [key]
      )
    }
  })().catch((err) => {
    _ensure = null
    throw err
  })
  return _ensure
}

async function namedUsersFor(featureKey: string): Promise<number[]> {
  const pool = getPool()
  const t = table('mandala_feature_door_users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id FROM ${t} WHERE feature_key = ? ORDER BY user_id ASC`,
    [featureKey]
  )
  return rows.map((r) => Number(r.user_id)).filter((n) => n > 0)
}

export async function listFeatureDoors(): Promise<FeatureDoorRow[]> {
  await ensureFeatureDoorTables()
  if (!isDbConfigured()) {
    return FEATURE_DOOR_KEYS.map((key) => ({
      feature_key: key,
      label: FEATURE_DOOR_LABELS[key],
      audience: 'administrateurs' as FeatureDoorAudience,
      named_user_ids: [],
      updated_at: null,
      updated_by: null,
    }))
  }
  const pool = getPool()
  const t = table('mandala_feature_doors')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT feature_key, audience, updated_at, updated_by FROM ${t}`
  )
  const byKey = new Map<string, RowDataPacket>()
  for (const r of rows) byKey.set(String(r.feature_key), r)

  const out: FeatureDoorRow[] = []
  for (const key of FEATURE_DOOR_KEYS) {
    const r = byKey.get(key)
    const audienceRaw = r ? String(r.audience) : 'administrateurs'
    const audience: FeatureDoorAudience = isFeatureDoorAudience(audienceRaw)
      ? audienceRaw
      : 'administrateurs'
    out.push({
      feature_key: key,
      label: FEATURE_DOOR_LABELS[key],
      audience,
      named_user_ids: await namedUsersFor(key),
      updated_at: r?.updated_at ? new Date(r.updated_at).toISOString() : null,
      updated_by: r?.updated_by != null ? Number(r.updated_by) : null,
    })
  }
  return out
}

export async function updateFeatureDoor(params: {
  featureKey: FeatureDoorKey
  audience: FeatureDoorAudience
  namedUserIds: number[]
  updatedBy: number
}): Promise<FeatureDoorRow> {
  await ensureFeatureDoorTables()
  const pool = getPool()
  const tD = table('mandala_feature_doors')
  const tU = table('mandala_feature_door_users')

  await pool.execute(
    `INSERT INTO ${tD} (feature_key, audience, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE audience = VALUES(audience), updated_by = VALUES(updated_by)`,
    [params.featureKey, params.audience, params.updatedBy]
  )

  await pool.execute(`DELETE FROM ${tU} WHERE feature_key = ?`, [params.featureKey])
  const uniqueIds = [...new Set(params.namedUserIds.filter((id) => id > 0))]
  for (const uid of uniqueIds) {
    await pool.execute(`INSERT INTO ${tU} (feature_key, user_id) VALUES (?, ?)`, [
      params.featureKey,
      uid,
    ])
  }

  const all = await listFeatureDoors()
  const row = all.find((d) => d.feature_key === params.featureKey)
  if (!row) throw new Error('Porte introuvable après mise à jour')
  return row
}

async function isAppAdminUser(userId: number): Promise<boolean> {
  try {
    const user = await authMe(userId)
    const role = String(user.app_role || user.wp_role || '').toLowerCase()
    return role === 'admin' || role === 'administrator'
  } catch {
    return false
  }
}

async function isPlaceManager(userId: number): Promise<boolean> {
  const managed = await listCommunitiesManagedByUser(userId)
  return managed.length > 0
}

/**
 * true si la fonction peut être utilisée / montrée à cet utilisateur.
 * Admin app : toujours. Sinon personnes nommées, sinon audience.
 */
export async function canAccessFeatureDoor(
  userId: number,
  featureKey: string
): Promise<boolean> {
  if (!userId || !isFeatureDoorKey(featureKey)) return false
  if (await isAppAdminUser(userId)) return true

  await ensureFeatureDoorTables()
  if (!isDbConfigured()) return false

  const pool = getPool()
  const tU = table('mandala_feature_door_users')
  const [named] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok FROM ${tU} WHERE feature_key = ? AND user_id = ? LIMIT 1`,
    [featureKey, userId]
  )
  if (named[0]) return true

  const tD = table('mandala_feature_doors')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT audience FROM ${tD} WHERE feature_key = ? LIMIT 1`,
    [featureKey]
  )
  const audienceRaw = rows[0] ? String(rows[0].audience) : 'administrateurs'
  const audience: FeatureDoorAudience = isFeatureDoorAudience(audienceRaw)
    ? audienceRaw
    : 'administrateurs'

  switch (audience) {
    case 'administrateurs':
      return false
    case 'gestionnaires':
      return isPlaceManager(userId)
    case 'everyone':
      return true
    default: {
      const _e: never = audience
      return _e
    }
  }
}

/** Map clé → accès pour l’utilisateur courant (UI). */
export async function featureDoorAccessMap(
  userId: number
): Promise<Record<FeatureDoorKey, boolean>> {
  const out = {} as Record<FeatureDoorKey, boolean>
  await Promise.all(
    FEATURE_DOOR_KEYS.map(async (key) => {
      out[key] = await canAccessFeatureDoor(userId, key)
    })
  )
  return out
}
