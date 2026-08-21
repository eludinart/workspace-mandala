import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userCanManageInCommunity } from '@/lib/api-auth'
import { getCommunityBySlug, requireCommunityMembership } from '@/lib/db-communities'
import { setCalendarDayDisabled, setCalendarDayMaxParticipants } from '@/lib/db-calendar'
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
    if (!slug) return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    if (!day) return NextResponse.json({ error: 'day requis (YYYY-MM-DD)' }, { status: 400 })
    const community = await getCommunityBySlug(slug)
    if (!community) return NextResponse.json({ error: 'Communauté introuvable' }, { status: 404 })
    const role = await requireCommunityMembership(uid, community.id)
    const can_manage = await userCanManageInCommunity(uid, role)
    if (!can_manage) return NextResponse.json({ error: 'Droits admin requis' }, { status: 403 })

    const hasDisabled = body.is_disabled !== undefined && body.is_disabled !== null
    const hasMax = body.max_participants !== undefined && body.max_participants !== null
    if (!hasDisabled && !hasMax) {
      return NextResponse.json(
        { error: 'is_disabled ou max_participants requis' },
        { status: 400 }
      )
    }

    if (hasDisabled) {
      const is_disabled = !!body.is_disabled
      const reason = body.reason != null ? String(body.reason) : undefined
      await setCalendarDayDisabled({
        communityId: community.id,
        day,
        is_disabled,
        byUserId: uid,
        reason,
      })
    }

    let max_participants: number | undefined
    if (hasMax) {
      const res = await setCalendarDayMaxParticipants({
        communityId: community.id,
        day,
        max_participants: body.max_participants,
        byUserId: uid,
      })
      max_participants = res.max_participants
    }

    return NextResponse.json({ ok: true, ...(max_participants != null ? { max_participants } : {}) })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
