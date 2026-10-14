import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { updateReturn, type ReturnScores } from '@/lib/db-returns'

export const dynamic = 'force-dynamic'

function scoresFrom(body: Record<string, unknown>): ReturnScores {
  return {
    clarity: parseInt(String(body.clarity ?? ''), 10),
    frame: parseInt(String(body.frame ?? ''), 10),
    quality: parseInt(String(body.quality ?? ''), 10),
    recommend: body.recommend === true || body.recommend === 1 || body.recommend === '1' || body.recommend === 'true',
    body: String(body.body ?? ''),
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const { id } = await ctx.params
    const body = (await req.json()) as Record<string, unknown>
    await updateReturn(parseInt(userId, 10), parseInt(id, 10), scoresFrom(body))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
