/**
 * Liens entre lieux (pending → accepted).
 * Voir docs/LIENS-LIEUX-MODELE.md §2.
 */
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'
import { assertUserCanManageCommunity, getCommunityById } from '@/lib/db-communities'
import { canAccessFeatureDoor } from '@/lib/db-feature-doors'
import { createNotification } from '@/lib/db-notifications'
import {
  buildPlaceLinkRequestEmailBody,
  isTransactionalEmailConfigured,
  resolvePublicAppOrigin,
  sendTransactionalEmail,
} from '@/lib/mandala-mail'

export type PlaceLinkStatus = 'pending' | 'accepted' | 'rejected' | 'canceled'

export type PlaceLinkRow = {
  id: number
  community_a_id: number
  community_b_id: number
  requested_by_community_id: number
  requested_by_user_id: number
  status: PlaceLinkStatus
  created_at: string | null
  responded_at: string | null
  responded_by_user_id: number | null
}

let _ensure: Promise<void> | null = null

export async function ensurePlaceLinksTable(): Promise<void> {
  if (!isDbConfigured()) return
  if (_ensure) return _ensure
  const pool = getPool()
  const prefix = process.env.DB_PREFIX || 'mdl_'
  _ensure = pool
    .execute(
      `
    CREATE TABLE IF NOT EXISTS ${prefix}mandala_place_links (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_a_id INT NOT NULL,
      community_b_id INT NOT NULL,
      requested_by_community_id INT NOT NULL,
      requested_by_user_id INT NOT NULL,
      status ENUM('pending','accepted','rejected','canceled') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME NULL,
      responded_by_user_id INT NULL,
      UNIQUE KEY uq_pair (community_a_id, community_b_id),
      KEY idx_status (status),
      KEY idx_requested (requested_by_community_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
    )
    .then(() => undefined)
    .catch((err) => {
      _ensure = null
      throw err
    })
  return _ensure
}

function pairIds(id1: number, id2: number): { a: number; b: number } {
  return id1 < id2 ? { a: id1, b: id2 } : { a: id2, b: id1 }
}

function mapLink(r: RowDataPacket): PlaceLinkRow {
  const status = String(r.status) as PlaceLinkStatus
  return {
    id: Number(r.id),
    community_a_id: Number(r.community_a_id),
    community_b_id: Number(r.community_b_id),
    requested_by_community_id: Number(r.requested_by_community_id),
    requested_by_user_id: Number(r.requested_by_user_id),
    status:
      status === 'pending' ||
      status === 'accepted' ||
      status === 'rejected' ||
      status === 'canceled'
        ? status
        : 'pending',
    created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    responded_at: r.responded_at ? new Date(r.responded_at).toISOString() : null,
    responded_by_user_id:
      r.responded_by_user_id != null ? Number(r.responded_by_user_id) : null,
  }
}

export async function getPlaceLinkBetween(
  communityId1: number,
  communityId2: number
): Promise<PlaceLinkRow | null> {
  if (!isDbConfigured() || !communityId1 || !communityId2) return null
  await ensurePlaceLinksTable()
  const { a, b } = pairIds(communityId1, communityId2)
  const pool = getPool()
  const t = table('mandala_place_links')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${t} WHERE community_a_id = ? AND community_b_id = ? LIMIT 1`,
    [a, b]
  )
  return rows[0] ? mapLink(rows[0]) : null
}

/** Ids des lieux amis (lien accepted) d’un lieu. */
export async function listAcceptedFriendCommunityIds(
  communityId: number
): Promise<number[]> {
  const friends = await listAcceptedFriendsBrief(communityId)
  return friends.map((f) => f.id)
}

export type AcceptedFriendBrief = {
  id: number
  slug: string
  name: string
}

