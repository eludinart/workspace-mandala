import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, resolveCommunityManagerAccess } from '@/lib/api-auth'
import { toggleEventTask } from '@/lib/db-mandala-events'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { id, taskId: taskIdStr } = await ctx.params
    const eventId = parseInt(id, 10)
    const taskId = parseInt(taskIdStr, 10)
    const body = await req.json()
    if (!eventId || !taskId) {
      return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    }

    const { isAppAdmin } = await resolveCommunityManagerAccess(uid)
    await toggleEventTask({
      userId: uid,
      eventId,
      taskId,
      is_done: !!body.is_done,
      isAppAdmin,
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
