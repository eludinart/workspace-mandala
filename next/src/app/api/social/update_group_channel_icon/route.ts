/**
 * POST /api/social/update_group_channel_icon — modifie l’icône (emoji + image) d’un groupe (créateur uniquement).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { updateGroupChannelIcon } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json()) as {
      channelId?: number
      channel_id?: number
      emoji?: string | null
      image?: string | null
      imageData?: string | null
    }

    const channelId = Number(body.channelId ?? body.channel_id ?? 0)
    const emoji = body.emoji ?? null
    const image = body.image ?? body.imageData ?? null

    if (!channelId) {
      return NextResponse.json({ error: 'channelId requis' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ channelId }, { status: 200 })
    }

    const result = await updateGroupChannelIcon({
      channelId,
      userId: uid,
      emoji,
      image,
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; detail?: string }
    return NextResponse.json({ error: e.detail ?? e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