/** Lieux amis accepted avec nom (carte / fiche Relier). */
export async function listAcceptedFriendsBrief(
  communityId: number
): Promise<AcceptedFriendBrief[]> {
  if (!isDbConfigured() || !communityId) return []
  await ensurePlaceLinksTable()
  const pool = getPool()
  const t = table('mandala_place_links')
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       CASE WHEN l.community_a_id = ? THEN l.community_b_id ELSE l.community_a_id END AS other_id,
       c.slug, c.name
     FROM ${t} l
     JOIN ${tC} c ON c.id = CASE
       WHEN l.community_a_id = ? THEN l.community_b_id ELSE l.community_a_id END
       AND c.is_active = 1
     WHERE l.status = 'accepted'
       AND (l.community_a_id = ? OR l.community_b_id = ?)
     ORDER BY c.name ASC`,
    [communityId, communityId, communityId, communityId]
  )
  const out: AcceptedFriendBrief[] = []
  const seen = new Set<number>()
  for (const r of rows ?? []) {
    const id = Number(r.other_id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      slug: String(r.slug || ''),
      name: String(r.name || 'Lieu'),
    })
  }
  return out
}

export type PlaceFriendLinkItem = {
  link_id: number
  status: 'accepted' | 'pending'
  other: {
    id: number
    slug: string
    name: string
    logo_emoji: string | null
    accent_color: string | null
    avatar: string | null
  }
  /** True si notre lieu a initié la demande (pending). */
  we_requested: boolean
  created_at: string | null
}

/** Liens accepted + pending d’un lieu (vue gestionnaire). */
export async function listPlaceFriendLinksForCommunity(
  communityId: number
): Promise<PlaceFriendLinkItem[]> {
  if (!isDbConfigured() || !communityId) return []
  await ensurePlaceLinksTable()
  const pool = getPool()
  const t = table('mandala_place_links')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT *
     FROM ${t}
     WHERE status IN ('accepted', 'pending')
       AND (community_a_id = ? OR community_b_id = ?)
     ORDER BY
       CASE status WHEN 'accepted' THEN 0 ELSE 1 END,
       created_at DESC`,
    [communityId, communityId]
  )

  const items: PlaceFriendLinkItem[] = []
  for (const r of rows ?? []) {
    const link = mapLink(r)
    const otherId =
      link.community_a_id === communityId ? link.community_b_id : link.community_a_id
    if (!otherId || otherId === communityId) continue
    const other = await getCommunityById(otherId)
    if (!other || !other.is_active) continue
    const status = link.status === 'accepted' ? 'accepted' : 'pending'
    items.push({
      link_id: link.id,
      status,
      other: {
        id: other.id,
        slug: other.slug,
        name: other.name,
        logo_emoji: other.logo_emoji,
        accent_color: other.accent_color,
        avatar: other.avatar,
      },
      we_requested: link.requested_by_community_id === communityId,
      created_at: link.created_at,
    })
  }
  return items
}

/** True si A et B sont lieux amis (accepted). */
export async function arePlacesFriends(
  communityId1: number,
  communityId2: number
): Promise<boolean> {
  if (!communityId1 || !communityId2 || communityId1 === communityId2) return false
  const link = await getPlaceLinkBetween(communityId1, communityId2)
  return link?.status === 'accepted'
}

/**
 * Propose un lien : fromCommunity (géré par user) → toCommunity (cible sur la carte).
 */
