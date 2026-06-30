/**
 * POST /api/social/open_channel — ouvre ou crée un dialogue 1:1 avec un membre du lieu.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getCommunityBySlug, requireCommunityMembership } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'
import { openDirectChannel } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json()) as { target_user_id?: number; targetUserId?: number; community_slug?: string }
    const targetUserId = Number(body.target_user_id ?? body.targetUserId ?? 0)
    const slug = String(body.community_slug ?? '').trim()

    if (!targetUserId) {
      return NextResponse.json({ error: 'target_user_id requis' }, { status: 400 })
    }
    if (!slug) {
      return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ channelId: 1 }, { status: 200 })
    }

    const community = await getCommunityBySlug(slug)
    if (!community) {
      return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
    }
    await requireCommunityMembership(uid, community.id)

    const { channelId } = await openDirectChannel(uid, targetUserId, community.id)
    return NextResponse.json({ channelId })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
