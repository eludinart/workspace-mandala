/**
 * La Clairière (social / canaux chat) — MariaDB.
 */
import type { RowDataPacket } from 'mysql2'
import { ensureOnce, exec, getPool, table } from './db'
import { isAllowedReactionEmoji, type MessageReactionSummary } from './message-reactions'
import { messageReplyExcerpt, type MessageReplyQuote } from './chat-attachments'
import { isAvatarImageUrl } from './user-avatar'

const PRESENCE_ONLINE_SECONDS = 300

/** Table dédiée P2P / groupes (évite conflit avec mdl_chat_messages du chat coach). */
const P2P_MESSAGES_TABLE = 'chat_channel_messages'
const MESSAGE_REACTIONS_TABLE = 'chat_message_reactions'
const CHANNEL_READ_META_PREFIX = 'mdl_chat_channel_'

function isOnlineFromLastSeen(lastSeenAt: string): boolean {
  if (!lastSeenAt) return false
  const s = String(lastSeenAt).trim()
  let ts: number
  // Stored format from our code: 'YYYY-MM-DD HH:mm:ss' (UTC without timezone marker)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    ts = new Date(s.replace(' ', 'T') + 'Z').getTime()
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    // Some environments may store ISO without timezone marker
    ts = new Date(s + 'Z').getTime()
  } else {
    ts = new Date(s).getTime()
  }
  if (isNaN(ts)) return false
  return (Date.now() - ts) / 1000 <= PRESENCE_ONLINE_SECONDS
}

async function touchSocialPresence(pool: Awaited<ReturnType<typeof getPool>>, userId: number): Promise<void> {
  if (userId <= 0) return
  // Persist with timezone marker to avoid server timezone issues.
  const now = new Date().toISOString()
  const tbl = table('usermeta')
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tbl} WHERE user_id = ? AND meta_key = 'mdl_social_last_seen_at'`,
    [userId]
  )
  if (existing.length > 0) {
    await pool.execute(`UPDATE ${tbl} SET meta_value = ? WHERE user_id = ? AND meta_key = 'mdl_social_last_seen_at'`, [
      now,
      userId,
    ])
  } else {
    await pool.execute(
      `INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, 'mdl_social_last_seen_at', ?)`,
      [userId, now]
    )
  }
}

/** Heartbeat navigateur (Layout) : met à jour la présence pour La Clairière, la Prairie et le chat coach. */
export async function recordSocialPresenceHeartbeat(userId: number): Promise<void> {
  const pool = getPool()
  await touchSocialPresence(pool, userId)
}

async function fetchUsersAvatarMap(
  pool: Awaited<ReturnType<typeof getPool>>,
  userIds: number[]
): Promise<Map<number, { avatar: string | null; avatarEmoji: string }>> {
  const map = new Map<number, { avatar: string | null; avatarEmoji: string }>()
  const ids = [...new Set(userIds.filter((id) => id > 0))]
  if (!ids.length) return map
  for (const id of ids) map.set(id, { avatar: null, avatarEmoji: '🌸' })
  const tMeta = table('usermeta')
  const placeholders = ids.map(() => '?').join(',')
  const [metaRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, meta_key, meta_value FROM ${tMeta}
     WHERE user_id IN (${placeholders}) AND meta_key IN ('mdl_avatar', 'mdl_avatar_emoji')`,
    ids
  )
  for (const row of metaRows ?? []) {
    const uid = Number(row.user_id)
    const cur = map.get(uid)
    if (!cur) continue
    const key = String(row.meta_key ?? '')
    const val = row.meta_value != null ? String(row.meta_value).trim() : ''
    if (key === 'mdl_avatar' && val) cur.avatar = val
    if (key === 'mdl_avatar_emoji' && val) cur.avatarEmoji = val
  }
  return map
}

export type MyChannelRecord = {
  channelId: number
  channelType: 'direct' | 'group'
  communityId?: number | null
  createdBy?: number | null
  otherUserId?: number
  otherPseudo: string
  otherAvatar: string | null
  otherAvatarEmoji: string
  otherIsOnline: boolean
  otherLastSeenAt: string | null
  unreadCount: number
  memberCount?: number
  memberIds?: number[]
  lastMessage?: string | null
  lastMessageAt?: string | null
}

async function dropChatChannelsCheckConstraints(
  pool: Awaited<ReturnType<typeof getPool>>,
  tableName: string
): Promise<void> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'`,
      [tableName.replace(/^.*\./, '')]
    )
    for (const row of rows ?? []) {
      const name = String(row.CONSTRAINT_NAME ?? '').trim()
      if (!name) continue
      try {
        await pool.execute(`ALTER TABLE ${tableName} DROP CHECK \`${name}\``)
      } catch {
        try {
          await pool.execute(`ALTER TABLE ${tableName} DROP CONSTRAINT \`${name}\``)
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* information_schema indisponible */
  }
}

async function ensureGroupChannelSupport(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  await ensureOnce('social-group-channels', async () => {
      const tChannels = table('chat_channels')
      const tMembers = table('chat_channel_members')
      try {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS ${tChannels} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_a INT NOT NULL,
            user_b INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_pair (user_a, user_b)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `)
      } catch {
        /* exists */
      }
      await dropChatChannelsCheckConstraints(pool, tChannels)
      for (const [col, def] of [
        ['channel_type', "VARCHAR(20) NOT NULL DEFAULT 'direct'"],
        ['community_id', 'INT NULL'],
        ['channel_name', 'VARCHAR(255) NULL'],
        ['channel_icon_emoji', 'VARCHAR(32) NULL'],
        ['channel_icon_image', 'MEDIUMTEXT NULL'],
        ['member_fingerprint', 'VARCHAR(512) NULL'],
        ['created_by', 'INT NULL'],
      ] as const) {
        try {
          await pool.execute(`ALTER TABLE ${tChannels} ADD COLUMN ${col} ${def}`)
        } catch {
          /* exists */
        }
      }
      try {
        await pool.execute(`ALTER TABLE ${tChannels} DROP INDEX uk_pair`)
      } catch {
        /* already dropped */
      }
      try {
        await pool.execute(
          `ALTER TABLE ${tChannels} ADD UNIQUE KEY uk_direct_pair (user_a, user_b, channel_type)`
        )
      } catch {
        /* exists */
      }
      try {
        await pool.execute(
          `ALTER TABLE ${tChannels} ADD UNIQUE KEY uk_group_fp (community_id, member_fingerprint)`
        )
      } catch {
        /* exists */
      }
      try {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS ${tMembers} (
            channel_id INT NOT NULL,
            user_id INT NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (channel_id, user_id),
            INDEX idx_user (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `)
      } catch {
        /* exists */
      }
  }).catch(() => {
    /* DDL déjà appliqué ou indisponible — réessayé au prochain appel si l'erreur remonte */
  })
}

