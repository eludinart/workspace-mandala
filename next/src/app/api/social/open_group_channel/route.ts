/**
 * POST /api/social/open_group_channel — ouvre ou crée un dialogue de groupe.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getCommunityBySlug, requireCommunityMembership } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'
import { openGroupChannel } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json()) as {
      community_slug?: string
      member_user_ids?: number[]
      memberUserIds?: number[]
      name?: string
    }
    const slug = String(body.community_slug ?? '').trim()
    const memberIds = (body.member_user_ids ?? body.memberUserIds ?? [])
      .map((id) => Number(id))
      .filter((id) => id > 0)

    if (!slug) {
      return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    }
    if (!memberIds.length) {
      return NextResponse.json({ error: 'member_user_ids requis' }, { status: 400 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ channelId: 2, isNew: true }, { status: 200 })
    }

    const community = await getCommunityBySlug(slug)
    if (!community) {
      return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
    }
    await requireCommunityMembership(uid, community.id)

    const result = await openGroupChannel({
      creatorUserId: uid,
      communityId: community.id,
      memberUserIds: memberIds,
      name: body.name,
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
