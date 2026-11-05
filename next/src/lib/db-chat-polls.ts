/**
 * Sondages dans les canaux de chat (message card_slug = poll:{id}).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from '@/lib/db'
import { assertChannelAccess, sendChannelMessage } from '@/lib/db-social'

const POLLS_TABLE = 'chat_polls'
const OPTIONS_TABLE = 'chat_poll_options'
const VOTES_TABLE = 'chat_poll_votes'

export type ChatPollOptionView = {
  id: number
  label: string
  votes: number
}

export type ChatPollView = {
  id: number
  message_id: number | null
  channel_id: number
  question: string
  options: ChatPollOptionView[]
  total_votes: number
  my_option_id: number | null
  created_by: number
}

let _ensured = false

async function ensurePollTables(): Promise<void> {
  if (_ensured || !isDbConfigured()) return
  const pool = getPool()
  const tP = table(POLLS_TABLE)
  const tO = table(OPTIONS_TABLE)
  const tV = table(VOTES_TABLE)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tP} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      channel_id INT NOT NULL,
      message_id BIGINT UNSIGNED NULL,
      created_by INT NOT NULL,
      question VARCHAR(280) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_channel (channel_id),
      KEY idx_message (message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tO} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      poll_id BIGINT UNSIGNED NOT NULL,
      label VARCHAR(120) NOT NULL,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      KEY idx_poll (poll_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tV} (
      poll_id BIGINT UNSIGNED NOT NULL,
      user_id INT NOT NULL,
      option_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (poll_id, user_id),
      KEY idx_option (option_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  _ensured = true
}

export function parsePollIdFromCardSlug(cardSlug: string | null | undefined): number | null {
  if (!cardSlug) return null
  const m = /^poll:(\d+)$/i.exec(cardSlug.trim())
  if (!m) return null
  const id = parseInt(m[1], 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

async function loadPollView(pollId: number, viewerId: number): Promise<ChatPollView | null> {
  if (!isDbConfigured() || pollId <= 0) return null
  await ensurePollTables()
  const pool = getPool()
  const tP = table(POLLS_TABLE)
  const tO = table(OPTIONS_TABLE)
  const tV = table(VOTES_TABLE)

  const [pollRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, channel_id, message_id, created_by, question FROM ${tP} WHERE id = ? LIMIT 1`,
    [pollId]
  )
  const poll = pollRows[0]
  if (!poll) return null

  const [optRows] = await pool.execute<RowDataPacket[]>(
    `SELECT o.id, o.label, o.sort_order,
            (SELECT COUNT(*) FROM ${tV} v WHERE v.option_id = o.id) AS votes
     FROM ${tO} o
     WHERE o.poll_id = ?
     ORDER BY o.sort_order ASC, o.id ASC`,
    [pollId]
  )
  const [mine] = await pool.execute<RowDataPacket[]>(
    `SELECT option_id FROM ${tV} WHERE poll_id = ? AND user_id = ? LIMIT 1`,
    [pollId, viewerId]
  )

  const options: ChatPollOptionView[] = (optRows ?? []).map((r) => ({
    id: Number(r.id),
    label: String(r.label),
    votes: Number(r.votes ?? 0),
  }))
  const total = options.reduce((s, o) => s + o.votes, 0)

  return {
    id: Number(poll.id),
    message_id: poll.message_id != null ? Number(poll.message_id) : null,
    channel_id: Number(poll.channel_id),
    question: String(poll.question),
    options,
    total_votes: total,
    my_option_id: mine[0] ? Number(mine[0].option_id) : null,
    created_by: Number(poll.created_by),
  }
}

export async function getPollsForCardSlugs(
  cardSlugs: Array<string | null | undefined>,
  viewerId: number
): Promise<Map<number, ChatPollView>> {
  const ids = [
    ...new Set(
      cardSlugs
        .map((s) => parsePollIdFromCardSlug(s))
        .filter((n): n is number => n != null)
    ),
  ]
  const map = new Map<number, ChatPollView>()
  for (const id of ids) {
    const view = await loadPollView(id, viewerId)
    if (view) map.set(id, view)
  }
  return map
}

export async function createChannelPoll(opts: {
  channelId: number
  userId: number
  question: string
  options: string[]
}): Promise<{ message: Awaited<ReturnType<typeof sendChannelMessage>>; poll: ChatPollView }> {
  if (!isDbConfigured()) throw Object.assign(new Error('Base indisponible'), { status: 503 })
  const question = opts.question.trim().slice(0, 280)
  const options = [
    ...new Set(
      opts.options
        .map((o) => o.trim().slice(0, 120))
        .filter(Boolean)
    ),
  ].slice(0, 6)
  if (!question) throw Object.assign(new Error('Question requise'), { status: 422 })
  if (options.length < 2) {
    throw Object.assign(new Error('Au moins 2 options'), { status: 422 })
  }

  const pool = getPool()
  await assertChannelAccess(pool, opts.channelId, opts.userId)
  await ensurePollTables()

  const tP = table(POLLS_TABLE)
  const tO = table(OPTIONS_TABLE)
  const [ins] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${tP} (channel_id, created_by, question) VALUES (?, ?, ?)`,
    [opts.channelId, opts.userId, question]
  )
  const pollId = Number(ins.insertId)
  if (!pollId) throw new Error('Création sondage impossible')

  for (let i = 0; i < options.length; i++) {
    await pool.execute(
      `INSERT INTO ${tO} (poll_id, label, sort_order) VALUES (?, ?, ?)`,
      [pollId, options[i], i]
    )
  }

  const message = await sendChannelMessage(opts.channelId, opts.userId, {
    body: `📊 Sondage : ${question}`,
    cardSlug: `poll:${pollId}`,
  })

  await pool.execute(`UPDATE ${tP} SET message_id = ? WHERE id = ?`, [message.id, pollId])

  const poll = await loadPollView(pollId, opts.userId)
  if (!poll) throw new Error('Sondage introuvable après création')
  return { message, poll }
}

export async function voteChannelPoll(opts: {
  pollId: number
  userId: number
  optionId: number
}): Promise<ChatPollView> {
  if (!isDbConfigured()) throw Object.assign(new Error('Base indisponible'), { status: 503 })
  await ensurePollTables()
  const pool = getPool()
  const tP = table(POLLS_TABLE)
  const tO = table(OPTIONS_TABLE)
  const tV = table(VOTES_TABLE)

  const [pollRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, channel_id FROM ${tP} WHERE id = ? LIMIT 1`,
    [opts.pollId]
  )
  const poll = pollRows[0]
  if (!poll) throw Object.assign(new Error('Sondage introuvable'), { status: 404 })
  await assertChannelAccess(pool, Number(poll.channel_id), opts.userId)

  const [optRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tO} WHERE id = ? AND poll_id = ? LIMIT 1`,
    [opts.optionId, opts.pollId]
  )
  if (!optRows[0]) throw Object.assign(new Error('Option invalide'), { status: 422 })

  await pool.execute(
    `INSERT INTO ${tV} (poll_id, user_id, option_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE option_id = VALUES(option_id), created_at = NOW()`,
    [opts.pollId, opts.userId, opts.optionId]
  )

  const view = await loadPollView(opts.pollId, opts.userId)
  if (!view) throw new Error('Sondage introuvable')
  return view
}
