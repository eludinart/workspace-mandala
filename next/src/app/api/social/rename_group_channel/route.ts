/**
 * POST /api/social/rename_group_channel — renomme un dialogue de groupe (créateur uniquement).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { renameGroupChannel } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json()) as { channelId?: number; channel_id?: number; name?: string }
    const channelId = Number(body.channelId ?? body.channel_id ?? 0)
    const name = String(body.name ?? '').trim()

    if (!channelId) {
      return NextResponse.json({ error: 'channelId requis' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'name requis' }, { status: 400 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ channelId, name }, { status: 200 })
    }

    const result = await renameGroupChannel({ channelId, userId: uid, name })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

