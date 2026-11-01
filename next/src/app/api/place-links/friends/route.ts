/**
 * GET /api/place-links/friends?community_id=
 * Lieux amis (accepted) du lieu — lecture carte / fiche.
 * Graphe catalogue (listed_public) : public, sans compte.
 * Graphe complet : porte lieux_lies.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, getUserIdFromRequest } from '@/lib/api-auth'
import { getCommunityById } from '@/lib/db-communities'
import { canAccessFeatureDoor } from '@/lib/db-feature-doors'
import { listAcceptedFriendsBrief } from '@/lib/db-place-links'
import { resolvePlaceFriendsAccess } from '@/lib/place-friends-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const communityId = parseInt(req.nextUrl.searchParams.get('community_id') || '', 10)
    if (!communityId) {
      return NextResponse.json({ error: 'community_id requis' }, { status: 422 })
    }

    const community = await getCommunityById(communityId)
    if (!community || !community.is_active) {
      return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
    }

    const userIdRaw = getUserIdFromRequest(req)
    const uid = userIdRaw ? parseInt(userIdRaw, 10) : NaN
    const isAuthenticated = Number.isFinite(uid) && uid > 0
    const hasLieuxLiesDoor = isAuthenticated
      ? await canAccessFeatureDoor(uid, 'lieux_lies')
      : false

    const access = resolvePlaceFriendsAccess({
      sourceListedPublic: Boolean(community.listed_public),
      isAuthenticated,
      hasLieuxLiesDoor,
    })

    if (!access.can_view || access.mode === 'none') {
      return NextResponse.json({ friend_ids: [], friends: [], can_view: false })
    }

    const friends = await listAcceptedFriendsBrief(communityId, {
      listedPublicOnly: access.mode === 'listed-public',
    })
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
