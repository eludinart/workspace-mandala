/**
 * GET /api/place-links/friends?community_id=
 * Lieux amis (accepted) du lieu — lecture carte / fiche, porte lieux_lies.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { canAccessFeatureDoor } from '@/lib/db-feature-doors'
import { listAcceptedFriendsBrief } from '@/lib/db-place-links'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const communityId = parseInt(req.nextUrl.searchParams.get('community_id') || '', 10)
    if (!communityId) {
      return NextResponse.json({ error: 'community_id requis' }, { status: 422 })
    }

    const doorOk = await canAccessFeatureDoor(uid, 'lieux_lies')
    if (!doorOk) {
      return NextResponse.json({ friend_ids: [], friends: [], can_view: false })
    }

    const friends = await listAcceptedFriendsBrief(communityId)
    return NextResponse.json({
      friends,
      friend_ids: friends.map((f) => f.id),
      can_view: true,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
