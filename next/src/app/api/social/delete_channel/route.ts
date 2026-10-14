/**
 * POST /api/social/delete_channel — efface une conversation pour tous ses participants.
 * Seul le créateur. Le groupe cœur est refusé.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { deleteChannelConversation } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json()) as { channelId?: number; channel_id?: number }
    const channelId = Number(body.channelId ?? body.channel_id ?? 0)

    if (!channelId) {
      return NextResponse.json({ error: 'channelId requis' }, { status: 400 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ channelId }, { status: 200 })
    }

    const result = await deleteChannelConversation({ channelId, userId: uid })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
