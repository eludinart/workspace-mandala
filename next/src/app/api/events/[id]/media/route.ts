import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { addEventMedia, removeEventMedia } from '@/lib/db-mandala-events'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function isAppAdmin(userId: number): Promise<boolean> {
  try {
    const u = await authMe(userId)
    const r = u.app_role || u.wp_role || ''
    return r === 'admin' || r === 'administrator'
  } catch {
    return false
  }
}

export async function POST(
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
    const eventId = parseInt(id, 10)
    const body = await req.json()
    const admin = await isAppAdmin(uid)
    const mediaId = await addEventMedia({
      userId: uid,
      eventId,
      image_data: String(body.image_data ?? ''),
      caption: body.caption != null ? String(body.caption) : undefined,
      isAppAdmin: admin,
    })
    return NextResponse.json({ media_id: mediaId })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
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
    const eventId = parseInt(id, 10)
    const mediaId = parseInt(req.nextUrl.searchParams.get('media_id') ?? '', 10)
    const admin = await isAppAdmin(uid)
    await removeEventMedia({ userId: uid, eventId, mediaId, isAppAdmin: admin })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
