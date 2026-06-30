import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userCanManageInCommunity } from '@/lib/api-auth'
import { getCommunityBySlug, requireCommunityMembership } from '@/lib/db-communities'
import { setPresence } from '@/lib/db-calendar'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json()
    const slug = String(body.community_slug ?? '').trim()
    const day = String(body.day ?? '').trim()
    const present = !!body.present
    const targetUserId =
      body.user_id != null && body.user_id !== '' ? parseInt(String(body.user_id), 10) : uid
    if (!slug) return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    if (!day) return NextResponse.json({ error: 'day requis (YYYY-MM-DD)' }, { status: 400 })
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ error: 'user_id invalide' }, { status: 400 })
    }
    const community = await getCommunityBySlug(slug)
    if (!community) return NextResponse.json({ error: 'Communauté introuvable' }, { status: 404 })
    const role = await requireCommunityMembership(uid, community.id)
    const can_manage = await userCanManageInCommunity(uid, role)

    if (targetUserId !== uid && !can_manage) {
      return NextResponse.json({ error: 'Droits admin requis pour modifier un autre utilisateur' }, { status: 403 })
    }
    if (targetUserId !== uid) {
      await requireCommunityMembership(targetUserId, community.id)
    }

    const res = await setPresence({
      communityId: community.id,
      day,
      userId: targetUserId,
      present,
      bypassDisabled: can_manage && targetUserId !== uid,
    })
    return NextResponse.json(res)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
