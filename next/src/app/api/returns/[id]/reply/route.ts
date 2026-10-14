import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { replyToReturn } from '@/lib/db-returns'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { userId } = await requireAuth(req)
    const { id } = await ctx.params
    const body = (await req.json()) as { body?: unknown }
    await replyToReturn(parseInt(userId, 10), parseInt(id, 10), String(body.body ?? ''))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
