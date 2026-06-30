import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, resolveCommunityManagerAccess } from '@/lib/api-auth'
import { deletePlaceAnnouncement, updatePlaceAnnouncement } from '@/lib/db-place-announcements'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { id } = await ctx.params
    const announcementId = parseInt(id, 10)
    if (!announcementId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const body = await req.json()
    const { isAppSiteManager } = await resolveCommunityManagerAccess(uid)
    const announcement = await updatePlaceAnnouncement({
      announcementId,
      userId: uid,
      isAppSiteManager,
      title: body.title,
      body: body.body,
      image_data: body.image_data,
    })
    return NextResponse.json({ announcement })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { id } = await ctx.params
    const announcementId = parseInt(id, 10)
    if (!announcementId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const { isAppSiteManager } = await resolveCommunityManagerAccess(uid)
    await deletePlaceAnnouncement({ announcementId, userId: uid, isAppSiteManager })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