async function verifyUsersInCommunity(
  pool: Awaited<ReturnType<typeof getPool>>,
  communityId: number,
  userIds: number[]
): Promise<void> {
  const ids = [...new Set(userIds.filter((id) => id > 0))]
  if (!ids.length) throw new Error('Aucun membre sélectionné')
  const tM = table('mandala_community_members')
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id FROM ${tM} WHERE community_id = ? AND user_id IN (${placeholders})`,
    [communityId, ...ids]
  )
  if ((rows ?? []).length !== ids.length) {
    throw Object.assign(new Error('Tous les participants doivent être membres du lieu'), { status: 403 })
  }
}

function memberFingerprint(userIds: number[]): string {
  return [...new Set(userIds.filter((id) => id > 0))].sort((a, b) => a - b).join(',')
}

async function assertChannelAccess(
  pool: Awaited<ReturnType<typeof getPool>>,
  channelId: number,
  userId: number
): Promise<RowDataPacket> {
  await ensureGroupChannelSupport(pool)
  const tCh = table('chat_channels')
  const tMembers = table('chat_channel_members')
  const [chRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_a, user_b, COALESCE(channel_type, 'direct') AS channel_type,
            community_id, channel_name, member_fingerprint, created_by
     FROM ${tCh} WHERE id = ?`,
    [channelId]
  )
  if (!chRows?.length) throw new Error('Canal introuvable')
  const ch = chRows[0]
  const channelType = String(ch.channel_type ?? 'direct')
  if (channelType === 'group') {
    const [memberRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM ${tMembers} WHERE channel_id = ? AND user_id = ? LIMIT 1`,
      [channelId, userId]
    )
    if (!memberRows?.length) throw new Error('Accès non autorisé à ce canal')
    return ch
  }
  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  if (userId !== ua && userId !== ub) throw new Error('Accès non autorisé à ce canal')
  return ch
}

async function countUnreadForChannel(
  pool: Awaited<ReturnType<typeof getPool>>,
  channelId: number,
  userId: number,
  channelType: 'direct' | 'group',
  otherUserId?: number
): Promise<number> {
  const t = table(P2P_MESSAGES_TABLE)
  const tMeta = table('usermeta')
  await ensureMessagesTable(pool)
  const [readMetaRows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, `${CHANNEL_READ_META_PREFIX}${channelId}_last_read_at`]
  )
  const lastReadAt = readMetaRows?.[0]?.meta_value ? String(readMetaRows[0].meta_value).trim() : null
  if (channelType === 'group') {
    if (lastReadAt) {
      const [cRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as c FROM ${t} WHERE channel_id = ? AND sender_id != ? AND created_at > ?`,
        [channelId, userId, lastReadAt]
      )
      return Number(cRows?.[0]?.c ?? 0)
    }
    const [cRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as c FROM ${t} WHERE channel_id = ? AND sender_id != ?`,
      [channelId, userId]
    )
    return Number(cRows?.[0]?.c ?? 0)
  }
  const otherId = otherUserId ?? 0
  if (lastReadAt) {
    const [cRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as c FROM ${t} WHERE channel_id = ? AND sender_id = ? AND created_at > ?`,
      [channelId, otherId, lastReadAt]
    )
    return Number(cRows?.[0]?.c ?? 0)
  }
  const [cRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as c FROM ${t} WHERE channel_id = ? AND sender_id = ?`,
    [channelId, otherId]
  )
  return Number(cRows?.[0]?.c ?? 0)
}

/** Ouvre ou crée un dialogue 1:1 (membres du même lieu). */
export async function openDirectChannel(
  userId: number,
  targetUserId: number,
  communityId?: number
): Promise<{ channelId: number }> {
  const pool = getPool()
  if (!userId || !targetUserId) throw new Error('Utilisateurs requis')
  if (userId === targetUserId) throw new Error('Impossible de discuter avec soi-même')
  if (communityId) await verifyUsersInCommunity(pool, communityId, [userId, targetUserId])

  await ensureGroupChannelSupport(pool)
  await ensureSeedsAndLinksTables(pool)
  const tLinks = table('prairie_links')
  const tChannels = table('chat_channels')
  const ua = Math.min(userId, targetUserId)
  const ub = Math.max(userId, targetUserId)
  await pool.execute(`INSERT IGNORE INTO ${tLinks} (user_a, user_b) VALUES (?, ?)`, [ua, ub])
  await pool.execute(
    `INSERT IGNORE INTO ${tChannels} (user_a, user_b, channel_type) VALUES (?, ?, 'direct')`,
    [ua, ub]
  )
  const [chanRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tChannels} WHERE user_a = ? AND user_b = ? AND COALESCE(channel_type, 'direct') = 'direct' LIMIT 1`,
    [ua, ub]
  )
  const channelId = chanRows?.[0] ? Number(chanRows[0].id) : 0
  if (!channelId) throw new Error('Impossible de créer la conversation')
  return { channelId }
}

