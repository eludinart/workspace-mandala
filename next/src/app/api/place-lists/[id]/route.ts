import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import {
  addPlaceListPhotos,
  claimPlaceListItem,
  deletePlaceListItem,
  deferPlaceListItem,
  markPlaceListBrought,
  removePlaceListPhoto,
  setPlaceListBringDate,
  updatePlaceListItemDetails,
} from '@/lib/db-place-lists'
import { requirePlaceOpsAccess } from '@/lib/preview-ops-access'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { id: idRaw } = await ctx.params
    const itemId = parseInt(idRaw, 10)
    if (!itemId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const { uid, communityId, canManage } = await requirePlaceOpsAccess(req, {
      communitySlug: body.community_slug != null ? String(body.community_slug) : null,
      communityId: body.community_id != null ? Number(body.community_id) : null,
    })
    const action = String(body.action ?? '')

    if (action === 'claim') {
      const item = await claimPlaceListItem({
        communityId,
        itemId,
        userId: uid,
        bringDate: body.bring_date != null ? String(body.bring_date) : null,
        claim: true,
      })
      return NextResponse.json({ ok: true, item })
    }
    if (action === 'unclaim') {
      const item = await claimPlaceListItem({
        communityId,
        itemId,
        userId: uid,
        claim: false,
      })
      return NextResponse.json({ ok: true, item })
    }
    if (action === 'set_date') {
      const item = await setPlaceListBringDate({
        communityId,
        itemId,
        userId: uid,
        bringDate: String(body.bring_date ?? ''),
        canManage,
      })
      return NextResponse.json({ ok: true, item })
    }
    if (action === 'brought') {
      await markPlaceListBrought({ communityId, itemId, userId: uid, canManage })
      return NextResponse.json({ ok: true })
    }
    if (action === 'defer') {
      const item = await deferPlaceListItem({ communityId, itemId, userId: uid, canManage })
      return NextResponse.json({ ok: true, item })
    }
    if (action === 'update_details') {
      const item = await updatePlaceListItemDetails({
        communityId,
        itemId,
        userId: uid,
        canManage,
        title: body.title != null ? String(body.title) : undefined,
        notes: body.notes !== undefined ? (body.notes != null ? String(body.notes) : null) : undefined,
      })
      return NextResponse.json({ ok: true, item })
    }
    if (action === 'add_photos') {
      const images = Array.isArray(body.images)
        ? body.images.map((x) => String(x)).filter(Boolean)
        : []
      const photos = await addPlaceListPhotos({
        communityId,
        itemId,
        images,
        userId: uid,
        canManage,
      })
      return NextResponse.json({ ok: true, photos })
    }
    if (action === 'remove_photo') {
      await removePlaceListPhoto({
        communityId,
        itemId,
        photoId: Number(body.photo_id),
        userId: uid,
        canManage,
      })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const { id: idRaw } = await ctx.params
    const itemId = parseInt(idRaw, 10)
    if (!itemId) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const community_slug = req.nextUrl.searchParams.get('community_slug')
    const { communityId, canManage } = await requirePlaceOpsAccess(req, { communitySlug: community_slug })
    if (!canManage) {
      return NextResponse.json({ error: 'Droits gestionnaire requis pour supprimer' }, { status: 403 })
    }
    await deletePlaceListItem({ communityId, itemId })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
