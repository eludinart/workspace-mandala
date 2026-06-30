import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, resolveCommunityManagerAccess, userCanManageInCommunity } from '@/lib/api-auth'
import {
  getCommunityById,
  getCommunityBySlug,
  requireCommunityMembership,
} from '@/lib/db-communities'
import { createPlaceAnnouncement, listPlaceAnnouncements } from '@/lib/db-place-announcements'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function resolveCommunity(
  req: NextRequest,
  body?: Record<string, unknown>
): Promise<{ id: number }> {
  const fromBody = body?.community_id ?? body?.communityId
  const communityIdParam = fromBody ?? req.nextUrl.searchParams.get('communityId')
  const communitySlug =
    (body?.community_slug as string | undefined) ?? req.nextUrl.searchParams.get('community_slug')

  if (communityIdParam != null && String(communityIdParam).trim() !== '') {
    const id = parseInt(String(communityIdParam), 10)
    if (!id || id < 1) throw Object.assign(new Error('communityId invalide'), { status: 400 })
    const comm = await getCommunityById(id)
    if (!comm) throw Object.assign(new Error('Communauté introuvable'), { status: 404 })
    return { id }
  }
  if (communitySlug) {
    const c = await getCommunityBySlug(String(communitySlug).trim())
    if (!c) throw Object.assign(new Error('Communauté introuvable'), { status: 404 })
    return { id: c.id }
  }
  throw Object.assign(new Error('communityId ou community_slug requis'), { status: 400 })
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ announcements: [] }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const community = await resolveCommunity(req)
    const role = await requireCommunityMembership(uid, community.id)
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)
    const announcements = await listPlaceAnnouncements(community.id, limit)
    const can_manage = await userCanManageInCommunity(uid, role)
    return NextResponse.json({ community_id: community.id, announcements, can_manage })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json()
    const community = await resolveCommunity(req, body)
    const { isAppSiteManager } = await resolveCommunityManagerAccess(uid)
    const announcement = await createPlaceAnnouncement({
      communityId: community.id,
      authorId: uid,
      title: String(body.title ?? ''),
      body: String(body.body ?? ''),
      image_data: body.image_data,
      isAppSiteManager,
    })
    return NextResponse.json({ announcement })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