/** Ouvre ou crée un dialogue de groupe pour un lieu. */
export async function openGroupChannel(params: {
  creatorUserId: number
  communityId: number
  memberUserIds: number[]
  name?: string | null
}): Promise<{ channelId: number; isNew: boolean }> {
  const pool = getPool()
  const creatorId = params.creatorUserId
  if (!creatorId || !params.communityId) throw new Error('Paramètres requis')
  const others = params.memberUserIds.filter((id) => id > 0 && id !== creatorId)
  const allIds = [...new Set([creatorId, ...others])]
  if (allIds.length < 2) throw new Error('Sélectionnez au moins un autre membre')
  await verifyUsersInCommunity(pool, params.communityId, allIds)

  await ensureGroupChannelSupport(pool)
  const tChannels = table('chat_channels')
  const tMembers = table('chat_channel_members')
  const fingerprint = memberFingerprint(allIds)

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tChannels}
     WHERE channel_type = 'group' AND community_id = ? AND member_fingerprint = ? LIMIT 1`,
    [params.communityId, fingerprint]
  )
  if (existing?.length) {
    return { channelId: Number(existing[0].id), isNew: false }
  }

  const memberCount = allIds.length
  const defaultName =
    memberCount <= 3
      ? `Groupe (${memberCount} membres)`
      : `Groupe — ${memberCount} membres`
  const channelName = params.name?.trim() || defaultName

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [insertRes] = await conn.execute(
      `INSERT INTO ${tChannels}
        (user_a, user_b, channel_type, community_id, channel_name, member_fingerprint, created_by)
       VALUES (0, 1, 'group', ?, ?, ?, ?)`,
      [params.communityId, channelName, fingerprint, creatorId]
    )
    const channelId = Number((insertRes as { insertId?: number })?.insertId ?? 0)
    if (!channelId) throw new Error('Impossible de créer le groupe')
    await conn.execute(
      `UPDATE ${tChannels} SET user_b = ? WHERE id = ? AND channel_type = 'group'`,
      [channelId, channelId]
    )
    for (const uid of allIds) {
      await conn.execute(`INSERT IGNORE INTO ${tMembers} (channel_id, user_id) VALUES (?, ?)`, [
        channelId,
        uid,
      ])
    }
    await conn.commit()
    return { channelId, isNew: true }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/** Ajoute des membres du lieu à un groupe existant. */
export async function addMembersToGroupChannel(params: {
  channelId: number
  userId: number
  memberUserIds: number[]
}): Promise<{ channelId: number; memberIds: number[] }> {
  const pool = getPool()
  const channelId = Number(params.channelId)
  const userId = Number(params.userId)
  if (!channelId || !userId) throw Object.assign(new Error('Paramètres requis'), { status: 400 })

  const ch = await assertChannelAccess(pool, channelId, userId)
  if (String(ch.channel_type ?? 'direct') !== 'group') {
    throw Object.assign(new Error('Ce canal n\'est pas un groupe'), { status: 400 })
  }

  const communityId = ch.community_id ? Number(ch.community_id) : 0
  if (!communityId) throw Object.assign(new Error('Lieu du groupe introuvable'), { status: 400 })

  const tMembers = table('chat_channel_members')
  const tChannels = table('chat_channels')
  const [memberRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id FROM ${tMembers} WHERE channel_id = ?`,
    [channelId]
  )
  const currentIds = (memberRows ?? []).map((r) => Number(r.user_id)).filter((id) => id > 0)
  const toAdd = [...new Set(params.memberUserIds.map((id) => Number(id)).filter((id) => id > 0))].filter(
    (id) => !currentIds.includes(id)
  )

  if (!toAdd.length) {
    return { channelId, memberIds: currentIds }
  }

  await verifyUsersInCommunity(pool, communityId, toAdd)

  const allIds = [...new Set([...currentIds, ...toAdd])]
  const fingerprint = memberFingerprint(allIds)

  const [conflictRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tChannels}
     WHERE channel_type = 'group' AND community_id = ? AND member_fingerprint = ? AND id != ?
     LIMIT 1`,
    [communityId, fingerprint, channelId]
  )
  if (conflictRows?.length) {
    throw Object.assign(
      new Error('Un groupe avec exactement ces participants existe déjà'),
      { status: 409 }
    )
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const uid of toAdd) {
      await conn.execute(`INSERT IGNORE INTO ${tMembers} (channel_id, user_id) VALUES (?, ?)`, [
        channelId,
        uid,
      ])
    }
    await conn.execute(`UPDATE ${tChannels} SET member_fingerprint = ? WHERE id = ?`, [
      fingerprint,
      channelId,
    ])
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  return { channelId, memberIds: allIds }
}

/** IDs des autres participants (notifications). */
export async function getChannelRecipientIds(
  channelId: number,
  senderId: number
): Promise<number[]> {
  const pool = getPool()
  await ensureGroupChannelSupport(pool)
  const tCh = table('chat_channels')
  const tMembers = table('chat_channel_members')
  const [chRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_a, user_b, COALESCE(channel_type, 'direct') AS channel_type FROM ${tCh} WHERE id = ?`,
    [channelId]
  )
  if (!chRows?.length) return []
  const ch = chRows[0]
  if (String(ch.channel_type) === 'group') {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id FROM ${tMembers} WHERE channel_id = ? AND user_id != ?`,
      [channelId, senderId]
    )
    return (rows ?? []).map((r) => Number(r.user_id)).filter((id) => id > 0)
  }
  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  if (senderId === ua) return ub > 0 ? [ub] : []
  if (senderId === ub) return ua > 0 ? [ua] : []
  return []
}

/** Récupère les canaux de dialogue (La Clairière) de l'utilisateur */
export async function getMyChannels(
  userId: string,
  options?: { communityId?: number }
): Promise<{ channels: MyChannelRecord[] }> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id requis')
  const communityId = options?.communityId

  await touchSocialPresence(pool, uid)
  await ensureGroupChannelSupport(pool)

  const tChannels = table('chat_channels')
  const tLinks = table('prairie_links')
  const tMeta = table('usermeta')
  const tUsers = table('users')
  const tMembers = table('chat_channel_members')
  const tCommMembers = table('mandala_community_members')

  try {
    const [linkRows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_a, user_b FROM ${tLinks} WHERE user_a = ? OR user_b = ?`,
      [uid, uid]
    )
    for (const row of linkRows) {
      let ua = Number(row.user_a)
      let ub = Number(row.user_b)
      if (ua > 0 && ub > 0 && ua !== ub) {
        if (ua > ub) {
          const tmp = ua
          ua = ub
          ub = tmp
        }
        await pool.execute(
          `INSERT IGNORE INTO ${tChannels} (user_a, user_b, channel_type) VALUES (?, ?, 'direct')`,
          [ua, ub]
        )
      }
    }
  } catch {
    /* table may not exist */
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_a, user_b FROM ${tChannels}
     WHERE (user_a = ? OR user_b = ?) AND COALESCE(channel_type, 'direct') = 'direct'`,
    [uid, uid]
  )

  await ensureMessagesTable(pool)

  const list: MyChannelRecord[] = []

  let directRows = rows
  if (communityId) {
    const otherIds = directRows
      .map((r) => (Number(r.user_a) === uid ? Number(r.user_b) : Number(r.user_a)))
      .filter((id) => id > 0)
    if (!otherIds.length) {
      directRows = []
    } else {
      const placeholders = otherIds.map(() => '?').join(',')
      const [memberRows] = await pool.execute<RowDataPacket[]>(
        `SELECT user_id FROM ${tCommMembers} WHERE community_id = ? AND user_id IN (${placeholders})`,
        [communityId, ...otherIds]
      )
      const allowed = new Set((memberRows ?? []).map((r) => Number(r.user_id)))
      directRows = directRows.filter((r) => {
        const otherId = Number(r.user_a) === uid ? Number(r.user_b) : Number(r.user_a)
        return allowed.has(otherId)
      })
    }
  }

  const otherIds = directRows.map((r) =>
    Number(r.user_a) === uid ? Number(r.user_b) : Number(r.user_a)
  )
  const avatarMap = await fetchUsersAvatarMap(pool, otherIds)

  for (const r of directRows) {
    const otherId = Number(r.user_a) === uid ? Number(r.user_b) : Number(r.user_a)
    const [uRows] = await pool.execute<RowDataPacket[]>(`SELECT display_name FROM ${tUsers} WHERE ID = ?`, [otherId])
    const u = uRows[0]
    const [pRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'mdl_pseudo'`,
      [otherId]
    )
    const p = pRows[0]
    const pseudo =
      (p && String(p.meta_value ?? '').trim()) ||
      (u && String(u.display_name ?? '').trim()) ||
      `jardinier_${Buffer.from(String(otherId)).toString('hex').slice(0, 6)}`
    const [seenRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'mdl_social_last_seen_at' LIMIT 1`,
      [otherId]
    )
    const lastSeenAt = seenRows[0]?.meta_value ? String(seenRows[0].meta_value).trim() : ''
    const channelId = Number(r.id)
    const unreadCount = await countUnreadForChannel(pool, channelId, uid, 'direct', otherId)
    const av = avatarMap.get(otherId) ?? { avatar: null, avatarEmoji: '🌸' }
    list.push({
      channelId,
      channelType: 'direct',
      otherUserId: otherId,
      otherPseudo: pseudo,
      otherAvatar: av.avatar,
      otherAvatarEmoji: av.avatarEmoji,
      otherIsOnline: lastSeenAt ? isOnlineFromLastSeen(lastSeenAt) : false,
      otherLastSeenAt: lastSeenAt || null,
      unreadCount,
    })
  }

  let groupSql = `
    SELECT c.id, c.community_id, c.channel_name, c.member_fingerprint, c.created_by,
           c.channel_icon_emoji, c.channel_icon_image
    FROM ${tChannels} c
    INNER JOIN ${tMembers} m ON m.channel_id = c.id AND m.user_id = ?
    WHERE c.channel_type = 'group'`
  const groupArgs: Array<number> = [uid]
  if (communityId) {
    groupSql += ` AND c.community_id = ?`
    groupArgs.push(communityId)
  }
  const [groupRows] = await pool.execute<RowDataPacket[]>(groupSql, groupArgs)

  for (const gr of groupRows ?? []) {
    const channelId = Number(gr.id)
    const [memberIdRows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id FROM ${tMembers} WHERE channel_id = ? ORDER BY user_id`,
      [channelId]
    )
    const memberIds = (memberIdRows ?? []).map((r) => Number(r.user_id)).filter((id) => id > 0)
    const unreadCount = await countUnreadForChannel(pool, channelId, uid, 'group')
    const groupName = String(gr.channel_name ?? '').trim() || `Groupe (${memberIds.length})`
    list.push({
      channelId,
      channelType: 'group',
      communityId: gr.community_id ? Number(gr.community_id) : null,
      createdBy: gr.created_by != null ? Number(gr.created_by) : null,
      otherPseudo: groupName,
      otherAvatar: gr.channel_icon_image ? String(gr.channel_icon_image) : null,
      otherAvatarEmoji: String(gr.channel_icon_emoji ?? '').trim() || '👥',
      otherIsOnline: false,
      otherLastSeenAt: null,
      unreadCount,
      memberCount: memberIds.length,
      memberIds,
    })
  }

  await attachLastMessages(pool, list)
  return { channels: list }
}

function sqlDateToSortable(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 19).replace('T', ' ')
  }
  const s = String(value).trim()
  if (!s || s.startsWith('0000-00-00')) return null
  return s.slice(0, 19)
}

async function attachLastMessages(
  pool: Awaited<ReturnType<typeof getPool>>,
  list: MyChannelRecord[],
): Promise<void> {
  if (!list.length) return
  const tMsg = table(P2P_MESSAGES_TABLE)
  const ids = list.map((c) => c.channelId)
  const placeholders = ids.map(() => '?').join(',')
  try {
    const [lastRows] = await pool.execute<RowDataPacket[]>(
      `SELECT m.channel_id, m.body, m.card_slug, m.created_at
       FROM ${tMsg} m
       INNER JOIN (
         SELECT channel_id, MAX(id) AS mid
         FROM ${tMsg}
         WHERE channel_id IN (${placeholders})
         GROUP BY channel_id
       ) latest ON latest.mid = m.id`,
      ids,
    )
    const byId = new Map<number, { body: string; at: string | null }>()
    for (const row of lastRows ?? []) {
      const rawBody = String(row.body ?? '').replace(/\s+/g, ' ').trim()
      const body = (rawBody || (row.card_slug ? 'Carte' : '')).slice(0, 160)
      byId.set(Number(row.channel_id), {
        body,
        at: sqlDateToSortable(row.created_at),
      })
    }
    for (const ch of list) {
      const last = byId.get(ch.channelId)
      ch.lastMessage = last?.body || null
      ch.lastMessageAt = last?.at ?? null
    }
  } catch {
    /* table absente ou pas encore migrée */
  }
  list.sort((a, b) => {
    const ta = a.lastMessageAt ?? ''
    const tb = b.lastMessageAt ?? ''
    if (ta !== tb) return ta < tb ? 1 : -1
    return a.otherPseudo.localeCompare(b.otherPseudo, 'fr')
  })
}

