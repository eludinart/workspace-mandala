/**
 * Souhait de rencontre entre deux personnes qui ne partagent pas de lieu.
 * La conversation s'ouvre seulement après acceptation.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool, table } from './db'
import { listCommunitiesForUser } from './db-communities'
import { createNotification } from './db-notifications'
import { skillScopeOf } from './db-skills'
import { openDirectChannel } from './db-social'

export type MeetMode = 'shared' | 'pending' | 'incoming' | 'conversation' | 'none'

export type MeetStatus = {
  mode: MeetMode
  slug?: string
  request_id?: number
  channel_id?: number
}

let ensured = false

async function ensureMeetTable(): Promise<void> {
  if (ensured) return
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${table('mandala_meet_requests')} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      from_user_id INT NOT NULL,
      to_user_id INT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_meet_pair (from_user_id, to_user_id),
      KEY idx_meet_to (to_user_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  ensured = true
}

async function publicName(userId: number): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(p.meta_value, u.display_name, CONCAT('user_', u.ID)) AS pseudo
     FROM ${table('users')} u
     LEFT JOIN ${table('usermeta')} p ON p.user_id = u.ID AND p.meta_key = 'mdl_pseudo'
     WHERE u.ID = ? LIMIT 1`,
    [userId]
  )
  return String(rows[0]?.pseudo || `user_${userId}`)
}

async function sharedPlaceSlug(userId: number, targetUserId: number): Promise<string | null> {
  const mine = await listCommunitiesForUser(userId)
  const theirs = new Set((await listCommunitiesForUser(targetUserId)).map((c) => c.id))
  return mine.find((c) => theirs.has(c.id))?.slug ?? null
}

async function findRequest(fromUserId: number, toUserId: number): Promise<RowDataPacket | null> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, from_user_id, to_user_id, status FROM ${table('mandala_meet_requests')}
     WHERE from_user_id = ? AND to_user_id = ? LIMIT 1`,
    [fromUserId, toUserId]
  )
  return rows[0] ?? null
}

async function openAcceptedChannel(fromUserId: number, toUserId: number): Promise<number> {
  const { channelId } = await openDirectChannel(fromUserId, toUserId)
  return channelId
}

export async function getMeetStatus(userId: number, targetUserId: number): Promise<MeetStatus> {
  if (!userId || !targetUserId || userId === targetUserId) return { mode: 'none' }
  const slug = await sharedPlaceSlug(userId, targetUserId)
  if (slug) return { mode: 'shared', slug }
  await ensureMeetTable()
  const outgoing = await findRequest(userId, targetUserId)
  if (outgoing?.status === 'accepted') {
    return { mode: 'conversation', channel_id: await openAcceptedChannel(userId, targetUserId), request_id: Number(outgoing.id) }
  }
  if (outgoing?.status === 'pending') return { mode: 'pending', request_id: Number(outgoing.id) }
  const incoming = await findRequest(targetUserId, userId)
  if (incoming?.status === 'accepted') {
    return { mode: 'conversation', channel_id: await openAcceptedChannel(targetUserId, userId), request_id: Number(incoming.id) }
  }
  if (incoming?.status === 'pending') return { mode: 'incoming', request_id: Number(incoming.id) }
  return { mode: 'none' }
}

export async function requestMeeting(userId: number, targetUserId: number): Promise<MeetStatus> {
  if (!userId || !targetUserId) throw Object.assign(new Error('Personne introuvable'), { status: 400 })
  if (userId === targetUserId) throw Object.assign(new Error('Vous ne pouvez pas vous écrire à vous-même'), { status: 400 })
  const scope = await skillScopeOf(targetUserId)
  if (scope !== 'mandala') {
    throw Object.assign(new Error('Cette fiche n’est pas visible'), { status: 404 })
  }
  const current = await getMeetStatus(userId, targetUserId)
  if (current.mode !== 'none') return current

  await ensureMeetTable()
  const pool = getPool()
  const existing = await findRequest(userId, targetUserId)
  let requestId = existing ? Number(existing.id) : 0
  if (existing) {
    await pool.execute(
      `UPDATE ${table('mandala_meet_requests')} SET status = 'pending' WHERE id = ?`,
      [requestId]
    )
  } else {
    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ${table('mandala_meet_requests')} (from_user_id, to_user_id, status) VALUES (?, ?, 'pending')`,
      [userId, targetUserId]
    )
    requestId = Number(res.insertId)
  }

  const name = await publicName(userId)
  await createNotification({
    type: 'meet_request',
    title: 'Quelqu’un souhaite se rencontrer',
    body: `${name} aimerait entrer en contact. La conversation s’ouvre si vous acceptez.`,
    recipient_type: 'user',
    recipient_id: targetUserId,
    created_by: userId,
    source_type: 'meet_request',
    source_id: requestId,
    action_url: 'mandala:notifications',
    action_label: 'Répondre',
  })
  return { mode: 'pending', request_id: requestId }
}

export async function respondToMeeting(
  userId: number,
  requestId: number,
  accept: boolean
): Promise<MeetStatus> {
  if (!requestId) throw Object.assign(new Error('Demande introuvable'), { status: 400 })
  await ensureMeetTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, from_user_id, to_user_id, status FROM ${table('mandala_meet_requests')} WHERE id = ? LIMIT 1`,
    [requestId]
  )
  const row = rows[0]
  if (!row) throw Object.assign(new Error('Demande introuvable'), { status: 404 })
  if (Number(row.to_user_id) !== userId) {
    throw Object.assign(new Error('Cette demande ne vous est pas adressée'), { status: 403 })
  }
  const fromUserId = Number(row.from_user_id)
  if (row.status === 'accepted') {
    return { mode: 'conversation', channel_id: await openAcceptedChannel(fromUserId, userId), request_id: requestId }
  }
  if (row.status === 'refused') {
    throw Object.assign(new Error('Cette demande a déjà reçu une réponse'), { status: 400 })
  }
  if (!accept) {
    await pool.execute(`UPDATE ${table('mandala_meet_requests')} SET status = 'refused' WHERE id = ?`, [requestId])
    const name = await publicName(userId)
    await createNotification({
      type: 'meet_request',
      title: 'Rencontre non acceptée',
      body: `${name} n’a pas accepté le souhait de rencontre.`,
      recipient_type: 'user',
      recipient_id: fromUserId,
      created_by: userId,
      source_type: 'meet_request',
      source_id: requestId,
      action_url: 'mandala:directory',
    })
    return { mode: 'none', request_id: requestId }
  }

  const channelId = await openAcceptedChannel(fromUserId, userId)
  await pool.execute(`UPDATE ${table('mandala_meet_requests')} SET status = 'accepted' WHERE id = ?`, [requestId])
  await pool.execute(
    `UPDATE ${table('mandala_meet_requests')} SET status = 'accepted'
     WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
    [userId, fromUserId]
  )
  const name = await publicName(userId)
  await createNotification({
    type: 'meet_request',
    title: 'Rencontre acceptée',
    body: `${name} a accepté. La conversation est ouverte.`,
    recipient_type: 'user',
    recipient_id: fromUserId,
    created_by: userId,
    source_type: 'meet_request',
    source_id: requestId,
    channel_id: channelId,
    action_url: `mandala:messages?channelId=${channelId}`,
    action_label: 'Ouvrir la conversation',
  })
  return { mode: 'conversation', channel_id: channelId, request_id: requestId }
}
