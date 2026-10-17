/**
 * La Clairière (social / canaux chat) — MariaDB.
 */
import type { RowDataPacket } from 'mysql2'
import { ensureOnce, exec, getPool, table } from './db'
import { cacheDelPrefix } from './server-cache'
import { isAllowedReactionEmoji, type MessageReactionSummary } from './message-reactions'
import { messageReplyExcerpt, type MessageReplyQuote } from './chat-attachments'
import { isAvatarImageUrl } from './user-avatar'
import { removeUpload } from './resource-files'
import { invalidateNotifUnreadCache } from './db-notifications'

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
  channelKind?: 'core' | null
  lastMessage?: string | null
  lastMessageAt?: string | null
  /** Conversation visible ici grâce à une rencontre acceptée, pas à l'appartenance au lieu. */
  viaMeet?: boolean
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

/** Empreinte stable : une conversation « Groupe cœur » par lieu, indépendante des participants. */
export const CORE_CHANNEL_FINGERPRINT = 'core'
export const CORE_CHANNEL_NAME = 'Groupe cœur'

export function isCoreChannelFingerprint(fingerprint: unknown): boolean {
  return String(fingerprint ?? '') === CORE_CHANNEL_FINGERPRINT
}

function assertNotCoreChannel(ch: RowDataPacket): void {
  if (isCoreChannelFingerprint(ch.member_fingerprint)) {
    throw Object.assign(
      new Error('Cette conversation suit le groupe cœur du lieu'),
      { status: 403 }
    )
  }
}

function normalizeGroupName(name: string): string {
  return name
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Groupe cœur déjà nommé à la main (ex. « Le Coeur de Shambala »), sans empreinte `core`. */
function isHeartGroupName(name: string): boolean {
  return normalizeGroupName(name).includes('coeur')
}

/** Groupe cœur, puis les autres groupes, puis les conversations à deux. */
function conversationListTier(ch: MyChannelRecord): number {
  if (ch.channelType !== 'group') return 2
  if (ch.channelKind === 'core' || isHeartGroupName(ch.otherPseudo) || isLegacyCoreGroupName(ch.otherPseudo)) return 0
  return 1
}

/** Conversation créée à la main avant le cercle, pour Sivanà. */
function isLegacyCoreGroupName(name: string): boolean {
  const n = normalizeGroupName(name)
  return n.includes('noyau') && n.includes('abricot')
}

async function countChannelMessages(
  pool: Awaited<ReturnType<typeof getPool>>,
  channelId: number
): Promise<number> {
  const t = table(P2P_MESSAGES_TABLE)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM ${t} WHERE channel_id = ?`,
    [channelId]
  )
  return Number(rows[0]?.n ?? 0)
}

/**
 * Reprend la conversation déjà nommée (Noyau d'Abricots) comme groupe cœur.
 * Le fil automatique « Groupe cœur », s'il est vide, est retiré.
 */
async function adoptLegacyCoreChannel(
  pool: Awaited<ReturnType<typeof getPool>>,
  communityId: number,
  currentCoreId: number
): Promise<number> {
  const tChannels = table('chat_channels')
  const tMembers = table('chat_channel_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, channel_name, created_by, member_fingerprint
     FROM ${tChannels}
     WHERE channel_type = 'group' AND community_id = ?`,
    [communityId]
  )
  const legacy = (rows ?? []).find(
    (r) =>
      !isCoreChannelFingerprint(r.member_fingerprint) &&
      isLegacyCoreGroupName(String(r.channel_name ?? ''))
  )
  if (!legacy) return currentCoreId
  const legacyId = Number(legacy.id)
  if (!legacyId || legacyId === currentCoreId) return currentCoreId || legacyId

  if (currentCoreId) {
    const messages = await countChannelMessages(pool, currentCoreId)
    const current = (rows ?? []).find((r) => Number(r.id) === currentCoreId)
    const disposable =
      messages === 0 && Number(current?.created_by ?? 0) === 0
    if (!disposable) return currentCoreId
    await pool.execute(`DELETE FROM ${tMembers} WHERE channel_id = ?`, [currentCoreId])
    await pool.execute(`DELETE FROM ${tChannels} WHERE id = ? AND channel_type = 'group'`, [
      currentCoreId,
    ])
  }

  await pool.execute(
    `UPDATE ${tChannels} SET member_fingerprint = ? WHERE id = ? AND channel_type = 'group'`,
    [CORE_CHANNEL_FINGERPRINT, legacyId]
  )
  return legacyId
}