export async function renameGroupChannel(params: {
  channelId: number
  userId: number
  name: string
}): Promise<{ channelId: number; name: string }> {
  const pool = getPool()
  await ensureGroupChannelSupport(pool)
  const channelId = Number(params.channelId)
  const userId = Number(params.userId)
  const name = String(params.name ?? '').trim()

  if (!channelId || !userId) throw new Error('Paramètres requis')
  if (!name) throw Object.assign(new Error('Nom requis'), { status: 400 })
  if (name.length > 60) throw Object.assign(new Error('Nom trop long (60 caractères max)'), { status: 400 })

  // Must be a member to access at all.
  await assertChannelAccess(pool, channelId, userId)

  const tCh = table('chat_channels')
  const [res] = await pool.execute(
    `UPDATE ${tCh}
     SET channel_name = ?
     WHERE id = ? AND channel_type = 'group' AND created_by = ?`,
    [name, channelId, userId]
  )
  const affected = Number((res as { affectedRows?: number })?.affectedRows ?? 0)
  if (!affected) {
    throw Object.assign(new Error('Seul le créateur peut renommer ce groupe'), { status: 403 })
  }
  return { channelId, name }
}

export async function updateGroupChannelIcon(params: {
  channelId: number
  userId: number
  emoji?: string | null
  image?: string | null
}): Promise<{ channelId: number }> {
  const pool = getPool()
  await ensureGroupChannelSupport(pool)

  const channelId = Number(params.channelId)
  const userId = Number(params.userId)
  const emojiRaw = params.emoji != null ? String(params.emoji) : ''
  const emoji = emojiRaw.trim() || null
  const imageRaw = params.image != null ? String(params.image) : ''
  const image = imageRaw.trim() || null

  if (!channelId || !userId) throw new Error('Paramètres requis')
  if (emoji && emoji.length > 16) throw Object.assign(new Error('Emoji trop long (16 max)'), { status: 400 })
  if (image && !isAvatarImageUrl(image)) throw Object.assign(new Error('Image invalide'), { status: 400 })

  // Must have access (member).
  await assertChannelAccess(pool, channelId, userId)

  const tCh = table('chat_channels')
  const [res] = await pool.execute(
    `UPDATE ${tCh}
     SET channel_icon_emoji = ?, channel_icon_image = ?
     WHERE id = ? AND channel_type = 'group' AND created_by = ?`,
    [emoji, image, channelId, userId]
  )

  const affected = Number((res as { affectedRows?: number })?.affectedRows ?? 0)
  if (!affected) {
    throw Object.assign(new Error('Seul le créateur peut modifier l’icône du groupe'), { status: 403 })
  }

  return { channelId }
}

/** Table dédiée P2P (évite conflit avec mdl_chat_messages du chat coach qui utilise conversation_id) */

function ensureMessagesTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  const t = table(P2P_MESSAGES_TABLE)
  return ensureOnce('social-messages', async () => {
      await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        channel_id INT NOT NULL,
        sender_id INT NOT NULL,
        body TEXT,
        card_slug VARCHAR(100) DEFAULT NULL,
        temperature VARCHAR(20) DEFAULT NULL,
        attachment_path VARCHAR(255) DEFAULT NULL,
        attachment_mime VARCHAR(127) DEFAULT NULL,
        attachment_name VARCHAR(255) DEFAULT NULL,
        attachment_size INT DEFAULT NULL,
        reply_to_id INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_channel (channel_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
      for (const [col, def] of [
        ['attachment_path', 'VARCHAR(255) NULL'],
        ['attachment_mime', 'VARCHAR(127) NULL'],
        ['attachment_name', 'VARCHAR(255) NULL'],
        ['attachment_size', 'INT NULL'],
        ['reply_to_id', 'INT NULL'],
      ] as const) {
        try {
          await pool.execute(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`)
        } catch {
          /* colonne déjà présente */
        }
      }
  }).then(() =>
    ensureOnce('social-messages-reply-to', async () => {
      try {
        await pool.execute(`ALTER TABLE ${t} ADD COLUMN reply_to_id INT NULL`)
      } catch {
        /* colonne déjà présente */
      }
    }),
  )
}

let _ensureReactionsTablePromise: Promise<void> | null = null

function ensureReactionsTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  if (!_ensureReactionsTablePromise) {
    const t = table(MESSAGE_REACTIONS_TABLE)
    _ensureReactionsTablePromise = pool
      .execute(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        emoji VARCHAR(16) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_message_user (message_id, user_id),
        INDEX idx_message (message_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
      .then(() => undefined)
      .catch(() => {
        _ensureReactionsTablePromise = null
      })
  }
  return _ensureReactionsTablePromise
}

function aggregateReactions(
  rows: RowDataPacket[],
): Record<number, MessageReactionSummary[]> {
  const byMessage = new Map<number, Map<string, number[]>>()
  for (const r of rows) {
    const messageId = Number(r.message_id)
    const uid = Number(r.user_id)
    const emoji = String(r.emoji ?? '')
    if (!messageId || !uid || !emoji) continue
    if (!byMessage.has(messageId)) byMessage.set(messageId, new Map())
    const emojis = byMessage.get(messageId)!
    if (!emojis.has(emoji)) emojis.set(emoji, [])
    emojis.get(emoji)!.push(uid)
  }
  const out: Record<number, MessageReactionSummary[]> = {}
  for (const [messageId, emojis] of byMessage) {
    out[messageId] = [...emojis.entries()].map(([emoji, userIds]) => ({ emoji, userIds }))
  }
  return out
}

export async function getReactionsForMessageIds(
  messageIds: number[],
): Promise<Record<number, MessageReactionSummary[]>> {
  if (messageIds.length === 0) return {}
  const pool = getPool()
  await ensureReactionsTable(pool)
  const t = table(MESSAGE_REACTIONS_TABLE)
  const placeholders = messageIds.map(() => '?').join(', ')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT message_id, user_id, emoji FROM ${t} WHERE message_id IN (${placeholders})`,
    messageIds,
  )
  return aggregateReactions(rows ?? [])
}

export async function toggleMessageReaction(
  messageId: number,
  userId: number,
  emoji: string,
): Promise<{ reactions: MessageReactionSummary[]; myEmoji: string | null }> {
  if (!isAllowedReactionEmoji(emoji)) throw new Error('Émoji non autorisé')
  const pool = getPool()
  await ensureMessagesTable(pool)
  await ensureReactionsTable(pool)
  const tMsg = table(P2P_MESSAGES_TABLE)
  const tRx = table(MESSAGE_REACTIONS_TABLE)

  const [msgRows] = await pool.execute<RowDataPacket[]>(
    `SELECT channel_id FROM ${tMsg} WHERE id = ? LIMIT 1`,
    [messageId],
  )
  const channelId = Number(msgRows?.[0]?.channel_id)
  if (!channelId) throw new Error('Message introuvable')

  await assertChannelAccess(pool, channelId, userId)

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id, emoji FROM ${tRx} WHERE message_id = ? AND user_id = ? LIMIT 1`,
    [messageId, userId],
  )
  const row = existing?.[0]
  if (row && String(row.emoji) === emoji) {
    await pool.execute(`DELETE FROM ${tRx} WHERE id = ?`, [Number(row.id)])
  } else if (row) {
    await pool.execute(`UPDATE ${tRx} SET emoji = ?, created_at = NOW() WHERE id = ?`, [
      emoji,
      Number(row.id),
    ])
  } else {
    await pool.execute(
      `INSERT INTO ${tRx} (message_id, user_id, emoji) VALUES (?, ?, ?)`,
      [messageId, userId, emoji],
    )
  }

  const reactionsMap = await getReactionsForMessageIds([messageId])
  const reactions = reactionsMap[messageId] ?? []
  const mine = reactions.find((r) => r.userIds.includes(userId))
  return { reactions, myEmoji: mine?.emoji ?? null }
}

export type ChannelMessage = {
  id: number
  senderId: number
  body: string | null
  cardSlug: string | null
  temperature: string | null
  createdAt: string
  attachment?: { mime: string; name: string; size: number } | null
  senderPseudo?: string | null
  senderAvatar?: string | null
  senderAvatarEmoji?: string | null
  reactions?: MessageReactionSummary[]
  replyTo?: MessageReplyQuote | null
}

const MESSAGE_COLUMNS = `id, sender_id, body, card_slug, temperature, created_at,
  attachment_path, attachment_mime, attachment_name, attachment_size, reply_to_id`

function attachmentFromRow(r: RowDataPacket): ChannelMessage['attachment'] {
  const path = r.attachment_path ? String(r.attachment_path) : ''
  if (!path) return null
  return {
    mime: r.attachment_mime ? String(r.attachment_mime) : 'application/octet-stream',
    name: r.attachment_name ? String(r.attachment_name) : 'fichier',
    size: Number(r.attachment_size ?? 0),
  }
}

/** Récupère les messages d'un canal (La Clairière) */
export async function getChannelMessages(
  channelId: number,
  userId: string
): Promise<ChannelMessage[]> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id requis')
  if (!channelId) throw new Error('channel_id requis')

  await touchSocialPresence(pool, uid)

  const tCh = table('chat_channels')
  const t = table(P2P_MESSAGES_TABLE)

  await assertChannelAccess(pool, channelId, uid)

  await ensureMessagesTable(pool)

  const tUsers = table('users')
  const tMeta = table('usermeta')

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT m.id, m.sender_id, m.body, m.card_slug, m.temperature, m.created_at,
            m.attachment_path, m.attachment_mime, m.attachment_name, m.attachment_size, m.reply_to_id,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', m.sender_id)) AS sender_pseudo,
            av.meta_value AS sender_avatar,
            COALESCE(em.meta_value, '🌸') AS sender_avatar_emoji
     FROM ${t} m
     JOIN ${tUsers} u ON u.ID = m.sender_id
     LEFT JOIN ${tMeta} p ON p.user_id = m.sender_id AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} av ON av.user_id = m.sender_id AND av.meta_key = 'mdl_avatar'
     LEFT JOIN ${tMeta} em ON em.user_id = m.sender_id AND em.meta_key = 'mdl_avatar_emoji'
     WHERE m.channel_id = ?
     ORDER BY m.created_at ASC`,
    [channelId],
  )

  const messages = (rows ?? []).map((r) => ({
    id: Number(r.id),
    senderId: Number(r.sender_id),
    body: r.body ? String(r.body) : null,
    cardSlug: r.card_slug ? String(r.card_slug) : null,
    temperature: r.temperature ? String(r.temperature) : null,
    createdAt: String(r.created_at ?? ''),
    attachment: attachmentFromRow(r),
    senderPseudo: r.sender_pseudo ? String(r.sender_pseudo) : null,
    senderAvatar: r.sender_avatar ? String(r.sender_avatar) : null,
    senderAvatarEmoji: r.sender_avatar_emoji ? String(r.sender_avatar_emoji) : null,
    replyToId: r.reply_to_id ? Number(r.reply_to_id) : null,
  }))

  const byId = new Map(messages.map((m) => [m.id, m]))
  const ids = messages.map((m) => m.id)
  const reactionsMap = await getReactionsForMessageIds(ids)
  return messages.map((m) => {
    const parent = m.replyToId ? byId.get(m.replyToId) : undefined
    const replyTo: MessageReplyQuote | null = m.replyToId
      ? parent
        ? {
            id: parent.id,
            senderId: parent.senderId,
            senderName: parent.senderPseudo || 'Membre',
            excerpt: messageReplyExcerpt({
              body: parent.body,
              cardSlug: parent.cardSlug,
              attachmentMime: parent.attachment?.mime,
              attachmentName: parent.attachment?.name,
            }),
          }
        : { id: m.replyToId, senderName: '', excerpt: '', missing: true }
      : null
    return {
      ...m,
      reactions: reactionsMap[m.id] ?? [],
      replyTo,
    }
  })
}

/** Récupère le timestamp de la dernière activité (created_at) du canal. */
export async function getChannelLastMessageAt(channelId: number, userId: string): Promise<string | null> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id requis')
  if (!channelId) throw new Error('channel_id requis')

  // Maintenir la cohérence présence (même logique que getChannelMessages)
  await touchSocialPresence(pool, uid)

  const tCh = table('chat_channels')
  const t = table(P2P_MESSAGES_TABLE)

  await assertChannelAccess(pool, channelId, uid)

  await ensureMessagesTable(pool)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT MAX(created_at) as last_at FROM ${t} WHERE channel_id = ?`,
    [channelId]
  )
  const r = rows?.[0]
  const last = r?.last_at ? String(r.last_at) : null
  return last && last.trim() ? last : null
}

/** Messages d'un canal après un curseur created_at (pour incrémental). */
export async function getChannelMessagesSince(
  channelId: number,
  userId: string,
  since: string
): Promise<ChannelMessage[]> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id requis')
  if (!channelId) throw new Error('channel_id requis')
  if (!since) throw new Error('since requis')

  await touchSocialPresence(pool, uid)

  const tCh = table('chat_channels')
  const t = table(P2P_MESSAGES_TABLE)

  await assertChannelAccess(pool, channelId, uid)

  await ensureMessagesTable(pool)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${MESSAGE_COLUMNS}
     FROM ${t}
     WHERE channel_id = ? AND created_at > ?
     ORDER BY created_at ASC`,
    [channelId, since]
  )

  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    senderId: Number(r.sender_id),
    body: r.body ? String(r.body) : null,
    cardSlug: r.card_slug ? String(r.card_slug) : null,
    temperature: r.temperature ? String(r.temperature) : null,
    createdAt: String(r.created_at ?? ''),
    attachment: attachmentFromRow(r),
  }))
}

