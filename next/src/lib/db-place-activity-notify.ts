/**
 * Alertes d’activité de lieu (Agora, ressources, fiche, événements, arrivées…).
 * Fan-out via recordUserNotification + push groupé (évite le dédoublonnage createNotification).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from '@/lib/db'
import { getCommunityById, listCommunityMemberUserIds } from '@/lib/db-communities'
import { recordUserNotification } from '@/lib/db-notifications'
import { sendWebPushToUsers } from '@/lib/web-push-send'

async function actorDisplayName(userId: number): Promise<string> {
  if (!userId) return 'Quelqu’un'
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(p.meta_value, u.display_name, CONCAT('user_', u.ID)) AS pseudo
     FROM ${tUsers} u
     LEFT JOIN ${tMeta} p ON p.user_id = u.ID AND p.meta_key = 'mdl_pseudo'
     WHERE u.ID = ? LIMIT 1`,
    [userId]
  )
  const name = String(rows[0]?.pseudo ?? '').trim()
  return name || 'Quelqu’un'
}

export async function notifyPlaceMembers(params: {
  communityId: number
  actorUserId: number
  type: string
  title: string
  body?: string | null
  actionUrl?: string | null
  actionLabel?: string
  sourceType?: string | null
  sourceId?: number | null
  /** Tag push stable (défaut dérivé du type + lieu). */
  pushTag?: string
}): Promise<void> {
  const communityId = Number(params.communityId)
  const actorUserId = Number(params.actorUserId)
  if (!communityId || !actorUserId) return

  let memberIds: number[]
  try {
    memberIds = await listCommunityMemberUserIds(communityId)
  } catch {
    return
  }
  const recipients = [...new Set(memberIds.filter((id) => id > 0 && id !== actorUserId))]
  if (!recipients.length) return

  const title = String(params.title ?? '').trim().slice(0, 255)
  if (!title) return
  const body = params.body != null ? String(params.body).slice(0, 500) : null
  const actionUrl = params.actionUrl ?? null
  const actionLabel = params.actionLabel ?? 'Voir'
  const type = String(params.type || 'place_activity').slice(0, 40)

  for (const userId of recipients) {
    try {
      await recordUserNotification({
        userId,
        type,
        title,
        body,
        actionUrl,
        actionLabel,
        priority: 'normal',
        sourceType: params.sourceType ?? null,
        sourceId: params.sourceId ?? null,
        createdBy: actorUserId,
      })
    } catch {
      /* non bloquant */
    }
  }

  try {
    await sendWebPushToUsers(recipients, title, body ?? title, actionUrl, {
      tag: params.pushTag ?? `mdl-place-${communityId}-${type}`,
    })
  } catch {
    /* non bloquant */
  }
}

/** Notifie les membres de plusieurs lieux (déduplique les personnes). */
export async function notifyPlacesMembers(params: {
  communityIds: number[]
  actorUserId: number
  type: string
  titleForPlace: (placeName: string) => string
  body?: string | null
  actionUrl?: string | null
  actionLabel?: string
  sourceType?: string | null
  sourceId?: number | null
}): Promise<void> {
  const ids = [...new Set(params.communityIds.filter((id) => id > 0))]
  for (const communityId of ids) {
    let placeName = 'un lieu'
    try {
      const c = await getCommunityById(communityId)
      if (c?.name) placeName = c.name
    } catch {
      /* ignore */
    }
    await notifyPlaceMembers({
      communityId,
      actorUserId: params.actorUserId,
      type: params.type,
      title: params.titleForPlace(placeName),
      body: params.body,
      actionUrl: params.actionUrl,
      actionLabel: params.actionLabel,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      pushTag: `mdl-place-${communityId}-${params.type}`,
    })
  }
}

export async function resolveActorLabel(userId: number): Promise<string> {
  return actorDisplayName(userId)
}
