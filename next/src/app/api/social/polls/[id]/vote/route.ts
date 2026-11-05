/**
 * POST /api/social/polls/[id]/vote — voter (ou changer de vote).
 * Body: { optionId }
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { voteChannelPoll } from '@/lib/db-chat-polls'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { id } = await ctx.params
    const pollId = parseInt(id, 10)
    if (!pollId) {
      return NextResponse.json({ error: 'id invalide' }, { status: 422 })
    }
    const body = (await req.json().catch(() => ({}))) as { optionId?: number; option_id?: number }
    const optionId = Number(body.optionId ?? body.option_id ?? 0)
    if (!optionId) {
      return NextResponse.json({ error: 'optionId requis' }, { status: 422 })
    }
    const poll = await voteChannelPoll({ pollId, userId: uid, optionId })
    return NextResponse.json({ ok: true, poll })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