/** Envoie un message dans un canal P2P */
export async function sendChannelMessage(
  channelId: number,
  senderId: number,
  payload: {
    body?: string | null
    cardSlug?: string | null
    attachment?: { path: string; mime: string; name: string; size: number } | null
    replyToId?: number | null
  }
): Promise<ChannelMessage> {
  const pool = getPool()
  const text = payload.body ? String(payload.body).trim() : null
  const cardSlug = payload.cardSlug ? String(payload.cardSlug).trim() || null : null
  const attachment = payload.attachment?.path ? payload.attachment : null
  if (!text && !cardSlug && !attachment) throw new Error('body ou cardSlug requis')

  await touchSocialPresence(pool, senderId)

  const t = table(P2P_MESSAGES_TABLE)

  await assertChannelAccess(pool, channelId, senderId)

  await ensureMessagesTable(pool)

  const requestedReply = payload.replyToId ? Number(payload.replyToId) : 0
  let replyToId: number | null = null
  if (requestedReply > 0) {
    const [parentRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${t} WHERE id = ? AND channel_id = ? LIMIT 1`,
      [requestedReply, channelId]
    )
    if (!parentRows?.[0]) {
      throw Object.assign(new Error('Message d’origine introuvable'), { status: 400 })
    }
    replyToId = requestedReply
  }

  await pool.execute(
    `INSERT INTO ${t} (channel_id, sender_id, body, card_slug, temperature, created_at, attachment_path, attachment_mime, attachment_name, attachment_size, reply_to_id)
     VALUES (?, ?, ?, ?, 'calm', NOW(), ?, ?, ?, ?, ?)`,
    [
      channelId,
      senderId,
      text ?? null,
      cardSlug,
      attachment?.path ?? null,
      attachment?.mime ?? null,
      attachment?.name ?? null,
      attachment?.size ?? null,
      replyToId,
    ]
  )

  const [inserted] = await pool.execute<RowDataPacket[]>(
    `SELECT ${MESSAGE_COLUMNS} FROM ${t} WHERE channel_id = ? ORDER BY id DESC LIMIT 1`,
    [channelId]
  )
  const r = inserted?.[0]
  if (!r) throw new Error('Impossible de récupérer le message créé')

  return {
    id: Number(r.id),
    senderId: Number(r.sender_id),
    body: r.body ? String(r.body) : null,
    cardSlug: r.card_slug ? String(r.card_slug) : null,
    temperature: r.temperature ? String(r.temperature) : null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    attachment: attachmentFromRow(r),
    replyTo: replyToId ? await loadReplyQuote(pool, channelId, replyToId) : null,
  }
}

async function loadReplyQuote(
  pool: ReturnType<typeof getPool>,
  channelId: number,
  replyToId: number,
): Promise<MessageReplyQuote | null> {
  const t = table(P2P_MESSAGES_TABLE)
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT m.id, m.sender_id, m.body, m.card_slug, m.attachment_mime, m.attachment_name,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', m.sender_id)) AS sender_pseudo
     FROM ${t} m
     JOIN ${tUsers} u ON u.ID = m.sender_id
     LEFT JOIN ${tMeta} p ON p.user_id = m.sender_id AND p.meta_key = 'mdl_pseudo'
     WHERE m.id = ? AND m.channel_id = ?
     LIMIT 1`,
    [replyToId, channelId]
  )
  const parent = rows?.[0]
  if (!parent) return { id: replyToId, senderName: '', excerpt: '', missing: true }
  return {
    id: Number(parent.id),
    senderId: Number(parent.sender_id),
    senderName: parent.sender_pseudo ? String(parent.sender_pseudo) : 'Membre',
    excerpt: messageReplyExcerpt({
      body: parent.body ? String(parent.body) : null,
      cardSlug: parent.card_slug ? String(parent.card_slug) : null,
      attachmentMime: parent.attachment_mime ? String(parent.attachment_mime) : null,
      attachmentName: parent.attachment_name ? String(parent.attachment_name) : null,
    }),
  }
}

export async function getMessageMedia(
  messageId: number,
  userId: number
): Promise<{ path: string; mime: string; name: string } | null> {
  const pool = getPool()
  await ensureMessagesTable(pool)
  const t = table(P2P_MESSAGES_TABLE)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT channel_id, attachment_path, attachment_mime, attachment_name FROM ${t} WHERE id = ? LIMIT 1`,
    [messageId]
  )
  const row = rows?.[0]
  if (!row?.attachment_path) return null
  await assertChannelAccess(pool, Number(row.channel_id), userId)
  return {
    path: String(row.attachment_path),
    mime: row.attachment_mime ? String(row.attachment_mime) : 'application/octet-stream',
    name: row.attachment_name ? String(row.attachment_name) : 'fichier',
  }
}


/** Retourne le nombre de messages non lus (La Clairière) pour l'utilisateur */
export async function getClairiereUnreadCount(userId: string): Promise<number> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) return 0

  const tCh = table('chat_channels')
  const t = table(P2P_MESSAGES_TABLE)
  const tMeta = table('usermeta')
  const tMembers = table('chat_channel_members')
  const metaPrefix = CHANNEL_READ_META_PREFIX

  await ensureGroupChannelSupport(pool)
  await ensureMessagesTable(pool)

  // Direct channels
  const [directRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(sub.cnt), 0) AS total
     FROM (
       SELECT COUNT(m.id) AS cnt
       FROM ${tCh} c
       JOIN ${t} m
         ON m.channel_id = c.id
         AND m.sender_id != ?
       LEFT JOIN ${tMeta} um
         ON um.user_id = ?
         AND um.meta_key = CONCAT(?, c.id, '_last_read_at')
       WHERE (c.user_a = ? OR c.user_b = ?)
         AND COALESCE(c.channel_type, 'direct') = 'direct'
         AND (um.meta_value IS NULL OR m.created_at > um.meta_value)
       GROUP BY c.id
     ) sub`,
    [uid, uid, metaPrefix, uid, uid]
  )

  // Group channels
  const [groupRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(sub.cnt), 0) AS total
     FROM (
       SELECT COUNT(m.id) AS cnt
       FROM ${tCh} c
       INNER JOIN ${tMembers} cm ON cm.channel_id = c.id AND cm.user_id = ?
       JOIN ${t} m
         ON m.channel_id = c.id
         AND m.sender_id != ?
       LEFT JOIN ${tMeta} um
         ON um.user_id = ?
         AND um.meta_key = CONCAT(?, c.id, '_last_read_at')
       WHERE c.channel_type = 'group'
         AND (um.meta_value IS NULL OR m.created_at > um.meta_value)
       GROUP BY c.id
     ) sub`,
    [uid, uid, uid, metaPrefix]
  )

  return Number(directRows?.[0]?.total ?? 0) + Number(groupRows?.[0]?.total ?? 0)
}

/** Retourne l'ID de l'autre utilisateur dans un canal (pour notifications) */
export async function getOtherUserIdInChannel(
  channelId: number,
  currentUserId: number
): Promise<number | null> {
  const pool = getPool()
  const tCh = table('chat_channels')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_a, user_b FROM ${tCh} WHERE id = ? LIMIT 1`,
    [channelId]
  )
  if (!rows?.length) return null
  const ua = Number(rows[0].user_a)
  const ub = Number(rows[0].user_b)
  if (currentUserId === ua) return ub
  if (currentUserId === ub) return ua
  return null
}

/** Retourne le lieu et l'interlocuteur pour ouvrir un canal depuis une notification. */
export async function getChannelNavigationContext(
  channelId: number,
  userId: number
): Promise<{
  channelId: number
  channelType: 'direct' | 'group'
  communitySlug: string | null
  otherUserId: number | null
}> {
  const pool = getPool()
  const ch = await assertChannelAccess(pool, channelId, userId)
  const channelType = String(ch.channel_type ?? 'direct') === 'group' ? 'group' : 'direct'

  if (channelType === 'group') {
    const communityId = ch.community_id ? Number(ch.community_id) : null
    const communitySlug = communityId ? await getCommunitySlugById(pool, communityId) : null
    return { channelId, channelType, communitySlug, otherUserId: null }
  }

  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  const otherUserId = userId === ua ? ub : ua
  const communitySlug =
    otherUserId > 0 ? await getSharedCommunitySlug(pool, userId, otherUserId) : null
  return { channelId, channelType, communitySlug, otherUserId: otherUserId > 0 ? otherUserId : null }
}

async function getCommunitySlugById(
  pool: Awaited<ReturnType<typeof getPool>>,
  communityId: number
): Promise<string | null> {
  const tC = table('mandala_communities')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT slug FROM ${tC} WHERE id = ? AND is_active = 1 LIMIT 1`,
    [communityId]
  )
  return rows?.[0]?.slug ? String(rows[0].slug) : null
}

async function getSharedCommunitySlug(
  pool: Awaited<ReturnType<typeof getPool>>,
  userIdA: number,
  userIdB: number
): Promise<string | null> {
  const tComm = table('mandala_communities')
  const tMem = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.slug
     FROM ${tMem} m1
     INNER JOIN ${tMem} m2 ON m1.community_id = m2.community_id
     INNER JOIN ${tComm} c ON c.id = m1.community_id AND c.is_active = 1
     WHERE m1.user_id = ? AND m2.user_id = ?
     ORDER BY c.name ASC
     LIMIT 1`,
    [userIdA, userIdB]
  )
  return rows?.[0]?.slug ? String(rows[0].slug) : null
}

/**
 * Nouveau message : push appareil uniquement.
 * Le badge Messages couvre la liste in-app ; pas d'entrée dans la cloche.
 */
