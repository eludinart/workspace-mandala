import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, userCanManageInCommunity } from '@/lib/api-auth'
import { getCommunityBySlug, requireCommunityMembership } from '@/lib/db-communities'
import { getCalendarSettings, upsertCalendarSettings } from '@/lib/db-calendar'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const slug = req.nextUrl.searchParams.get('community_slug')?.trim()
    if (!slug) return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    const community = await getCommunityBySlug(slug)
    if (!community) return NextResponse.json({ error: 'Communauté introuvable' }, { status: 404 })
    await requireCommunityMembership(uid, community.id)
    const settings = await getCalendarSettings(community.id)
    return NextResponse.json({ settings })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json()
    const slug = String(body.community_slug ?? '').trim()
    if (!slug) return NextResponse.json({ error: 'community_slug requis' }, { status: 400 })
    const community = await getCommunityBySlug(slug)
    if (!community) return NextResponse.json({ error: 'Communauté introuvable' }, { status: 404 })
    const role = await requireCommunityMembership(uid, community.id)
    const can_manage = await userCanManageInCommunity(uid, role)
    if (!can_manage) return NextResponse.json({ error: 'Droits admin requis' }, { status: 403 })

    const patch: { show_presence?: boolean; show_events?: boolean } = {}
    if (body.show_presence !== undefined) patch.show_presence = !!body.show_presence
    if (body.show_events !== undefined) patch.show_events = !!body.show_events
    const settings = await upsertCalendarSettings({ communityId: community.id, patch })
    return NextResponse.json({ settings })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

