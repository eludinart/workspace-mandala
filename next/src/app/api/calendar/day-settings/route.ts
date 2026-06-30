import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userCanManageInCommunity } from '@/lib/api-auth'
import { getCommunityBySlug, requireCommunityMembership } from '@/lib/db-communities'
import { setCalendarDayDisabled } from '@/lib/db-calendar'
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
    const is_disabled = !!body.is_disabled
    const reason = body.reason != null ? String(body.reason) : undefined
    if (!slug) return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    if (!day) return NextResponse.json({ error: 'day requis (YYYY-MM-DD)' }, { status: 400 })
    const community = await getCommunityBySlug(slug)
    if (!community) return NextResponse.json({ error: 'Communauté introuvable' }, { status: 404 })
    const role = await requireCommunityMembership(uid, community.id)
    const can_manage = await userCanManageInCommunity(uid, role)
    if (!can_manage) return NextResponse.json({ error: 'Droits admin requis' }, { status: 403 })

    await setCalendarDayDisabled({ communityId: community.id, day, is_disabled, byUserId: uid, reason })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
