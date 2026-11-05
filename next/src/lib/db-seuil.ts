/**
 * Porte `seuil` — écrire à quelqu’un d’un lieu ami seulement si
 * conversation déjà ouverte, ou présence commune récente sur un lieu ami.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'
import { canAccessFeatureDoor } from '@/lib/db-feature-doors'
import { listAcceptedFriendCommunityIds } from '@/lib/db-place-links'
import { listCommunitiesForUser } from '@/lib/db-communities'

async function shareCommunity(userA: number, userB: number): Promise<boolean> {
  if (!isDbConfigured() || userA <= 0 || userB <= 0) return false
  const pool = getPool()
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1
     FROM ${tM} a
     JOIN ${tM} b ON b.community_id = a.community_id AND b.user_id = ?
     WHERE a.user_id = ?
     LIMIT 1`,
    [userB, userA]
  )
  return Boolean(rows[0])
}

async function existingDirectChannel(userA: number, userB: number): Promise<boolean> {
  const pool = getPool()
  const t = table('chat_channels')
  const ua = Math.min(userA, userB)
  const ub = Math.max(userA, userB)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${t}
     WHERE user_a = ? AND user_b = ? AND COALESCE(channel_type, 'direct') = 'direct'
     LIMIT 1`,
    [ua, ub]
  )
  return Boolean(rows[0])
}

/** Présence le même jour sur un lieu (90 derniers jours). */
async function sharedRecentPresence(userA: number, userB: number): Promise<boolean> {
  const pool = getPool()
  const tP = table('calendar_presence')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1
     FROM ${tP} a
     JOIN ${tP} b
       ON b.community_id = a.community_id
      AND b.day = a.day
      AND b.user_id = ?
     WHERE a.user_id = ?
       AND a.day >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
     LIMIT 1`,
    [userB, userA]
  )
  return Boolean(rows[0])
}

/** Au moins un couple de lieux amis entre les communautés des deux personnes. */
async function linkedViaFriendPlaces(userA: number, userB: number): Promise<boolean> {
  const [placesA, placesB] = await Promise.all([
    listCommunitiesForUser(userA),
    listCommunitiesForUser(userB),
  ])
  if (!placesA.length || !placesB.length) return false
  for (const pa of placesA) {
    const friends = await listAcceptedFriendCommunityIds(pa.id)
    if (placesB.some((pb) => friends.includes(pb.id))) return true
  }
  return false
}

/**
 * Peut-on ouvrir / poursuivre un message 1:1 hors lieu commun ?
 * - Même lieu → toujours oui (hors scope seuil).
 * - Porte `seuil` fermée → non (comportement actuel : pas de DM hors lieu).
 * - Porte ouverte → oui si conversation existante, ou présence commune + lieux amis.
 */
export async function canMessageUnderSeuil(
  viewerId: number,
  targetId: number
): Promise<{ ok: boolean; reason?: string }> {
  if (viewerId <= 0 || targetId <= 0 || viewerId === targetId) {
    return { ok: false, reason: 'Destinataire invalide' }
  }
  if (await shareCommunity(viewerId, targetId)) {
    return { ok: true }
  }
  if (await existingDirectChannel(viewerId, targetId)) {
    return { ok: true }
  }

  const doorOpen = await canAccessFeatureDoor(viewerId, 'seuil')
  if (!doorOpen) {
    return {
      ok: false,
      reason: 'Pour écrire à cette personne, partagez un lieu, ou ouvrez la porte « seuil ».',
    }
  }

  const linked = await linkedViaFriendPlaces(viewerId, targetId)
  if (!linked) {
    return {
      ok: false,
      reason: 'Pas de lieu ami en commun avec cette personne.',
    }
  }
  if (!(await sharedRecentPresence(viewerId, targetId))) {
    return {
      ok: false,
      reason:
        'Écrire à quelqu’un d’un lieu ami nécessite une date commune récente (présence au calendrier), ou une conversation déjà ouverte.',
    }
  }
  return { ok: true }
}
