import type { RowDataPacket } from 'mysql2'
import { authMe } from './db-auth'
import { getPool, table } from './db'

const MANAGER_COMMUNITY_ROLES = new Set(['organizer', 'admin'])

/** L'acteur peut-il gérer la fiche / le mot de passe de la cible ? */
export async function actorCanManageTargetUser(
  actorUserId: number,
  targetUserId: number,
  options?: { isAppAdmin?: boolean; communitySlug?: string | null }
): Promise<boolean> {
  if (!actorUserId || !targetUserId) return false
  if (options?.isAppAdmin) return true

  const target = await authMe(targetUserId)
  const targetIsAppAdmin =
    target.app_role === 'admin' ||
    target.app_role === 'administrator' ||
    target.wp_role === 'administrator'
  if (targetIsAppAdmin) return false

  const pool = getPool()
  const tM = table('mandala_community_members')
  const tC = table('mandala_communities')

  if (options?.communitySlug) {
    const [crow] = await pool.execute<RowDataPacket[]>(
      `SELECT c.id FROM ${tC} c WHERE c.slug = ? LIMIT 1`,
      [options.communitySlug]
    )
    const communityId = Number(crow[0]?.id ?? 0)
    if (!communityId) return false

    const [actorRow] = await pool.execute<RowDataPacket[]>(
      `SELECT role FROM ${tM} WHERE community_id = ? AND user_id = ? LIMIT 1`,
      [communityId, actorUserId]
    )
    const actorRole = String(actorRow[0]?.role ?? '')
    if (!MANAGER_COMMUNITY_ROLES.has(actorRole)) return false

    const [targetRow] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM ${tM} WHERE community_id = ? AND user_id = ? LIMIT 1`,
      [communityId, targetUserId]
    )
    return (targetRow ?? []).length > 0
  }

  const [managed] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT m.community_id
     FROM ${tM} m
     WHERE m.user_id = ? AND m.role IN ('organizer', 'admin')`,
    [actorUserId]
  )
  const communityIds = (managed ?? []).map((r) => Number(r.community_id)).filter(Boolean)
  if (!communityIds.length) return false

  const placeholders = communityIds.map(() => '?').join(', ')
  const [shared] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM ${tM} WHERE user_id = ? AND community_id IN (${placeholders}) LIMIT 1`,
    [targetUserId, ...communityIds]
  )
  return (shared ?? []).length > 0
}