export async function requestPlaceLink(params: {
  userId: number
  fromCommunityId: number
  toCommunityId: number
  isAppAdmin?: boolean
}): Promise<PlaceLinkRow> {
  const { userId, fromCommunityId, toCommunityId, isAppAdmin = false } = params
  if (fromCommunityId === toCommunityId) {
    throw Object.assign(new Error('Un lieu ne peut pas se relier à lui-même'), { status: 422 })
  }

  const allowed = await canAccessFeatureDoor(userId, 'lieux_lies')
  if (!allowed) {
    throw Object.assign(new Error('Fonction non disponible'), { status: 403 })
  }

  await assertUserCanManageCommunity(userId, fromCommunityId, { isAppAdmin })

  const target = await getCommunityById(toCommunityId)
  if (!target || !target.is_active) {
    throw Object.assign(new Error('Lieu cible introuvable'), { status: 404 })
  }

  await ensurePlaceLinksTable()
  const existing = await getPlaceLinkBetween(fromCommunityId, toCommunityId)
  if (existing?.status === 'accepted') {
    throw Object.assign(new Error('Ces lieux sont déjà reliés'), { status: 409 })
  }
  if (existing?.status === 'pending') {
    throw Object.assign(new Error('Une demande est déjà en cours'), { status: 409 })
  }

  const { a, b } = pairIds(fromCommunityId, toCommunityId)
  const pool = getPool()
  const t = table('mandala_place_links')

  let pending: PlaceLinkRow

  if (existing && (existing.status === 'rejected' || existing.status === 'canceled')) {
    await pool.execute(
      `UPDATE ${t}
       SET requested_by_community_id = ?, requested_by_user_id = ?, status = 'pending',
           responded_at = NULL, responded_by_user_id = NULL, created_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [fromCommunityId, userId, existing.id]
    )
    const refreshed = await getPlaceLinkBetween(fromCommunityId, toCommunityId)
    if (!refreshed) throw new Error('Lien introuvable après mise à jour')
    pending = refreshed
  } else {
    const [res] = await pool.execute(
      `INSERT INTO ${t}
        (community_a_id, community_b_id, requested_by_community_id, requested_by_user_id, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [a, b, fromCommunityId, userId]
    )
    const insertId = Number((res as ResultSetHeader).insertId)
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${t} WHERE id = ? LIMIT 1`,
      [insertId]
    )
    if (!rows[0]) throw new Error('Création du lien impossible')
    pending = mapLink(rows[0])
  }

  // Même gestionnaire des deux côtés → acceptation immédiate (pas d’alerte à soi-même).
  const managesTarget = await userManagesCommunity(userId, toCommunityId, isAppAdmin)
  if (managesTarget) {
    await pool.execute(
      `UPDATE ${t}
       SET status = 'accepted', responded_at = NOW(), responded_by_user_id = ?
       WHERE id = ? AND status = 'pending'`,
      [userId, pending.id]
    )
    const accepted = await getPlaceLinkById(pending.id)
    if (!accepted) throw new Error('Lien introuvable après acceptation')
    return accepted
  }

  await notifyTargetManagersOfPlaceLink(pending, fromCommunityId, toCommunityId, userId)
  return pending
}

async function userManagesCommunity(
  userId: number,
  communityId: number,
  isAppAdmin: boolean
): Promise<boolean> {
  try {
    await assertUserCanManageCommunity(userId, communityId, { isAppAdmin })
    return true
  } catch {
    return false
  }
}

async function listManagerUserIds(communityId: number): Promise<number[]> {
  if (!isDbConfigured() || !communityId) return []
  const pool = getPool()
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id FROM ${tM}
     WHERE community_id = ? AND role IN ('organizer','admin')`,
    [communityId]
  )
  return rows.map((r) => Number(r.user_id)).filter((n) => n > 0)
}

async function lookupUserEmail(userId: number): Promise<string | null> {
  if (!userId) return null
  const pool = getPool()
  const tUsers = table('users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_email FROM ${tUsers} WHERE ID = ? LIMIT 1`,
    [userId]
  )
  const email = String(rows[0]?.user_email ?? '')
    .trim()
    .toLowerCase()
  return email.includes('@') ? email : null
}

/** Alerte les gestionnaires du lieu cible — cloche (+ push) et e-mail si SMTP/Resend. */
async function notifyTargetManagersOfPlaceLink(
  link: PlaceLinkRow,
  fromCommunityId: number,
  toCommunityId: number,
  requesterUserId: number
): Promise<void> {
  const from = await getCommunityById(fromCommunityId)
  const to = await getCommunityById(toCommunityId)
  const fromName = from?.name ?? 'Un lieu'
  const toName = to?.name ?? 'votre lieu'
  const body = `${fromName} souhaite se relier à ${toName}. Acceptez ou refusez depuis cette alerte.`
  const alertsUrl = `${resolvePublicAppOrigin()}/app?page=notifications`
  const mailConfigured = isTransactionalEmailConfigured()
  const { subject, text } = buildPlaceLinkRequestEmailBody({
    fromPlaceName: fromName,
    toPlaceName: toName,
    alertsUrl,
  })
  const managers = await listManagerUserIds(toCommunityId)
  for (const managerId of managers) {
    if (managerId === requesterUserId) continue
    try {
      await createNotification({
        type: 'place_link_request',
        title: 'Ce lieu souhaite se lier',
        body,
        recipient_type: 'user',
        recipient_id: managerId,
        created_by: requesterUserId,
        source_type: 'place_link',
        source_id: link.id,
        action_url: 'mandala:notifications',
        action_label: 'Répondre',
        priority: 'high',
      })
    } catch {
      /* non bloquant */
    }
    if (!mailConfigured) continue
    try {
      const email = await lookupUserEmail(managerId)
      if (email) await sendTransactionalEmail({ to: email, subject, text })
    } catch {
      /* non bloquant */
    }
  }
}

export async function getPlaceLinkById(linkId: number): Promise<PlaceLinkRow | null> {
  if (!isDbConfigured() || !linkId) return null
  await ensurePlaceLinksTable()
  const pool = getPool()
  const t = table('mandala_place_links')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${t} WHERE id = ? LIMIT 1`,
    [linkId]
  )
  return rows[0] ? mapLink(rows[0]) : null
}

/**
 * Accepte ou refuse : réservé aux gestionnaires du lieu cible (pas celui qui a demandé).
 */
export async function respondToPlaceLink(params: {
  userId: number
  linkId: number
  accept: boolean
  isAppAdmin?: boolean
}): Promise<PlaceLinkRow> {
  const { userId, linkId, accept, isAppAdmin = false } = params
  const link = await getPlaceLinkById(linkId)
  if (!link) {
    throw Object.assign(new Error('Demande introuvable'), { status: 404 })
  }
  if (link.status !== 'pending') {
    throw Object.assign(new Error('Cette demande a déjà été traitée'), { status: 409 })
  }

  const targetCommunityId =
    link.community_a_id === link.requested_by_community_id
      ? link.community_b_id
      : link.community_a_id

  if (!isAppAdmin) {
    await assertUserCanManageCommunity(userId, targetCommunityId, { isAppAdmin: false })
  }

  const allowed = await canAccessFeatureDoor(userId, 'lieux_lies')
  if (!allowed && !isAppAdmin) {
    throw Object.assign(new Error('Fonction non disponible'), { status: 403 })
  }

  const pool = getPool()
  const t = table('mandala_place_links')
  const nextStatus: PlaceLinkStatus = accept ? 'accepted' : 'rejected'
  await pool.execute(
    `UPDATE ${t}
     SET status = ?, responded_at = NOW(), responded_by_user_id = ?
     WHERE id = ? AND status = 'pending'`,
    [nextStatus, userId, linkId]
  )
  const updated = await getPlaceLinkById(linkId)
  if (!updated) throw new Error('Lien introuvable après réponse')
  return updated
}

/** Statut du lien entre un de mes lieux et la cible (pour l’UI carte). */
export async function linkStatusTowardTarget(params: {
  managedCommunityIds: number[]
  targetCommunityId: number
}): Promise<{
  status: PlaceLinkStatus | 'none'
  from_community_id: number | null
  link_id: number | null
}> {
  const { managedCommunityIds, targetCommunityId } = params
  if (!managedCommunityIds.length || !targetCommunityId) {
    return { status: 'none', from_community_id: null, link_id: null }
  }
  for (const fromId of managedCommunityIds) {
    if (fromId === targetCommunityId) continue
    const link = await getPlaceLinkBetween(fromId, targetCommunityId)
    if (!link) continue
    if (link.status === 'accepted' || link.status === 'pending') {
      return {
        status: link.status,
        from_community_id: link.requested_by_community_id,
        link_id: link.id,
      }
    }
  }
  return { status: 'none', from_community_id: null, link_id: null }
}