async function assertPlaceManagerCanRename(
  pool: Awaited<ReturnType<typeof getPool>>,
  communityId: number,
  userId: number
): Promise<void> {
  const tM = table('mandala_community_members')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT role FROM ${tM} WHERE community_id = ? AND user_id = ? LIMIT 1`,
    [communityId, userId]
  )
  const role = String(rows[0]?.role ?? '')
  if (role !== 'organizer' && role !== 'admin') {
    throw Object.assign(
      new Error('Seuls les gestionnaires du lieu peuvent renommer cette conversation'),
      { status: 403 }
    )
  }
}

/**
 * Crée ou met à jour la conversation du groupe cœur.
 * Participants : personnes cochées et gestionnaires du lieu.
 * Pas de conversation tant que personne n’est dans le cercle.
 */
export async function syncPlaceCoreChannel(communityId: number): Promise<void> {
  if (!communityId) return
  const { ensureCommunitiesTables } = await import('./db-communities')
  await ensureCommunitiesTables()
  const pool = getPool()
  await ensureGroupChannelSupport(pool)
  const tMembersCommunity = table('mandala_community_members')
  const tChannels = table('chat_channels')
  const tMembers = table('chat_channel_members')

  const [people] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, role, circle FROM ${tMembersCommunity} WHERE community_id = ?`,
    [communityId]
  )
  const coreIds = (people ?? [])
    .filter((r) => String(r.circle ?? '') === 'core')
    .map((r) => Number(r.user_id))
    .filter((id) => id > 0)
  const managerIds = (people ?? [])
    .filter((r) => {
      const role = String(r.role ?? '')
      return role === 'organizer' || role === 'admin'
    })
    .map((r) => Number(r.user_id))
    .filter((id) => id > 0)
  const participantIds = [...new Set([...coreIds, ...managerIds])]

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tChannels}
     WHERE channel_type = 'group' AND community_id = ? AND member_fingerprint = ? LIMIT 1`,
    [communityId, CORE_CHANNEL_FINGERPRINT]
  )
  let channelId = await adoptLegacyCoreChannel(
    pool,
    communityId,
    existing?.[0] ? Number(existing[0].id) : 0
  )
  if (!channelId && coreIds.length === 0) return

  if (!channelId) {
    try {
      const [insertRes] = await pool.execute(
        `INSERT INTO ${tChannels}
          (user_a, user_b, channel_type, community_id, channel_name, channel_icon_emoji, member_fingerprint, created_by)
         VALUES (0, 1, 'group', ?, ?, '◎', ?, 0)`,
        [communityId, CORE_CHANNEL_NAME, CORE_CHANNEL_FINGERPRINT]
      )
      channelId = Number((insertRes as { insertId?: number })?.insertId ?? 0)
      if (channelId) {
        await pool.execute(
          `UPDATE ${tChannels} SET user_b = ? WHERE id = ? AND channel_type = 'group'`,
          [channelId, channelId]
        )
      }
    } catch {
      const [again] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM ${tChannels}
         WHERE channel_type = 'group' AND community_id = ? AND member_fingerprint = ? LIMIT 1`,
        [communityId, CORE_CHANNEL_FINGERPRINT]
      )
      channelId = again?.[0] ? Number(again[0].id) : 0
    }
  }
  if (!channelId) return

  const [memberRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id FROM ${tMembers} WHERE channel_id = ?`,
    [channelId]
  )
  const current = new Set((memberRows ?? []).map((r) => Number(r.user_id)).filter((id) => id > 0))
  const desired = new Set(participantIds)
  for (const uid of desired) {
    if (!current.has(uid)) {
      await pool.execute(`INSERT IGNORE INTO ${tMembers} (channel_id, user_id) VALUES (?, ?)`, [
        channelId,
        uid,
      ])
    }
  }
  for (const uid of current) {
    if (!desired.has(uid)) {
      await pool.execute(`DELETE FROM ${tMembers} WHERE channel_id = ? AND user_id = ?`, [
        channelId,
        uid,
      ])
    }
  }
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
    `INSERT IGNORE INTO ${tChannels} (user_a, user_b, channel_type, created_by) VALUES (?, ?, 'direct', ?)`,
    [ua, ub, userId]
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
  assertNotCoreChannel(ch)
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
  if (communityId) {
    try {
      await syncPlaceCoreChannel(communityId)
    } catch (err) {
      console.error('sync groupe cœur', err)
    }
  }

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
    `SELECT id, user_a, user_b, created_by FROM ${tChannels}
     WHERE (user_a = ? OR user_b = ?) AND COALESCE(channel_type, 'direct') = 'direct'`,
    [uid, uid]
  )

  await ensureMessagesTable(pool)

  const list: MyChannelRecord[] = []
  const meetOnlyIds = new Set<number>()

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
      const placeMembers = new Set((memberRows ?? []).map((r) => Number(r.user_id)))
      const meetPartners = new Set<number>()
      try {
        const [meetRows] = await pool.execute<RowDataPacket[]>(
          `SELECT from_user_id, to_user_id FROM ${table('mandala_meet_requests')}
           WHERE status = 'accepted' AND (from_user_id = ? OR to_user_id = ?)`,
          [uid, uid]
        )
        for (const meet of meetRows ?? []) {
          const other =
            Number(meet.from_user_id) === uid ? Number(meet.to_user_id) : Number(meet.from_user_id)
          if (other > 0) meetPartners.add(other)
        }
      } catch {
        /* table absente tant qu’aucune rencontre n’a été demandée */
      }
      for (const id of meetPartners) {
        if (!placeMembers.has(id)) meetOnlyIds.add(id)
      }
      const allowed = new Set<number>([...placeMembers, ...meetPartners])
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
  const directCreators = await creatorsForDirectChannels(pool, directRows)

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
      viaMeet: meetOnlyIds.has(otherId),
      createdBy: directCreators.get(channelId) ?? null,
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
    const coreChannel = isCoreChannelFingerprint(gr.member_fingerprint)
    const groupName = String(gr.channel_name ?? '').trim() || (coreChannel ? CORE_CHANNEL_NAME : `Groupe (${memberIds.length})`)
    list.push({
      channelId,
      channelType: 'group',
      channelKind: coreChannel ? 'core' : null,
      communityId: gr.community_id ? Number(gr.community_id) : null,
      createdBy: gr.created_by != null ? Number(gr.created_by) : null,
      otherPseudo: groupName,
      otherAvatar: gr.channel_icon_image ? String(gr.channel_icon_image) : null,
      otherAvatarEmoji: String(gr.channel_icon_emoji ?? '').trim() || (coreChannel ? '◎' : '👥'),
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
    const aTier = conversationListTier(a)
    const bTier = conversationListTier(b)
    if (aTier !== bTier) return aTier - bTier
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

  const ch = await assertChannelAccess(pool, channelId, userId)
  const tCh = table('chat_channels')

  if (isCoreChannelFingerprint(ch.member_fingerprint)) {
    const communityId = ch.community_id ? Number(ch.community_id) : 0
    await assertPlaceManagerCanRename(pool, communityId, userId)
    await pool.execute(
      `UPDATE ${tCh} SET channel_name = ? WHERE id = ? AND channel_type = 'group'`,
      [name, channelId]
    )
    return { channelId, name }
  }

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

async function removeConversationNotifications(
  pool: Awaited<ReturnType<typeof getPool>>,
  channelId: number,
  userIds: number[]
): Promise<void> {
  try {
    const tN = table('notifications')
    const tD = table('notification_deliveries')
    await pool.execute(
      `DELETE d FROM ${tD} d
       INNER JOIN ${tN} n ON n.id = d.notification_id
       WHERE n.channel_id = ?`,
      [channelId]
    )
    await pool.execute(`DELETE FROM ${tD} WHERE channel_id = ?`, [channelId])
    await pool.execute(`DELETE FROM ${tN} WHERE channel_id = ?`, [channelId])
    invalidateNotifUnreadCache(userIds.filter((id) => id > 0))
  } catch {
    /* la conversation est déjà effacée */
  }
}

async function creatorsForDirectChannels(
  pool: Awaited<ReturnType<typeof getPool>>,
  rows: RowDataPacket[]
): Promise<Map<number, number>> {
  const creators = new Map<number, number>()
  const missing: number[] = []
  for (const row of rows) {
    const channelId = Number(row.id)
    const stored = row.created_by != null ? Number(row.created_by) : 0
    if (stored > 0) creators.set(channelId, stored)
    else if (channelId) missing.push(channelId)
  }
  if (!missing.length) return creators

  await ensureMessagesTable(pool)
  const tMsg = table(P2P_MESSAGES_TABLE)
  const tChannels = table('chat_channels')
  const placeholders = missing.map(() => '?').join(',')
  const [firstRows] = await pool.execute<RowDataPacket[]>(
    `SELECT m.channel_id, m.sender_id
     FROM ${tMsg} m
     INNER JOIN (
       SELECT channel_id, MIN(id) AS mid
       FROM ${tMsg}
       WHERE channel_id IN (${placeholders})
       GROUP BY channel_id
     ) first ON first.mid = m.id`,
    missing
  )
  for (const row of firstRows ?? []) {
    const channelId = Number(row.channel_id)
    const senderId = Number(row.sender_id)
    if (!channelId || !senderId) continue
    creators.set(channelId, senderId)
    await pool.execute(
      `UPDATE ${tChannels} SET created_by = ? WHERE id = ? AND (created_by IS NULL OR created_by = 0)`,
      [senderId, channelId]
    )
  }
  return creators
}

async function directChannelCreatorId(
  pool: Awaited<ReturnType<typeof getPool>>,
  channelId: number,
  stored: unknown
): Promise<number> {
  const found = await creatorsForDirectChannels(pool, [
    { id: channelId, created_by: stored } as RowDataPacket,
  ])
  return found.get(channelId) ?? 0
}

/**
 * Efface une conversation pour tous ses participants.
 * Seul le créateur peut le faire. Le groupe cœur ne se supprime pas.
 */
export async function deleteChannelConversation(params: {
  channelId: number
  userId: number
}): Promise<{ channelId: number }> {
  const pool = getPool()
  await ensureGroupChannelSupport(pool)
  await ensureMessagesTable(pool)
  await ensureReactionsTable(pool)

  const channelId = Number(params.channelId)
  const userId = Number(params.userId)
  if (!channelId || !userId) throw new Error('Paramètres requis')

  const ch = await assertChannelAccess(pool, channelId, userId)
  if (isCoreChannelFingerprint(ch.member_fingerprint)) {
    throw Object.assign(
      new Error('La conversation du groupe cœur suit le cercle du lieu. Elle ne se supprime pas.'),
      { status: 403 }
    )
  }

  const channelType = String(ch.channel_type ?? 'direct')
  const createdBy =
    channelType === 'direct'
      ? await directChannelCreatorId(pool, channelId, ch.created_by)
      : ch.created_by != null
        ? Number(ch.created_by)
        : 0
  if (!createdBy || createdBy !== userId) {
    throw Object.assign(
      new Error('Seul le créateur peut supprimer cette conversation'),
      { status: 403 }
    )
  }

  const tMsg = table(P2P_MESSAGES_TABLE)
  const tReact = table(MESSAGE_REACTIONS_TABLE)
  const tMembers = table('chat_channel_members')
  const tCh = table('chat_channels')
  const tMeta = table('usermeta')

  const [fileRows] = await pool.execute<RowDataPacket[]>(
    `SELECT attachment_path FROM ${tMsg}
     WHERE channel_id = ? AND attachment_path IS NOT NULL AND attachment_path != ''`,
    [channelId]
  )
  const attachmentPaths = (fileRows ?? []).map((row) => String(row.attachment_path))

  const recipientIds = new Set<number>([userId])
  if (channelType === 'group') {
    const [memberRows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id FROM ${tMembers} WHERE channel_id = ?`,
      [channelId]
    )
    for (const row of memberRows ?? []) recipientIds.add(Number(row.user_id))
  } else {
    recipientIds.add(Number(ch.user_a))
    recipientIds.add(Number(ch.user_b))
  }

  const [reactTables] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [tReact]
  )
  const hasReactions = (reactTables?.length ?? 0) > 0

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    if (hasReactions) {
      await conn.execute(
        `DELETE r FROM ${tReact} r
         INNER JOIN ${tMsg} m ON m.id = r.message_id
         WHERE m.channel_id = ?`,
        [channelId]
      )
    }
    await conn.execute(`DELETE FROM ${tMsg} WHERE channel_id = ?`, [channelId])
    await conn.execute(`DELETE FROM ${tMembers} WHERE channel_id = ?`, [channelId])
    await conn.execute(`DELETE FROM ${tMeta} WHERE meta_key = ?`, [
      `${CHANNEL_READ_META_PREFIX}${channelId}_last_read_at`,
    ])
    const [res] = await conn.execute(`DELETE FROM ${tCh} WHERE id = ?`, [channelId])
    const affected = Number((res as { affectedRows?: number })?.affectedRows ?? 0)
    if (!affected) {
      throw Object.assign(new Error('Conversation introuvable'), { status: 404 })
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }

  await removeConversationNotifications(pool, channelId, [...recipientIds])
  for (const relative of attachmentPaths) {
    await removeUpload(relative)
  }

  return { channelId }
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

  const iconChannel = await assertChannelAccess(pool, channelId, userId)
  assertNotCoreChannel(iconChannel)

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