export async function createClairiereMessageNotification(
  channelId: number,
  senderId: number,
  recipientId: number,
  body: string | null,
  cardSlug: string | null
): Promise<void> {
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')

  const [senderRows] = await pool.execute<RowDataPacket[]>(
    `SELECT display_name FROM ${tUsers} WHERE ID = ? LIMIT 1`,
    [senderId]
  )
  let pseudo = senderRows?.[0]?.display_name ? String(senderRows[0].display_name).trim() : ''
  if (!pseudo) {
    const [metaRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'mdl_pseudo' LIMIT 1`,
      [senderId]
    )
    pseudo = metaRows?.[0]?.meta_value ? String(metaRows[0].meta_value).trim() : 'Quelqu\'un'
  }
  if (!pseudo) pseudo = 'Quelqu\'un'

  let actionUrl = `/clairiere/${channelId}`
  try {
    const ctx = await getChannelNavigationContext(channelId, recipientId)
    const params = new URLSearchParams({ channelId: String(channelId) })
    if (ctx.communitySlug) params.set('community', ctx.communitySlug)
    actionUrl = `mandala:messages?${params.toString()}`
  } catch {
    /* garder l'URL legacy */
  }
  const bodyText = cardSlug
    ? `${pseudo} a partagé une carte avec vous`
    : body
      ? `${pseudo} : ${body.length > 75 ? `${body.slice(0, 72)}...` : body}`
      : `${pseudo} vous a envoyé un message`
  const title = 'Nouveau message'

  try {
    const { sendFcmPush } = await import('./fcm')
    await sendFcmPush(recipientId, null, title, bodyText, actionUrl)
  } catch {
    /* push optionnel, ne pas faire échouer l'envoi */
  }
}

/**
 * Curseur de lecture de l’autre personne (canaux direct uniquement).
 * Sert aux coches « lu » côté expéditeur. Null en groupe ou si jamais ouvert.
 */
export async function getDirectPeerLastReadAt(
  channelId: number,
  userId: string
): Promise<string | null> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid || !channelId) return null

  const ch = await assertChannelAccess(pool, channelId, uid)
  if (String(ch.channel_type ?? 'direct') === 'group') return null

  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  const peerId = uid === ua ? ub : ua
  if (!peerId) return null

  const tMeta = table('usermeta')
  const metaKey = `${CHANNEL_READ_META_PREFIX}${channelId}_last_read_at`
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [peerId, metaKey]
  )
  const raw = rows?.[0]?.meta_value ? String(rows[0].meta_value).trim() : ''
  return raw || null
}

/**
 * Premier message des autres encore non lu, d'après le curseur enregistré
 * avant que l'ouverture du fil ne le fasse avancer.
 */
export async function getChannelUnreadMarker(
  channelId: number,
  userId: string
): Promise<{ unreadFromMessageId: number | null; unreadCount: number }> {
  const empty = { unreadFromMessageId: null, unreadCount: 0 }
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid || !channelId) return empty

  const t = table(P2P_MESSAGES_TABLE)
  const tMeta = table('usermeta')
  await ensureMessagesTable(pool)
  const metaKey = `${CHANNEL_READ_META_PREFIX}${channelId}_last_read_at`
  const [readMetaRows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [uid, metaKey]
  )
  const lastReadAt = readMetaRows?.[0]?.meta_value ? String(readMetaRows[0].meta_value).trim() : ''
  if (!lastReadAt) return empty

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM ${t} WHERE channel_id = ? AND sender_id != ? AND created_at > ?`,
    [channelId, uid, lastReadAt]
  )
  const unreadCount = Number(countRows?.[0]?.c ?? 0)
  if (!unreadCount) return empty

  const [firstRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${t}
     WHERE channel_id = ? AND sender_id != ? AND created_at > ?
     ORDER BY created_at ASC, id ASC
     LIMIT 1`,
    [channelId, uid, lastReadAt]
  )
  const unreadFromMessageId = firstRows?.[0]?.id ? Number(firstRows[0].id) : null
  return { unreadFromMessageId, unreadCount }
}

/** Ouvrir le fil retire les alertes de chat correspondantes des non lues. */
async function markChatNotificationsReadForChannel(
  pool: Awaited<ReturnType<typeof getPool>>,
  channelId: number,
  userId: number
): Promise<void> {
  const tN = table('notifications')
  const tD = table('notification_deliveries')
  try {
    await pool.execute(
      `UPDATE ${tD} d
       JOIN ${tN} n ON n.id = d.notification_id
       SET d.read_at = COALESCE(d.read_at, NOW())
       WHERE d.user_id = ?
         AND d.read_at IS NULL
         AND (
           n.channel_id = ?
           OR (n.source_type = 'clairiere_channel' AND n.source_id = ?)
         )`,
      [userId, channelId, channelId]
    )
    const { invalidateNotifUnreadCache } = await import('./db-notifications')
    invalidateNotifUnreadCache(userId)
  } catch {
    /* les messages restent suivis par le badge Messages */
  }
}

/** Marque un canal comme lu par l'utilisateur */
export async function markChannelAsRead(channelId: number, userId: string): Promise<void> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid || !channelId) return

  const tMeta = table('usermeta')
  const metaKey = `${CHANNEL_READ_META_PREFIX}${channelId}_last_read_at`
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  await assertChannelAccess(pool, channelId, uid)
  await markChatNotificationsReadForChannel(pool, channelId, uid)

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = ?`,
    [uid, metaKey]
  )
  if (existing.length > 0) {
    await pool.execute(`UPDATE ${tMeta} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`, [now, uid, metaKey])
  } else {
    await pool.execute(`INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [uid, metaKey, now])
  }
}

/** Crée les tables seeds et prairie_links si besoin */
async function ensureSeedsAndLinksTables(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  const tSeeds = table('social_seeds')
  const tLinks = table('prairie_links')
  const tChannels = table('chat_channels')
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${tSeeds} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_user_id INT NOT NULL,
        to_user_id INT NOT NULL,
        intention_id VARCHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        sap_spent INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_to_user (to_user_id, status),
        INDEX idx_from_user (from_user_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  } catch {
    /* exists */
  }
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${tLinks} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_a INT NOT NULL,
        user_b INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_pair (user_a, user_b),
        CHECK (user_a < user_b)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  } catch {
    /* exists */
  }
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${tChannels} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_a INT NOT NULL,
        user_b INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_pair (user_a, user_b)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  } catch {
    /* exists */
  }
}

/** L'envoi de graines entre utilisateurs a été retiré. */
export async function sendSeed(
  _fromUserId: number,
  _toUserId: number,
  _intentionId: string
): Promise<{ seedId: number }> {
  throw new Error("L'envoi de graines entre utilisateurs n'est plus disponible")
}

/** Accepte une graine, crée le lien et le canal, retourne channelId */
export async function acceptSeedConnection(
  seedId: number,
  acceptorUserId: number
): Promise<{ channelId: number }> {
  const pool = getPool()
  if (!seedId || !acceptorUserId) throw new Error('seedId et acceptorUserId requis')

  await ensureSeedsAndLinksTables(pool)
  const tSeeds = table('social_seeds')
  const tLinks = table('prairie_links')
  const tChannels = table('chat_channels')

  const [seedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, from_user_id, to_user_id, status FROM ${tSeeds} WHERE id = ?`,
    [seedId]
  )
  const seed = seedRows?.[0]
  if (!seed) throw new Error('Graine introuvable')
  if (Number(seed.to_user_id) !== acceptorUserId) throw new Error('Seul le destinataire peut accepter cette graine')
  if (String(seed.status) !== 'pending') throw new Error('Cette graine a déjà été traitée')

  const fromUserId = Number(seed.from_user_id)
  const toUserId = Number(seed.to_user_id)
  const ua = Math.min(fromUserId, toUserId)
  const ub = Math.max(fromUserId, toUserId)

  await pool.execute(`UPDATE ${tSeeds} SET status = 'accepted', updated_at = NOW() WHERE id = ?`, [seedId])
  await pool.execute(`INSERT IGNORE INTO ${tLinks} (user_a, user_b) VALUES (?, ?)`, [ua, ub])
  await pool.execute(
    `INSERT IGNORE INTO ${tChannels} (user_a, user_b, channel_type) VALUES (?, ?, 'direct')`,
    [ua, ub]
  )

  const [chanRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tChannels} WHERE user_a = ? AND user_b = ?`,
    [ua, ub]
  )
  const channelId = chanRows?.[0] ? Number(chanRows[0].id) : 0
  if (!channelId) throw new Error('Impossible de récupérer le canal')
  return { channelId }
}

export type PendingSeed = {
  id: number
  from_user_id: number
  to_user_id: number
  intention_id: string
  created_at: string | null
  from_pseudo?: string
  from_avatar?: string | null
  from_avatar_emoji?: string
}

export async function listPendingSeedsIncoming(params: {
  userId: number
  intentionIds?: string[]
  limit?: number
}): Promise<PendingSeed[]> {
  const uid = Number(params.userId)
  if (!uid) throw new Error('userId requis')
  const pool = getPool()
  await ensureSeedsAndLinksTables(pool)
  const tSeeds = table('social_seeds')
  const tMeta = table('usermeta')
  const tUsers = table('users')
  const limit = Math.min(200, Math.max(1, Number(params.limit ?? 50)))
  const intentionIds = (params.intentionIds ?? []).map((s) => String(s).trim()).filter(Boolean)

  let where = `s.to_user_id = ? AND s.status = 'pending'`
  const args: Array<string | number> = [uid]
  if (intentionIds.length > 0) {
    where += ` AND s.intention_id IN (${intentionIds.map(() => '?').join(',')})`
    args.push(...intentionIds)
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.from_user_id, s.to_user_id, s.intention_id, s.created_at,
            COALESCE(p.meta_value, u.display_name, CONCAT('user_', s.from_user_id)) AS from_pseudo,
            COALESCE(a.meta_value, '') AS from_avatar,
            COALESCE(e.meta_value, '🌸') AS from_avatar_emoji
     FROM ${tSeeds} s
     JOIN ${tUsers} u ON u.ID = s.from_user_id
     LEFT JOIN ${tMeta} p ON p.user_id = s.from_user_id AND p.meta_key = 'mdl_pseudo'
     LEFT JOIN ${tMeta} a ON a.user_id = s.from_user_id AND a.meta_key = 'mdl_avatar'
     LEFT JOIN ${tMeta} e ON e.user_id = s.from_user_id AND e.meta_key = 'mdl_avatar_emoji'
     WHERE ${where}
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [...args, limit]
  )
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    from_user_id: Number(r.from_user_id),
    to_user_id: Number(r.to_user_id),
    intention_id: String(r.intention_id ?? '').trim(),
    created_at: r.created_at ? String(r.created_at) : null,
    from_pseudo: r.from_pseudo ? String(r.from_pseudo) : undefined,
    from_avatar: r.from_avatar ? String(r.from_avatar) : null,
    from_avatar_emoji: String(r.from_avatar_emoji ?? '🌸'),
  }))
}

export async function rejectSeedConnection(params: {
  seedId: number
  rejectorUserId: number
}): Promise<void> {
  const seedId = Number(params.seedId)
  const rejector = Number(params.rejectorUserId)
  if (!seedId || !rejector) throw new Error('seedId et rejectorUserId requis')
  const pool = getPool()
  await ensureSeedsAndLinksTables(pool)
  const tSeeds = table('social_seeds')
  const [seedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, to_user_id, status FROM ${tSeeds} WHERE id = ?`,
    [seedId]
  )
  const seed = seedRows?.[0]
  if (!seed) throw new Error('Graine introuvable')
  if (Number(seed.to_user_id) !== rejector) throw new Error('Seul le destinataire peut refuser cette graine')
  if (String(seed.status) !== 'pending') throw new Error('Cette graine a déjà été traitée')
  await pool.execute(`UPDATE ${tSeeds} SET status = 'rejected', updated_at = NOW() WHERE id = ?`, [seedId])
}

/** Visite la Lisière d'un utilisateur (profil public, relation, graines) */
export async function visitLisiere(
  visitorUserId: number,
  targetUserId: number
): Promise<{
  userId: string
  pseudo: string
  avatar: string | null
  avatarEmoji: string
  fleurMoyenne: { petals: number[]; lastUpdated?: string }
  relationStatusWithVisitor: 'none' | 'pending_out' | 'pending_in' | 'accepted'
  social?: { rosee_received_total: number; rosee_received_today: number; pollen_received_total: number; pollen_received_today: number }
}> {
  const pool = getPool()
  if (visitorUserId === targetUserId) throw new Error('user_id doit être différent du visiteur')

  await touchSocialPresence(pool, visitorUserId)
  await ensureSeedsAndLinksTables(pool)

  const tMeta = table('usermeta')
  const tUsers = table('users')
  const tRes = table('amour_results')
  const tLinks = table('prairie_links')
  const tSeeds = table('social_seeds')

  const [userRows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID, u.display_name,
      COALESCE(um_pseudo.meta_value, '') AS pseudo,
      COALESCE(um_avatar.meta_value, '') AS avatar,
      COALESCE(um_emoji.meta_value, '🌸') AS avatar_emoji
    FROM ${tUsers} u
    INNER JOIN ${tMeta} um_pub ON um_pub.user_id = u.ID AND um_pub.meta_key = 'mdl_profile_public' AND um_pub.meta_value = '1'
    LEFT JOIN ${tMeta} um_pseudo ON um_pseudo.user_id = u.ID AND um_pseudo.meta_key = 'mdl_pseudo'
    LEFT JOIN ${tMeta} um_avatar ON um_avatar.user_id = u.ID AND um_avatar.meta_key = 'mdl_avatar'
    LEFT JOIN ${tMeta} um_emoji ON um_emoji.user_id = u.ID AND um_emoji.meta_key = 'mdl_avatar_emoji'
    WHERE u.ID = ?`,
    [targetUserId]
  )
  const target = userRows?.[0]
  if (!target) throw new Error('Profil non trouvé ou non public')
  const pseudo =
    String(target.pseudo ?? '').trim() ||
    String(target.display_name ?? '').trim() ||
    `jardinier_${Buffer.from(String(targetUserId)).toString('hex').slice(0, 6)}`
  const avatarRaw = target.avatar ? String(target.avatar).trim() : ''
  const avatar = avatarRaw || null
  const avatarEmoji = String(target.avatar_emoji ?? '🌸').trim() || '🌸'

  const petals = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
  let petalsNorm: number[] = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]
  let lastUpdated: string | undefined
  try {
    const [resRows] = await pool.execute<RowDataPacket[]>(
      `SELECT agape, philautia, mania, storge, pragma, philia, ludus, eros, created_at FROM ${tRes} WHERE user_id = ? AND (parent_id IS NULL OR parent_id = 0) ORDER BY created_at DESC LIMIT 1`,
      [targetUserId]
    )
    const row = resRows?.[0]
    if (row) {
      const scores = petals.map((p) => Number(row[p] ?? 0))
      const maxVal = Math.max(1, ...scores)
      petalsNorm = scores.map((v) => (maxVal > 0 ? Math.min(1, v / maxVal) : 0.3))
      lastUpdated = row.created_at ? String(row.created_at) : undefined
    }
  } catch {
    /* ignore */
  }

  let relationStatus: 'none' | 'pending_out' | 'pending_in' | 'accepted' = 'none'
  const ua = Math.min(visitorUserId, targetUserId)
  const ub = Math.max(visitorUserId, targetUserId)
  try {
    const [linkRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM ${tLinks} WHERE user_a = ? AND user_b = ?`,
      [ua, ub]
    )
    if (linkRows?.length) {
      relationStatus = 'accepted'
    } else {
      const [seedOut] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM ${tSeeds} WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
        [visitorUserId, targetUserId]
      )
      if (seedOut?.length) relationStatus = 'pending_out'
      else {
        const [seedIn] = await pool.execute<RowDataPacket[]>(
          `SELECT id FROM ${tSeeds} WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
          [targetUserId, visitorUserId]
        )
        if (seedIn?.length) relationStatus = 'pending_in'
      }
    }
  } catch {
    /* ignore */
  }

  return {
    userId: String(targetUserId),
    pseudo,
    avatar,
    avatarEmoji,
    fleurMoyenne: { petals: petalsNorm, lastUpdated },
    relationStatusWithVisitor: relationStatus,
  }
}
