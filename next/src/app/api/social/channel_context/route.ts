/**
 * GET /api/social/channel_context?channel_id=
 * Contexte de navigation pour ouvrir un canal (notification, lien profond).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getChannelNavigationContext } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const channelId = parseInt(req.nextUrl.searchParams.get('channel_id') ?? '', 10)
    if (!channelId) return NextResponse.json({ error: 'channel_id requis' }, { status: 400 })

    if (!isDbConfigured()) {
      return NextResponse.json({
        channelId,
        channelType: 'direct',
        communitySlug: null,
        otherUserId: null,
      })
    }

    const ctx = await getChannelNavigationContext(channelId, uid)
    return NextResponse.json(ctx)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
