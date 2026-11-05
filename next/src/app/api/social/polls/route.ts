/**
 * POST /api/social/polls — créer un sondage dans un canal.
 * Body: { channelId, question, options: string[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { createChannelPoll } from '@/lib/db-chat-polls'
import { getChannelRecipientIds, notifyChannelMessage } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json().catch(() => ({}))) as {
      channelId?: number
      channel_id?: number
      question?: string
      options?: string[]
    }
    const channelId = Number(body.channelId ?? body.channel_id ?? 0)
    if (!channelId) {
      return NextResponse.json({ error: 'channelId requis' }, { status: 422 })
    }
    const { message, poll } = await createChannelPoll({
      channelId,
      userId: uid,
      question: String(body.question ?? ''),
      options: Array.isArray(body.options) ? body.options.map(String) : [],
    })

    const recipients = await getChannelRecipientIds(channelId, uid).catch(() => [] as number[])
    void notifyChannelMessage({
      channelId,
      senderId: uid,
      body: message.body,
      cardSlug: message.cardSlug ?? `poll:${poll.id}`,
      recipientIds: recipients,
    }).catch(() => {})

    return NextResponse.json({ ok: true, message, poll })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