export type ClairiereUnreadPlace = {
  slug: string
  name: string
  count: number
}

/**
 * Non-lus par lieu, avec le même filtre que la liste des conversations.
 * Un direct partagé entre deux lieux compte dans chacun. Le total ne compte chaque fil qu'une fois.
 */
export async function getClairiereUnreadSummary(userId: string): Promise<{
  total: number
  byCommunity: ClairiereUnreadPlace[]
}> {
  const empty = { total: 0, byCommunity: [] as ClairiereUnreadPlace[] }
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) return empty

  const tCh = table('chat_channels')
  const t = table(P2P_MESSAGES_TABLE)
  const tMeta = table('usermeta')
  const tMembers = table('chat_channel_members')
  const tComm = table('mandala_communities')
  const tCommMembers = table('mandala_community_members')
  const metaPrefix = CHANNEL_READ_META_PREFIX

  await ensureGroupChannelSupport(pool)
  await ensureMessagesTable(pool)

  const [placeRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.slug, c.name
     FROM ${tCommMembers} m
     INNER JOIN ${tComm} c ON c.id = m.community_id AND c.is_active = 1
     WHERE m.user_id = ?
     ORDER BY c.name ASC`,
    [uid]
  )
  const places = (placeRows ?? [])
    .map((row) => ({
      id: Number(row.id),
      slug: String(row.slug ?? ''),
      name: String(row.name ?? ''),
      count: 0,
    }))
    .filter((place) => place.id > 0 && place.slug)
  const placeIds = places.map((place) => place.id)

  const [directRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id AS channel_id, c.user_a, c.user_b, COUNT(m.id) AS cnt
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
     GROUP BY c.id, c.user_a, c.user_b`,
    [uid, uid, metaPrefix, uid, uid]
  )

  const [groupRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id AS channel_id, c.community_id, COUNT(m.id) AS cnt
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
     GROUP BY c.id, c.community_id`,
    [uid, uid, uid, metaPrefix]
  )

  const directUnread = (directRows ?? []).map((row) => {
    const userA = Number(row.user_a)
    const userB = Number(row.user_b)
    return {
      channelId: Number(row.channel_id),
      otherId: userA === uid ? userB : userA,
      cnt: Number(row.cnt ?? 0),
    }
  })
  const otherIds = [...new Set(directUnread.map((row) => row.otherId).filter((id) => id > 0))]
  const membersByPlace = new Map<number, Set<number>>()
  if (placeIds.length && otherIds.length) {
    const placePh = placeIds.map(() => '?').join(',')
    const otherPh = otherIds.map(() => '?').join(',')
    const [memberRows] = await pool.execute<RowDataPacket[]>(
      `SELECT community_id, user_id
       FROM ${tCommMembers}
       WHERE community_id IN (${placePh}) AND user_id IN (${otherPh})`,
      [...placeIds, ...otherIds]
    )
    for (const row of memberRows ?? []) {
      const communityId = Number(row.community_id)
      const memberId = Number(row.user_id)
      const set = membersByPlace.get(communityId) ?? new Set<number>()
      set.add(memberId)
      membersByPlace.set(communityId, set)
    }
  }

  const meetPartners = new Set<number>()
  try {
    const [meetRows] = await pool.execute<RowDataPacket[]>(
      `SELECT from_user_id, to_user_id FROM ${table('mandala_meet_requests')}
       WHERE status = 'accepted' AND (from_user_id = ? OR to_user_id = ?)`,
      [uid, uid]
    )
    for (const meet of meetRows ?? []) {
      const other = Number(meet.from_user_id) === uid ? Number(meet.to_user_id) : Number(meet.from_user_id)
      if (other > 0) meetPartners.add(other)
    }
  } catch {
    /* table absente tant qu’aucune rencontre n’a été demandée */
  }

  const placeById = new Map(places.map((place) => [place.id, place]))
  let total = 0
  const countedDirect = new Set<number>()

  for (const row of groupRows ?? []) {
    const communityId = Number(row.community_id)
    const cnt = Number(row.cnt ?? 0)
    const place = placeById.get(communityId)
    if (!place || cnt <= 0) continue
    place.count += cnt
    total += cnt
  }

  for (const row of directUnread) {
    const channelId = row.channelId
    const otherId = row.otherId
    const cnt = row.cnt
    if (!otherId || cnt <= 0) continue
    let visibleSomewhere = false
    for (const place of places) {
      const inPlace = membersByPlace.get(place.id)?.has(otherId) || meetPartners.has(otherId)
      if (!inPlace) continue
      place.count += cnt
      visibleSomewhere = true
    }
    if (visibleSomewhere && !countedDirect.has(channelId)) {
      countedDirect.add(channelId)
      total += cnt
    }
  }

  return {
    total,
    byCommunity: places.map((place) => ({
      slug: place.slug,
      name: place.name,
      count: place.count,
    })),
  }
}

/** Retourne le nombre de messages non lus visibles (La Clairière) pour l'utilisateur */
export async function getClairiereUnreadCount(userId: string): Promise<number> {
  const summary = await getClairiereUnreadSummary(userId)
  return summary.total
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
 * Nouveau message : une ligne dans la cloche pour chaque autre membre,
 * puis un push prioritaire pour réveiller le téléphone.
 */
export async function notifyChannelMessage(input: {
  channelId: number
  senderId: number
  recipientIds: number[]
  body: string | null
  cardSlug: string | null
}): Promise<void> {
  const recipients = [...new Set(input.recipientIds.filter((id) => id > 0 && id !== input.senderId))]
  if (!recipients.length) return

  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const tCh = table('chat_channels')

  const [senderRows] = await pool.execute<RowDataPacket[]>(
    `SELECT display_name FROM ${tUsers} WHERE ID = ? LIMIT 1`,
    [input.senderId]
  )
  let pseudo = senderRows?.[0]?.display_name ? String(senderRows[0].display_name).trim() : ''
  if (!pseudo) {
    const [metaRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'mdl_pseudo' LIMIT 1`,
      [input.senderId]
    )
    pseudo = metaRows?.[0]?.meta_value ? String(metaRows[0].meta_value).trim() : ''
  }
  if (!pseudo) pseudo = 'Quelqu\'un'

  const [chRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(channel_type, 'direct') AS channel_type, channel_name, community_id
     FROM ${tCh} WHERE id = ? LIMIT 1`,
    [input.channelId]
  )
  const isGroup = String(chRows?.[0]?.channel_type ?? 'direct') === 'group'
  const groupName = chRows?.[0]?.channel_name ? String(chRows[0].channel_name).trim() : ''
  const communityId = chRows?.[0]?.community_id ? Number(chRows[0].community_id) : 0
  const communitySlug = isGroup && communityId ? await getCommunitySlugById(pool, communityId) : null

  const excerpt = input.cardSlug
    ? 'a partagé une carte'
    : input.body
      ? input.body.length > 140
        ? `${input.body.slice(0, 137)}...`
        : input.body
      : 'Nouveau message'
  const title = isGroup ? groupName || 'Groupe' : pseudo
  const bodyText = isGroup ? `${pseudo} : ${excerpt}` : excerpt
  const params = new URLSearchParams({ channelId: String(input.channelId) })
  if (communitySlug) params.set('community', communitySlug)
  const actionUrl = `mandala:messages?${params.toString()}`

  const { recordUserNotification } = await import('./db-notifications')
  for (const recipientId of recipients) {
    try {
      await recordUserNotification({
        userId: recipientId,
        type: 'clairiere_message',
        title,
        body: bodyText,
        actionUrl,
        actionLabel: 'Ouvrir',
        priority: 'high',
        sourceType: 'clairiere_channel',
        sourceId: input.channelId,
        channelId: input.channelId,
        createdBy: input.senderId,
      })
    } catch (err: unknown) {
      console.error('[messages] cloche', recipientId, (err as Error)?.message ?? err)
    }
  }

  try {
    const { sendWebPushToUsers } = await import('./web-push-send')
    const stats = await sendWebPushToUsers(recipients, title, bodyText, actionUrl, {
      urgency: 'high',
      tag: `mdl-ch-${input.channelId}`,
    })
    console.info(
      '[messages] push',
      input.channelId,
      `sent=${stats.sent}`,
      `gone=${stats.gone}`,
      `errors=${stats.errors}`,
      `users=${stats.users}`
    )
  } catch (err: unknown) {
    console.error('[messages] push', input.channelId, (err as Error)?.message ?? err)
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

  await assertChannelAccess(pool, channelId, uid)
  await markChatNotificationsReadForChannel(pool, channelId, uid)

  let now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  try {
    await ensureMessagesTable(pool)
    const tMsg = table(P2P_MESSAGES_TABLE)
    const [stampRows] = await pool.execute<RowDataPacket[]>(
      `SELECT DATE_FORMAT(
         GREATEST(UTC_TIMESTAMP(), COALESCE(MAX(created_at), UTC_TIMESTAMP())),
         '%Y-%m-%d %H:%i:%s'
       ) AS ts
       FROM ${tMsg} WHERE channel_id = ?`,
      [channelId]
    )
    const ts = stampRows?.[0]?.ts ? String(stampRows[0].ts).trim().slice(0, 19) : ''
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(ts)) now = ts
  } catch {
    /* l'heure UTC du processus reste un repli */
  }

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = ?`,
    [uid, metaKey]
  )
  if (existing.length > 0) {
    await pool.execute(`UPDATE ${tMeta} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`, [now, uid, metaKey])
  } else {
    await pool.execute(`INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [uid, metaKey, now])
  }
  cacheDelPrefix(`clairiere_unread:${userId}`)
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
  await ensureGroupChannelSupport(pool)
  await pool.execute(
    `INSERT IGNORE INTO ${tChannels} (user_a, user_b, channel_type, created_by) VALUES (?, ?, 'direct', ?)`,
    [ua, ub, fromUserId]
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
