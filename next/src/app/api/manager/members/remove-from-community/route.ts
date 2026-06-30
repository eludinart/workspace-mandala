import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireCommunityManagerActor } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  assertUserCanManageCommunity,
  getCommunityBySlug,
  removeUserFromCommunity,
} from '@/lib/db-communities'
import { actorCanManageTargetUser } from '@/lib/user-admin-access'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { uid, isAppSiteManager } = await requireCommunityManagerActor(req)
    const body = await req.json().catch(() => ({}))
    const communitySlug = String(body.community_slug ?? '').trim()
    const targetId = parseInt(String(body.user_id ?? ''), 10)
    if (!communitySlug) {
      return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    }
    if (!targetId) {
      return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    }
    if (targetId === uid) {
      return NextResponse.json(
        { error: 'Utilisez « Quitter le lieu » dans Mon compte pour vous retirer vous-même' },
        { status: 400 }
      )
    }

    const community = await getCommunityBySlug(communitySlug)
    if (!community) {
      return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 })
    }

    await assertUserCanManageCommunity(uid, community.id, { isAppSiteManager })
    const allowed = await actorCanManageTargetUser(uid, targetId, {
      isAppAdmin: false,
      communitySlug,
    })
    if (!allowed) {
      throw new ApiError(403, 'Accès refusé pour retirer ce membre')
    }

    await removeUserFromCommunity(community.id, targetId)

    return NextResponse.json({
      ok: true,
      community_slug: communitySlug,
      community_name: community.name,
    })
  } catch (err: unknown) {
    const e = err as ApiError
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
