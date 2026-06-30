import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, resolveCommunityManagerAccess } from '@/lib/api-auth'
import { addEventStaff, removeEventStaff } from '@/lib/db-mandala-events'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
    const targetUserId = parseInt(String(body.user_id ?? ''), 10)
    if (!eventId || !targetUserId) {
      return NextResponse.json({ error: 'event_id et user_id requis' }, { status: 400 })
    }
    const { isAppAdmin } = await resolveCommunityManagerAccess(uid)
    await addEventStaff({
      userId: uid,
      eventId,
      targetUserId,
      role: String(body.role ?? 'volunteer'),
      note: body.note != null ? String(body.note) : undefined,
      isAppAdmin,
    })
    return NextResponse.json({ ok: true })
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
    const targetUserId = parseInt(req.nextUrl.searchParams.get('user_id') ?? '', 10)
    if (!eventId || !targetUserId) {
      return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    }
    const { isAppAdmin } = await resolveCommunityManagerAccess(uid)
    await removeEventStaff({ userId: uid, eventId, targetUserId, isAppAdmin })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
